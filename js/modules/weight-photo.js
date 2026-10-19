// ===== CONTROL DEL LOT CON FOTOS (verificacion de peso) =====
// Dos fotos opcionales por registro: el lot impreso en la BOLSA y el de la
// ETIQUETA. De cada una se intenta leer el lot (js/modules/lot-ocr.js); si no
// se puede, el operador lo escribe mirando la foto. Con los dos lots la app
// dice si coinciden y si son de la fecha de produccion. Si no coinciden, pide
// un comentario antes de guardar.
//
// Las fotos se achican aqui mismo (1280 px, JPEG 70 %: de 3-4 MB a unos
// 60-200 KB, y de paso pierden el GPS y los datos del telefono) y suben a
// SharePoint por dos funciones de Firebase (ver functions/index.js). El
// registro guarda solo el nombre del archivo, que se inventa aqui: asi se
// puede guardar sin señal. La foto espera en el telefono (IndexedDB, que si
// aguanta imagenes; localStorage no) hasta que haya conexion.

var WP_UPLOAD = 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyPhotoUpload';
var WP_GET    = 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyPhotoGet';
var WP_LADO = 1280, WP_CALIDAD = 0.7;

var WP_TIPOS = {bag:'Bag LOT', label:'Label'};
var wpFotos = {bag:null, label:null};     // {b64,w,h,kb} de cada foto, antes de guardar
var wpComo  = {bag:null, label:null};     // 'read' | 'typed' | 'reading' | 'notfound'
var wpPara  = null;                       // a que espacio va la foto que se esta tomando
var wpCache = {};                         // fileName -> data URI ya traida

// ---- La cola en el telefono ----
var _wpDb = null;
function wpDB(){
  if(_wpDb) return _wpDb;
  _wpDb = new Promise(function(ok, mal){
    if(!window.indexedDB){ mal(new Error('IndexedDB not available')); return; }
    var r = indexedDB.open('nexora-fotos', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('cola', {keyPath:'fileName'}); };
    r.onsuccess = function(){ ok(r.result); };
    r.onerror = function(){ mal(r.error); };
  });
  return _wpDb;
}
function _wpPedir(modo, hacer){
  return wpDB().then(function(db){
    return new Promise(function(ok, mal){
      var tx = db.transaction('cola', modo);
      var req = hacer(tx.objectStore('cola'));
      tx.oncomplete = function(){ ok(req ? req.result : undefined); };
      tx.onerror = tx.onabort = function(){ mal(tx.error); };
    });
  });
}
function wpColaPut(it){ return _wpPedir('readwrite', function(s){ return s.put(it); }); }
function wpColaGet(fn){ return _wpPedir('readonly',  function(s){ return s.get(fn); }); }
function wpColaDel(fn){ return _wpPedir('readwrite', function(s){ return s.delete(fn); }); }
function wpColaAll(){   return _wpPedir('readonly',  function(s){ return s.getAll(); }).then(function(x){ return x || []; }); }

// ---- Cargar y achicar ----
function wpCargarImagen(file){
  if(window.createImageBitmap)
    return createImageBitmap(file, {imageOrientation:'from-image'}).catch(function(){ return createImageBitmap(file); });
  return new Promise(function(ok, mal){
    var img = new Image(), u = URL.createObjectURL(file);
    img.onload = function(){ URL.revokeObjectURL(u); ok(img); };
    img.onerror = function(){ URL.revokeObjectURL(u); mal(new Error('not an image')); };
    img.src = u;
  });
}
function wpComprimir(img){
  var w = img.width, h = img.height;
  var k = Math.min(1, WP_LADO / Math.max(w, h));
  var cw = Math.round(w*k), ch = Math.round(h*k);
  var cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
  var b64 = cv.toDataURL('image/jpeg', WP_CALIDAD).split(',')[1] || '';
  return {b64:b64, w:cw, h:ch, kb:Math.round(b64.length*3/4/1024)};
}

// W-AAAAMMDD-xxxxxxxxxxxx.jpg (la funcion solo acepta esta forma)
function wpNombre(fechaIso){
  var d = String(fechaIso || localDateStr()).slice(0,10).replace(/-/g,'');
  var r = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var rnd = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(12)) : null;
  for(var i=0;i<12;i++) r += abc[rnd ? rnd[i] % abc.length : Math.floor(Math.random()*abc.length)];
  return 'W-'+d+'-'+r+'.jpg';
}

function wpFechaRegistro(){
  var d = document.getElementById('w-date');
  return (d && d.value) || localDateStr();
}

// ---- Tomar la foto ----
function wpElegir(tipo){
  wpPara = tipo;
  var i = document.getElementById('w-photo-input');
  if(i){ i.value = ''; i.click(); }
}
function wpAlElegir(input){
  var f = input && input.files && input.files[0];
  var tipo = wpPara;
  if(!f || !tipo) return;
  // Lo que el operador ya escribio a mano no lo pisa la lectura
  var inpAntes = document.getElementById('w-lot-'+tipo);
  var escrito = wpComo[tipo] === 'typed' && !!(inpAntes && inpAntes.value.trim());
  if(!escrito) wpComo[tipo] = 'reading';
  var caja = document.getElementById('w-ph-'+tipo);
  if(caja) caja.querySelector('.wp-foto').innerHTML = '<span class="wp-meta">Processing photo…</span>';
  wpCargarImagen(f).then(function(img){
    var x = wpComprimir(img);
    if(!/^\/9j\//.test(x.b64)) throw new Error('not a JPEG');
    wpFotos[tipo] = x;
    wpPintarFoto(tipo);
    wpPintarLot(tipo);
    // Leer el lot sobre la foto grande; mientras tanto se puede seguir llenando
    if(escrito){ if(img.close) img.close(); wpComparar(); return; }
    return lotLeer(img, wpFechaRegistro()).then(function(info){
      if(img.close) img.close();
      if(wpFotos[tipo] !== x) return;            // la cambiaron mientras leia
      var inp = document.getElementById('w-lot-'+tipo);
      if(info && inp && !escrito){ inp.value = info.lot; wpComo[tipo] = 'read'; }
      else if(!info && !escrito) wpComo[tipo] = 'notfound';
      wpPintarLot(tipo);
      wpComparar();
    });
  }).catch(function(e){
    if(!wpFotos[tipo]){ wpPintarFoto(tipo); toast('That file could not be read as a photo'); }
    else { wpComo[tipo] = 'notfound'; wpPintarLot(tipo); }
    wpComparar();
  });
}
function wpQuitar(tipo){
  wpFotos[tipo] = null;
  if(wpComo[tipo] !== 'typed'){
    var inp = document.getElementById('w-lot-'+tipo);
    if(inp) inp.value = '';
    wpComo[tipo] = null;
  }
  wpPintarFoto(tipo); wpPintarLot(tipo); wpComparar();
}
function wpEscribio(tipo){
  var inp = document.getElementById('w-lot-'+tipo);
  if(!inp) return;
  wpComo[tipo] = inp.value.trim() ? 'typed' : null;
  wpPintarLot(tipo);
  wpComparar();
}

// ---- Pintar ----
function wpPintar(){
  ['bag','label'].forEach(function(t){
    var caja = document.getElementById('w-ph-'+t);
    if(!caja) return;
    if(!caja.querySelector('.wp-foto')){
      caja.innerHTML =
        '<div class="wp-tit">'+WP_TIPOS[t]+'</div>'+
        '<div class="wp-foto"></div>'+
        '<label class="wp-lotf"><span>LOT</span>'+
          '<input type="text" class="ninput wp-lotin" id="w-lot-'+t+'" inputmode="numeric" autocomplete="off" '+
            'placeholder="5 digits" oninput="wpEscribio(\''+t+'\')"></label>'+
        '<div class="wp-como" id="w-como-'+t+'"></div>';
    }
    wpPintarFoto(t); wpPintarLot(t);
  });
  wpComparar();
}
function wpPintarFoto(tipo){
  var caja = document.getElementById('w-ph-'+tipo);
  var el = caja && caja.querySelector('.wp-foto');
  if(!el) return;
  var x = wpFotos[tipo];
  el.innerHTML = !x
    ? '<button type="button" class="cbtn wp-btn" onclick="wpElegir(\''+tipo+'\')"><span data-icon="camera"></span>Take photo</button>'
    : '<img class="wp-thumb" src="data:image/jpeg;base64,'+x.b64+'" alt="'+WP_TIPOS[tipo]+' photo" onclick="wpAmpliar(this.src)">'+
      '<div class="wp-acts">'+
        '<button type="button" class="cbtn" title="Retake" aria-label="Retake" onclick="wpElegir(\''+tipo+'\')"><span data-icon="camera"></span></button>'+
        '<button type="button" class="cbtn" title="Remove" aria-label="Remove" onclick="wpQuitar(\''+tipo+'\')"><span data-icon="trash"></span></button>'+
      '</div>';
  if(typeof renderIcons==='function') renderIcons(el);
}
function wpPintarLot(tipo){
  var el = document.getElementById('w-como-'+tipo);
  if(!el) return;
  var c = wpComo[tipo];
  el.className = 'wp-como' + (c === 'notfound' ? ' warn' : '');
  el.textContent = c === 'reading'  ? 'Reading the LOT…'
                 : c === 'read'     ? 'Read from the photo, check it'
                 : c === 'notfound' ? 'Could not read it, type it from the photo'
                 : c === 'typed'    ? 'Typed'
                 : '';
}

// ---- Comparar ----
// Lo que se guarda con el registro (o null si no se uso)
function wpLotCheck(){
  var bag = lotLimpio((document.getElementById('w-lot-bag')||{}).value);
  var lab = lotLimpio((document.getElementById('w-lot-label')||{}).value);
  if(!bag && !lab) return null;
  var ref = wpFechaRegistro();
  var base = bag || lab;
  var info = typeof lotInfo === 'function' ? lotInfo(base, ref) : null;
  // El LOT del registro (el del dia, o el que eligio QA): lo leido en las
  // fotos tiene que ser ese, no solo coincidir entre si
  var esperado = lotLimpio((document.getElementById('w-lot')||{}).value);
  var leidos = [bag, lab].filter(Boolean);
  return {
    bag: bag || null, label: lab || null,
    bagHow: bag ? (wpComo.bag === 'read' ? 'read' : 'typed') : null,
    labelHow: lab ? (wpComo.label === 'read' ? 'read' : 'typed') : null,
    match: (bag && lab) ? bag === lab : null,
    expected: esperado || null,
    dayMatch: (esperado && leidos.length) ? leidos.every(function(x){ return x === esperado; }) : null,
    lotDate: info ? info.fechaStr : null,
    days: info ? info.dias : null
  };
}
function wpFechaCorta(iso){
  var p = String(iso).split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1]+' '+(+p[2]);
}
function wpComparar(){
  var el = document.getElementById('w-lotcheck');
  if(!el) return;
  var c = wpLotCheck();
  if(!c){ el.hidden = true; el.innerHTML = ''; return; }
  var cuando = c.lotDate
    ? 'LOT date '+wpFechaCorta(c.lotDate)+(c.days === 0 ? ' (today)' : c.days === 1 ? ' (yesterday)' : c.days < 0 ? ' (after this record)' : ' ('+c.days+' days earlier)')
    : '';
  var cls, txt, pista = '';
  if(c.match === false){
    cls = 'bad'; txt = 'Bag '+esc(c.bag)+' and label '+esc(c.label)+' do not match. Add a comment to save.';
  } else if(c.dayMatch === false){
    var leido = c.bag || c.label;
    cls = 'bad';
    txt = (c.match === true ? 'Bag and label read '+esc(leido)
                            : (c.bag ? 'Bag' : 'Label')+' reads '+esc(leido))+
          ', but the LOT of the day is '+esc(c.expected)+'. Add a comment to save.';
    pista = wpPistaLot(leido);
  } else if(c.match === true){
    cls = 'ok';
    txt = c.expected ? 'Bag, label and LOT of the day match · '+esc(c.bag)
                     : 'Bag and label match · LOT '+esc(c.bag);
    // el LOT del registro sale de aqui si estaba vacio
    var lot = document.getElementById('w-lot');
    if(lot && !lot.value.trim()) lot.value = c.bag;
  } else {
    cls = '';    txt = 'Waiting for the '+(c.bag ? 'label' : 'bag')+' LOT';
  }
  var aviso = '';
  if(!c.lotDate) aviso = esc(c.bag || c.label)+' is not a LOT date from this week';
  else if(c.days > 1 || c.days < 0) aviso = cuando+': not the production date';
  el.className = 'wp-check '+cls;
  el.innerHTML = '<b>'+txt+'</b>'+
    (pista ? '<span class="wp-aviso">'+pista+'</span>' : '')+
    (aviso ? '<span class="wp-aviso">'+aviso+'</span>' : (cuando ? '<span>'+cuando+'</span>' : ''));
  el.hidden = false;
}

// Si lo leido es uno de los otros LOT del dia (el del otro formato o el de
// manana), se dice cual: suele ser producto adelantado o el formato del cliente
function wpPistaLot(leido){
  if(typeof lotOpciones !== 'function' || typeof lotContexto !== 'function') return '';
  var o = lotOpciones(lotContexto('weight').dia).filter(function(x){ return x.v === leido; })[0];
  return o ? esc(leido)+' is the '+esc(o.t)+' LOT. If that is right, pick it in Choose.' : '';
}

// Lo llama saveWeight antes de guardar: si no coinciden, hace falta comentario
function wpLotBloquea(){
  var c = wpLotCheck();
  if(!c || (c.match !== false && c.dayMatch !== false)) return false;
  var com = document.getElementById('w-comments');
  if(com && com.value.trim()) return false;
  toast(c.match === false ? 'Bag and label LOT do not match: add a comment to save'
                          : 'The photos do not show the LOT of the day: add a comment to save');
  if(com) com.focus();
  return true;
}

// Lo llama commitWeight antes de guardar: el registro se lleva el control
// del lot y los nombres de las fotos; las fotos se quedan en la cola
function wpAdjuntar(rec){
  if(!rec) return;
  var c = wpLotCheck();
  if(c){
    rec.lotCheck = c;
    if(!rec.lot && c.match) rec.lot = c.bag;
  }
  var fotos = [];
  ['bag','label'].forEach(function(t){
    var x = wpFotos[t];
    if(!x) return;
    var fn = wpNombre(rec.date);
    fotos.push({kind:t, fileName:fn, w:x.w, h:x.h, kb:x.kb});
    wpColaPut({
      fileName: fn, b64: x.b64, createdAt: new Date().toISOString(), tries: 0,
      meta: {kind:t, date:rec.date, line:rec.line, product:rec.product||'', lot:(t==='bag'?c&&c.bag:c&&c.label)||rec.lot||'', by:rec.initials||''}
    }).then(function(){ wpAviso(); wpSubir(); })
      .catch(function(){ toast('A photo could not be kept on this device'); });
  });
  if(fotos.length) rec.photos = fotos;
  // limpio para el siguiente registro
  wpFotos = {bag:null, label:null};
  wpComo  = {bag:null, label:null};
  ['bag','label'].forEach(function(t){ var i = document.getElementById('w-lot-'+t); if(i) i.value = ''; });
  wpPintar();
}

// ---- Subir lo pendiente ----
var _wpSubiendo = false;
function wpSubir(){
  if(_wpSubiendo || navigator.onLine === false){ wpAviso(); return Promise.resolve(); }
  _wpSubiendo = true;
  return wpColaAll().then(function(items){
    items.sort(function(a,b){ return String(a.createdAt).localeCompare(String(b.createdAt)); });
    var i = 0;
    var siguiente = function(){
      if(i >= items.length) return;
      var it = items[i++];
      return fetch(WP_UPLOAD, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fileName:it.fileName, contentBase64:it.b64, meta:it.meta})
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(j){ return {s:r.status, j:j}; });
      }).then(function(x){
        if(x.s === 200 && x.j.ok) return wpColaDel(it.fileName).then(siguiente);
        it.tries = (it.tries||0) + 1;
        it.error = x.j.error || ('HTTP '+x.s);
        // Lo que nunca va a pasar (nombre o archivo malo) no frena a los demas;
        // lo de afuera (sin flujo, sin señal, demasiadas) para y se reintenta
        if(x.s === 400 || x.s === 413) return wpColaPut(it).then(siguiente);
        return wpColaPut(it);
      });
    };
    return siguiente();
  }).catch(function(){ /* sin red: se reintenta despues */ })
    .then(function(){ _wpSubiendo = false; wpAviso(); });
}

// "2 photos waiting to upload" en la pantalla de pesos
function wpAviso(){
  var el = document.getElementById('w-photo-pend');
  if(!el) return;
  wpColaAll().then(function(items){
    if(!items.length){ el.hidden = true; el.textContent = ''; return; }
    var n = items.length;
    var motivo = items.some(function(x){ return x.error === 'not configured'; })
      ? ' · SharePoint is not connected yet'
      : (navigator.onLine === false ? ' · no connection' : '');
    el.textContent = n+' photo'+(n===1?'':'s')+' waiting to upload'+motivo;
    el.hidden = false;
  }).catch(function(){ el.hidden = true; });
}

// Reintentos: al volver la señal, al volver a la app y cada dos minutos
window.addEventListener('online', function(){ wpSubir(); });
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') wpSubir(); });
setTimeout(function(){ wpSubir(); }, 4000);
setInterval(function(){ wpColaAll().then(function(x){ if(x.length) wpSubir(); }).catch(function(){}); }, 120000);

// ---- Ver las fotos y el control de un registro ----
function wpBloqueHTML(w){
  if(!w) return '';
  var html = '';
  var c = w.lotCheck;
  if(c){
    var como = function(h){ return h === 'read' ? 'read' : 'typed'; };
    var est = c.match === true ? '<span class="numstate ok">Match</span>'
            : c.match === false ? '<span class="numstate bad">Do not match</span>'
            : '<span class="soft">Only one LOT</span>';
    html += '<div class="rec-block"><div class="rec-lbl">LOT check</div><div class="rec-text">'+
      'Bag <b class="mono">'+esc(c.bag||'—')+'</b>'+(c.bag?' <span class="soft">('+como(c.bagHow)+')</span>':'')+
      ' · Label <b class="mono">'+esc(c.label||'—')+'</b>'+(c.label?' <span class="soft">('+como(c.labelHow)+')</span>':'')+
      ' · '+est+
      (c.expected ? '<br>LOT of the day <b class="mono">'+esc(c.expected)+'</b> · '+
        (c.dayMatch === true ? '<span class="numstate ok">Match</span>'
         : c.dayMatch === false ? '<span class="numstate bad">Does not match</span>' : '')
        : '')+
      (c.lotDate ? '<br><span class="soft">LOT date '+wpFechaCorta(c.lotDate)+
        (c.days === 0 ? ', same day as the record' : c.days === 1 ? ', the day before the record' : ', '+c.days+' days from the record')+'</span>' : '')+
      '</div></div>';
  }
  var fotos = w.photos || (w.photo ? [{kind:'', fileName:w.photo.fileName}] : []);
  if(fotos.length){
    html += '<div class="rec-block"><div class="rec-lbl">Photos</div><div class="wp-grid">'+
      fotos.map(function(f){
        return '<figure class="wp-fig"><div class="wp-ver" data-wp="'+esc(f.fileName)+'"><span class="rec-hint">Loading photo…</span></div>'+
          (f.kind ? '<figcaption>'+WP_TIPOS[f.kind]+'</figcaption>' : '')+'</figure>';
      }).join('')+'</div></div>';
  }
  return html;
}
function wpCargarEn(root){
  if(!root) return;
  root.querySelectorAll('[data-wp]').forEach(function(el){
    var fn = el.getAttribute('data-wp');
    wpTraer(fn).then(function(uri){
      el.innerHTML = '<img class="wp-img" src="'+uri+'" alt="Weight check photo" onclick="wpAmpliar(this.src)">';
    }, function(msg){
      el.innerHTML = '<span class="rec-hint">'+esc(String(msg))+'</span>';
    });
  });
}
function wpTraer(fn){
  if(wpCache[fn]) return Promise.resolve(wpCache[fn]);
  return wpColaGet(fn).catch(function(){ return null; }).then(function(it){
    // Si todavia no subio, la tiene este telefono
    if(it && it.b64) return 'data:image/jpeg;base64,'+it.b64;
    return fetch(WP_GET, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fileName:fn})
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ return {s:r.status, j:j}; });
    }, function(){ throw 'No connection: the photo shows when you are online.'; })
    .then(function(x){
      if(x.s === 200 && x.j.ok && x.j.content){
        var u = 'data:image/jpeg;base64,'+x.j.content;
        wpCache[fn] = u;
        return u;
      }
      if(x.s === 503) throw 'Photos are not connected to SharePoint yet.';
      if(x.s === 404) throw 'Not uploaded yet: it is still on the device that took it.';
      throw 'The photo could not be loaded.';
    });
  });
}
// A pantalla completa; un toque la cierra
function wpAmpliar(src){
  var z = document.createElement('div');
  z.className = 'wp-zoom';
  z.innerHTML = '<img src="'+src+'" alt="Weight check photo">';
  z.onclick = function(){ z.remove(); };
  document.body.appendChild(z);
}
