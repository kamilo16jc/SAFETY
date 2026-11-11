// ===== EL CELULAR COMO LECTOR DE LA PC =====
// El celular queda fijo como lector: con la camara siempre abierta lee el
// codigo de barras al instante (el producto llega a la PC en un segundo) y con
// el boton grande toma la foto de la etiqueta para el LOT y el Order (el lector
// de js/modules/label-read.js). Lo leido aparece solo en la fila nueva de la
// lista abierta en la PC; ahi QA lo revisa y le da Add.
//
// Se conectan por el MISMO USUARIO (decision del usuario, 10 nov 2026): el
// celular escribe en Firestore reader/{usuario} y la PC lo escucha. En el
// servidor de diseño (sin Firebase) el canal es BroadcastChannel entre pestañas
// del mismo navegador, para probarlo sin tocar datos.
//
// reader/{usuario}:
//   events  las ultimas lecturas del celular (solo las escribe el celular):
//           {id, at, t:'product'|'code'|'label', numero, nombre, codigo, como,
//            lot, lotRevisar, lotFecha, order}
//   phone   {at, on}            latido del celular con el lector abierto
//   pc      {screen, label, at} que lista tiene abierta la PC

var PR_PANTALLAS = {'screen-analysis': 'Sample Analysis'};   // las que reciben del celular
var PR_LATIDO_CEL = 40000, PR_LATIDO_PC = 60000, PR_VIVO = 150000;
var PR_REPITE = 2;          // el mismo codigo dos veces seguidas antes de mandarlo
var PR_ESPERA = 60000;      // el mismo codigo otra vez: solo si se vio otro, o al minuto

var prBC = null;
try { prBC = new BroadcastChannel('nexora-reader'); } catch(e){}

function prKey(){
  var u = (typeof currentUser !== 'undefined') ? currentUser : null;
  return u ? String(u.id || u.username || u.name || '') : '';
}
function prLocal(){ return window.NEXORA_DESIGN_LOCAL === true; }

// ---- El canal ----
function prEnviar(campos){
  var k = prKey();
  if(!k) return;
  var limpio = JSON.parse(JSON.stringify(campos));      // Firestore no acepta undefined
  if(window.readerWrite){ window.readerWrite(k, limpio).catch(function(){}); return; }
  if(prLocal() && prBC) prBC.postMessage({k:k, campos:limpio});
}
var _prQuitar = null, _prKeyEscucha = '', _prReintento = null;
var prSubs = [];
function prEscuchar(){
  var k = prKey();
  if(!k || k === _prKeyEscucha) return;
  if(_prQuitar){ try { _prQuitar(); } catch(e){} _prQuitar = null; }
  prHechos = null; prCel = null; prPc = null;          // otro usuario: otra base
  var recibir = function(d){ prSubs.forEach(function(f){ try { f(d || {}); } catch(e){} }); };
  if(window.readerWatch){
    _prKeyEscucha = k;
    _prQuitar = window.readerWatch(k, recibir);
  } else if(prLocal() && prBC){
    _prKeyEscucha = k;
    var f = function(e){ if(e.data && e.data.k === prKey()) recibir(e.data.campos); };
    prBC.addEventListener('message', f);
    _prQuitar = function(){ prBC.removeEventListener('message', f); };
  } else if(!_prReintento){
    // Firebase todavia cargando: se reintenta
    _prReintento = setTimeout(function(){ _prReintento = null; prEscuchar(); }, 2000);
  }
}
function prResumen(ev){
  var p = [];
  if(ev.numero) p.push(ev.numero);
  else if(ev.codigo) p.push('barcode '+ev.codigo);
  if(ev.lot) p.push('LOT '+ev.lot);
  if(ev.order) p.push('Order '+ev.order);
  return p.join(' · ');
}

// =================== LA PC ===================
var prCel = null;          // ultimo latido del celular {at, on}
var prHechos = null;       // ids ya aplicados (null = todavia sin la base)
var prPcTimer = null, prPcPantalla = null;

function prCelVivo(){ return !!(prCel && prCel.on && Date.now() - (+prCel.at || 0) < PR_VIVO); }

prSubs.push(function(d){
  if(prModoCel) return;                                  // el celular no recibe lo suyo
  if(d.phone){ prCel = d.phone; prPintarEstado(); }
  if(prHechos === null){
    prHechos = {};
    // Lo que ya estaba en el documento al abrir la PC no se vuelve a aplicar
    if(window.readerWatch){ (d.events || []).forEach(function(e){ if(e) prHechos[e.id] = 1; }); return; }
  }
  (d.events || []).forEach(function(ev){
    if(!ev || prHechos[ev.id]) return;
    prHechos[ev.id] = 1;
    // una lectura vieja (de otra sesion, que llego tarde) no llena la fila de ahora
    if(Date.now() - (+ev.at || 0) > 10*60000) return;
    prAplicar(ev);
  });
});

function prAplicar(ev){
  var here = (document.querySelector('.screen.active') || {}).id;
  if(here === 'screen-analysis' && typeof anReaderApply === 'function'){ anReaderApply(ev); return; }
  toast('Phone reader: open Sample Analysis to use '+prResumen(ev));
}

// La PC avisa que lista tiene abierta, para que el celular lo muestre
function prPcPresencia(forzar){
  if(prModoCel || !prKey()) return;
  var here = (document.querySelector('.screen.active') || {}).id;
  var lista = PR_PANTALLAS[here] ? here : '';
  if(!forzar && lista === prPcPantalla && !lista) return;
  if(!forzar && lista === prPcPantalla && document.visibilityState === 'hidden') return;
  prPcPantalla = lista;
  prEnviar({pc:{screen:lista, label:PR_PANTALLAS[lista] || '', at:Date.now()}});
}

// El indicador del celular en las listas (Sample Analysis: junto a Product)
function prPintarEstado(){
  var b = document.getElementById('an-phone');
  if(!b) return;
  var vivo = prCelVivo();
  b.classList.toggle('on', vivo);
  var t = vivo ? 'Phone reader connected: scan a label with your phone'
               : 'Phone reader: open NEXORA on your phone, menu, Phone reader';
  b.setAttribute('data-tip', t);
  b.setAttribute('aria-label', t);
}
function prComoConectar(){
  var vivo = prCelVivo();
  showGuardModal({
    icon:'phone',
    title: vivo ? 'Your phone is connected' : 'Use your phone as the reader',
    detail: vivo
      ? 'Point the phone at the barcode: the product shows up here. Tap the big button on the phone to read the LOT and the Order from the label.'
      : 'On your phone open NEXORA, sign in as '+(currentUser ? currentUser.name : 'you')+
        ', tap your initials and choose Phone reader. It stays open as a reader.',
    ask: 'What the phone reads fills the new row here; you check it and press Add.',
    primaryLabel:'OK', onPrimary:closeDupModal,
    secondaryLabel:'Use this device', onSecondary:function(){ closeDupModal(); prAbrir(); }
  });
}

// =================== EL CELULAR ===================
var prModoCel = false, prStream = null, prTrack = null, prTimer = null, prDetector = null;
var prUlt = null, prHits = 0, prMandados = {}, prUltMandado = null, prEventos = [], prOcupado = false;
var prLeyendo = false, prWake = null, prLatidoT = null, prLuzOn = false, prPc = null;

function prAbrir(){
  if(!currentUser){ toast('Sign in first'); return; }
  var menu = document.getElementById('user-menu'); if(menu) menu.classList.remove('open');
  prModoCel = true;
  try { localStorage.setItem('nexora_phone_reader', '1'); } catch(e){}
  prOverlay();
  document.getElementById('pr-ov').hidden = false;
  document.body.classList.add('pr-abierto');
  prEstado();
  prCamara();
  prDespierto();
  prLatido();
  clearInterval(prLatidoT); prLatidoT = setInterval(prLatido, PR_LATIDO_CEL);
  prEscuchar();
}
function prCerrar(){
  prModoCel = false;
  try { localStorage.removeItem('nexora_phone_reader'); } catch(e){}
  clearInterval(prTimer); prTimer = null;
  clearInterval(prLatidoT); prLatidoT = null;
  if(prStream){ prStream.getTracks().forEach(function(t){ t.stop(); }); prStream = null; prTrack = null; }
  if(prWake){ try { prWake.release(); } catch(e){} prWake = null; }
  prEnviar({phone:{at:Date.now(), on:false}});
  var ov = document.getElementById('pr-ov'); if(ov) ov.hidden = true;
  document.body.classList.remove('pr-abierto');
}
function prLatido(){ if(prModoCel) prEnviar({phone:{at:Date.now(), on:true}}); }

function prOverlay(){
  if(document.getElementById('pr-ov')) return;
  var d = document.createElement('div');
  d.id = 'pr-ov'; d.className = 'pr-ov'; d.hidden = true;
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Phone reader');
  d.innerHTML =
    '<video id="pr-video" playsinline muted autoplay></video>'+
    '<div class="pr-marco" aria-hidden="true"></div>'+
    '<div class="pr-top">'+
      '<div class="pr-tit"><b>Phone reader</b><span id="pr-estado">Connecting…</span></div>'+
      '<button type="button" class="pr-x" onclick="prCerrar()" aria-label="Close the reader">×</button>'+
    '</div>'+
    '<div class="pr-msg" id="pr-msg">Point at the barcode</div>'+
    '<div class="pr-ult" id="pr-ult" aria-live="polite"></div>'+
    '<div class="pr-bar">'+
      '<button type="button" class="pr-luz" id="pr-luz" onclick="prLuz()" hidden aria-label="Light">'+
        '<span data-icon="sun"></span></button>'+
      '<button type="button" class="pr-foto" id="pr-foto" onclick="prFoto()">'+
        '<span data-icon="camera"></span><b>LOT photo</b></button>'+
      '<span class="pr-hueco"></span>'+
    '</div>';
  document.body.appendChild(d);
  if(typeof renderIcons === 'function') renderIcons(d);
}
function prMsg(t){ var e = document.getElementById('pr-msg'); if(e) e.textContent = t; }

// A donde va lo que lee: la lista que tiene abierta la PC
function prEstado(){
  var e = document.getElementById('pr-estado');
  if(!e) return;
  var pcViva = prPc && Date.now() - (+prPc.at || 0) < PR_VIVO;
  e.textContent = !pcViva ? 'Waiting for your PC: open Sample Analysis there'
                : prPc.label ? 'Sending to '+prPc.label+' on your PC'
                : 'Your PC is on another screen: open Sample Analysis';
  e.className = pcViva && prPc.label ? 'ok' : '';
}
prSubs.push(function(d){
  if(!prModoCel || !d.pc) return;
  prPc = d.pc; prEstado();
});
setInterval(function(){ if(prModoCel) prEstado(); else prPintarEstado(); }, 15000);

function prCamara(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ prMsg('This browser cannot open the camera'); return; }
  if(prStream) return;
  navigator.mediaDevices.getUserMedia({video:scanVideoConstraints(), audio:false}).then(function(s){
    if(!prModoCel){ s.getTracks().forEach(function(t){ t.stop(); }); return; }
    prStream = s;
    var v = document.getElementById('pr-video');
    v.srcObject = s; v.play().catch(function(){});
    prTrack = s.getVideoTracks()[0];
    try {
      var caps = prTrack.getCapabilities ? prTrack.getCapabilities() : {};
      if(caps.focusMode && caps.focusMode.indexOf('continuous') >= 0)
        prTrack.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(function(){});
      if(caps.torch) document.getElementById('pr-luz').hidden = false;
    } catch(e){}
    prDetector = null;
    if(window.BarcodeDetector){
      try { prDetector = new BarcodeDetector({formats:['upc_a','ean_13','itf','code_128','code_39']}); }
      catch(e){ try { prDetector = new BarcodeDetector(); } catch(e2){ prDetector = null; } }
    }
    clearInterval(prTimer); prTimer = setInterval(prTick, 280);
  }).catch(function(e){
    prMsg(e && e.name === 'NotAllowedError' ? 'Camera permission denied. Allow the camera for this site.'
                                           : 'Could not open the camera.');
  });
}
function prLuz(){
  if(!prTrack) return;
  prLuzOn = !prLuzOn;
  prTrack.applyConstraints({advanced:[{torch:prLuzOn}]}).catch(function(){ prLuzOn = !prLuzOn; });
  var b = document.getElementById('pr-luz'); if(b) b.classList.toggle('on', prLuzOn);
}
// La pantalla no se apaga mientras el lector esta abierto
function prDespierto(){
  if(!navigator.wakeLock || prWake) return;
  navigator.wakeLock.request('screen').then(function(w){
    prWake = w; w.addEventListener('release', function(){ prWake = null; });
  }).catch(function(){});
}
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState !== 'visible') return;
  if(prModoCel){ prDespierto(); prLatido(); if(!prStream) prCamara(); }
  else prPcPresencia(true);
});

// ---- El codigo de barras, al instante ----
function prValido(t, fmt){
  t = String(t || '');
  if(fmt === 'itf') return t.length === 14 && typeof lrDigitoOk === 'function' && lrDigitoOk(t);
  if(fmt === 'code_128' || fmt === 'code_39') return t.replace(/[^0-9A-Za-z]/g, '').length >= 8;
  if(fmt === 'qr_code' || fmt === 'data_matrix') return false;
  return true;
}
function prTick(){
  if(prOcupado || prLeyendo) return;
  var v = document.getElementById('pr-video');
  if(!v || v.readyState < 2 || !v.videoWidth) return;
  if(prDetector){
    prOcupado = true;
    prDetector.detect(v).then(function(cs){
      prOcupado = false;
      cs = (cs || []).filter(function(c){ return prValido(c.rawValue, c.format); });
      if(!cs.length) return;
      var cx = v.videoWidth/2, cy = v.videoHeight/2;
      cs.sort(function(a, b){ return boxDist(a.boundingBox, cx, cy) - boxDist(b.boundingBox, cx, cy); });
      prVisto(cs[0].rawValue);
    }).catch(function(){ prOcupado = false; });
    return;
  }
  if(typeof _lrDecodificar !== 'function') return;
  // iPhone (sin lector nativo): ZXing sobre el centro del cuadro, donde apunta el marco
  var w = v.videoWidth, h = v.videoHeight;
  var sx = w*0.08, sy = h*0.22, sw = w*0.84, sh = h*0.56, k = Math.min(1, 1280/sw);
  var c = document.createElement('canvas');
  c.width = Math.round(sw*k); c.height = Math.round(sh*k);
  c.getContext('2d', {willReadFrequently:true}).drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
  var t = _lrDecodificar(c);
  if(t) prVisto(t);
}
function prVisto(c){
  if(c === prUlt) prHits++; else { prUlt = c; prHits = 1; }
  if(prHits < PR_REPITE) return;
  var ahora = Date.now();
  // Apuntando a la misma etiqueta no se manda una y otra vez
  if(c === prUltMandado && ahora - prMandados[c] < PR_ESPERA) return;
  prMandados[c] = ahora; prUltMandado = c;
  var x = (typeof lrProductoDeCodigo === 'function') ? lrProductoDeCodigo(c) : null;
  if(!x) return;
  if(x.numero) prMandar({t:'product', numero:x.numero, nombre:x.producto ? (x.producto.name || '') : '',
                         codigo:x.codigo, como:x.como});
  else prMandar({t:'code', codigo:x.codigo});
}

// ---- La foto de la etiqueta: LOT y Order ----
function prCaptura(){
  var v = document.getElementById('pr-video');
  var cuadro = function(){
    var c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c;
  };
  if(prTrack && window.ImageCapture){
    try {
      return new ImageCapture(prTrack).takePhoto()
        .then(function(b){ return createImageBitmap(b, {imageOrientation:'from-image'}); })
        .catch(function(){ return cuadro(); });
    } catch(e){}
  }
  return Promise.resolve(cuadro());
}
function prFoto(){
  if(prLeyendo) return;
  var v = document.getElementById('pr-video');
  if(!v || !v.videoWidth){ prMsg('The camera is not ready yet'); return; }
  prLeyendo = true;
  var b = document.getElementById('pr-foto'); if(b) b.classList.add('busy');
  prMsg('Reading the label…');
  prCaptura().then(function(img){
    return leerEtiqueta(img, localDateStr()).then(function(r){ if(img.close) img.close(); return r; });
  }).then(function(r){
    var ev = {t:'label'};
    if(r.numero){ ev.numero = r.numero; ev.nombre = r.producto ? (r.producto.name || '') : ''; ev.como = r.comoProducto; ev.codigo = r.codigo; }
    else if(r.codigo) ev.codigo = r.codigo;
    if(r.lot){ ev.lot = r.lot; ev.lotRevisar = !!r.lotRevisar; ev.lotFecha = (r.lotInfo && r.lotInfo.fechaStr) || ''; }
    if(r.order) ev.order = r.order;
    if(!ev.numero && !ev.codigo && !ev.lot && !ev.order){
      prMsg('Nothing readable. Get closer to the LOT and try again.');
      if(typeof playAlert === 'function') playAlert('fail');
      return;
    }
    prMandar(ev);
  }).catch(function(){
    prMsg('The photo could not be read. Try again.');
  }).then(function(){
    prLeyendo = false;
    if(b) b.classList.remove('busy');
  });
}

function prMandar(ev){
  ev.id = Date.now().toString(36)+'-'+Math.random().toString(36).slice(2, 7);
  ev.at = Date.now();
  prEventos.push(ev);
  if(prEventos.length > 8) prEventos = prEventos.slice(-8);
  prEnviar({events:prEventos, phone:{at:Date.now(), on:true}});
  if(typeof playAlert === 'function') playAlert('pass');
  var ua = navigator.userActivation;
  if(navigator.vibrate && (!ua || ua.hasBeenActive)) try { navigator.vibrate(60); } catch(e){}
  prMsg(ev.t === 'label' ? 'Sent. Point at the next barcode' : 'Sent. Tap LOT photo to read the LOT');
  var u = document.getElementById('pr-ult');
  if(u){
    var fila = document.createElement('div');
    fila.className = 'pr-item'+(ev.lotRevisar ? ' warn' : '');
    fila.textContent = (ev.t === 'code' ? 'New barcode '+ev.codigo : prResumen(ev))+
                       (ev.nombre ? ' · '+ev.nombre : '')+(ev.lotRevisar ? ' (check LOT)' : '');
    u.insertBefore(fila, u.firstChild);
    while(u.children.length > 3) u.removeChild(u.lastChild);
  }
}

// ---- Arranque ----
// La PC escucha en cuanto hay sesion; el celular que tenia el lector abierto lo
// vuelve a abrir solo (queda "todo el tiempo" como lector)
var _prAuto = false;
window.addEventListener('nexora:screen', function(e){
  if(!currentUser || e.detail === 'screen-login'){ _prKeyEscucha = ''; return; }
  prEscuchar();
  if(!_prAuto){
    _prAuto = true;
    var quiere = false;
    try { quiere = localStorage.getItem('nexora_phone_reader') === '1'; } catch(x){}
    if(quiere){ setTimeout(prAbrir, 400); return; }
  }
  prPcPresencia();
  prPintarEstado();
});
setInterval(function(){
  if(!prModoCel && prPcPantalla && document.visibilityState === 'visible') prPcPresencia(true);
}, PR_LATIDO_PC);
