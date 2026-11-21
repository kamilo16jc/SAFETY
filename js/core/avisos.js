// ===== AVISOS EN EL TELEFONO (notificaciones de verdad) =====
// Pedido del usuario (20 nov 2026): que la app avise sola cuando falta el GMP
// del turno, una de las 3 temperaturas, los pesos de una linea (cada hora; a
// la hora y cuarto ya es tarde), el metal detector de una linea que corrio
// esta semana, o el Pre-Op.
//
// QUE avisar lo decide functions/avisos-reglas.js (NX_AVISOS), el mismo
// archivo que usa el servidor. Llega por dos caminos:
//   1. App abierta (PC o telefono): aqui, cada minuto, con lo del equipo.
//   2. App cerrada: el servidor (safetyReminders) revisa cada 15 minutos y le
//      manda una notificacion push al telefono que se anoto en pushSubs.
// Los dos usan la misma llave por aviso y la apuntan en la cache 'nx-avisos'
// (la comparte sw.js): lo que ya sono no vuelve a sonar.
//
// Cada equipo decide lo suyo (localStorage 'nx-avisos'): prendido o no, de
// que turno y que avisos. Las horas de los turnos son de todos: las pone el
// administrador (config/reminders).

var NXA_PREF = 'nx-avisos';
var NXA_CACHE = 'nx-avisos';
var NXA_KEY_URL = 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyPushKey';
var NXA_TIPOS = [
  ['weight', 'Weights',        'scale',     '#047857'],
  ['temp',   'Temperatures',   'thermo',    '#b45309'],
  ['gmp',    'GMP audit',      'clipboard', '#7c3aed'],
  ['metal',  'Metal detector', 'magnet',    '#be123c'],
  ['preop',  'Pre-Op',         'check',     '#4d7c0f']
];
var nxaTimer = null;
var nxaPendiente = null;      // la pantalla que pidio una notificacion antes de entrar

function nxaSoporta(){ return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator; }
function nxaSoportaPush(){ return nxaSoporta() && 'PushManager' in window; }

function nxaPrefs(){
  var p = {};
  try{ p = JSON.parse(localStorage.getItem(NXA_PREF) || '{}') || {}; }catch(e){}
  var alerts = {};
  NXA_TIPOS.forEach(function(t){ alerts[t[0]] = !(p.alerts && p.alerts[t[0]] === false); });
  return {on: !!p.on, push: !!p.push, subId: p.subId || '', alerts: alerts,
          shifts: (p.shifts && p.shifts.length) ? p.shifts.map(String) : [String(typeof expectedShift === 'function' ? expectedShift() : 2)]};
}
function nxaGuardar(p){ try{ localStorage.setItem(NXA_PREF, JSON.stringify(p)); }catch(e){} }
function nxaCfg(){ return NX_AVISOS.config((getDB() || {}).reminders || null); }

// ------------------------------------------------------------------
// Lo que ya sono (compartido con sw.js por la Cache API)
// ------------------------------------------------------------------
function nxaUrl(k){ return './nxa/' + encodeURIComponent(k); }
function nxaVisto(k){
  if(!k || typeof caches === 'undefined') return Promise.resolve(false);
  return caches.open(NXA_CACHE).then(function(c){ return c.match(nxaUrl(k)); })
    .then(function(r){ return !!r; }).catch(function(){ return false; });
}
function nxaMarcar(k){
  if(!k || typeof caches === 'undefined') return Promise.resolve();
  return caches.open(NXA_CACHE).then(function(c){ return c.put(nxaUrl(k), new Response(String(Date.now()))); }).catch(function(){});
}
// Lo de hace mas de 3 dias se borra: la llave lleva el dia
function nxaPodar(){
  if(typeof caches === 'undefined') return;
  var corte = NX_AVISOS.diaMas(localDateStr(), -3);
  caches.open(NXA_CACHE).then(function(c){
    return c.keys().then(function(ks){
      ks.forEach(function(rq){
        var k = decodeURIComponent(String(rq.url).split('/nxa/')[1] || ''), dia = k.split('|')[1] || '';
        if(/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia < corte) c.delete(rq);
      });
    });
  }).catch(function(){});
}

// Muestra la notificacion por el service worker (asi la toca el telefono
// aunque la pantalla este apagada); sin service worker, la del navegador
function nxaMostrarYa(a){
  var opts = {body:a.body || '', tag:a.tag || 'nx', renotify:true, icon:'assets/nexora-icon-192.png',
              vibrate:[200, 100, 200], data:{k:a.k || '', screen:a.screen || '', mod:a.mod || ''}};
  var sw = navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.ready : null;
  var p = sw ? sw.then(function(reg){ return reg.showNotification(a.title, opts); })
             : Promise.resolve().then(function(){ new Notification(a.title, opts); });
  return p.catch(function(){});
}
function nxaMostrar(a){
  return nxaVisto(a.k).then(function(v){
    if(v) return;
    return nxaMarcar(a.k).then(function(){ return nxaMostrarYa(a); });
  });
}

// ------------------------------------------------------------------
// Con la app abierta: cada minuto
// ------------------------------------------------------------------
function nxaPendientes(ahora){
  var p = nxaPrefs(), cfg = nxaCfg(), d = ahora || new Date();
  var ctx = NX_AVISOS.turnoActual(localDateStr(d), d.getHours() * 60 + d.getMinutes(), cfg);
  if(!ctx || p.shifts.indexOf(ctx.shift) < 0) return [];
  var db = getDB() || {};
  return NX_AVISOS.pendientes({weights:db.weights, temps:db.temps, gmps:db.gmps, preop:db.preop,
                               metal:db.metal, runs:db.runs}, ctx, cfg)
    .filter(function(a){ return p.alerts[a.tipo] !== false; });
}
function nxaRevisar(){
  var p = nxaPrefs();
  if(!p.on || typeof currentUser === 'undefined' || !currentUser || !nxaSoporta() || Notification.permission !== 'granted') return;
  nxaPendientes().forEach(nxaMostrar);
}
function nxaArrancar(){
  if(nxaTimer) return;
  nxaPodar();
  nxaTimer = setInterval(nxaRevisar, 60000);
  setTimeout(nxaRevisar, 4000);
}

// ------------------------------------------------------------------
// Con la app cerrada: la suscripcion push (la llave publica la da el servidor)
// ------------------------------------------------------------------
function nxaB64(s){
  var b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  b += '===='.slice((b.length % 4) || 4);
  var raw = atob(b), out = new Uint8Array(raw.length);
  for(var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function nxaMismaLlave(sub, llave){
  var k = sub && sub.options && sub.options.applicationServerKey;
  if(!k) return false;
  var a = new Uint8Array(k);
  if(a.length !== llave.length) return false;
  for(var i = 0; i < a.length; i++) if(a[i] !== llave[i]) return false;
  return true;
}
function nxaId(endpoint){
  if(!(window.crypto && crypto.subtle)) return Promise.resolve(String(endpoint).replace(/[^A-Za-z0-9]/g, '').slice(-40));
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)).then(function(h){
    return Array.prototype.map.call(new Uint8Array(h), function(x){ return ('0' + x.toString(16)).slice(-2); }).join('').slice(0, 40);
  });
}
function nxaSubirSub(sub, p){
  if(typeof window.nxGuardarPushSub !== 'function' || typeof currentUser === 'undefined' || !currentUser) return Promise.resolve();
  return window.nxGuardarPushSub(p.subId, {
    sub: sub.toJSON(), op: String(currentUser.id), name: currentUser.name || '',
    shifts: p.shifts, alerts: p.alerts, active: true,
    ua: String(navigator.userAgent || '').slice(0, 160), updatedAt: new Date().toISOString()
  });
}
function nxaSuscribir(){
  var p = nxaPrefs();
  if(!nxaSoportaPush()){ p.push = false; nxaGuardar(p); return Promise.resolve(false); }
  var reg;
  return navigator.serviceWorker.ready.then(function(r){
    reg = r;
    return fetch(NXA_KEY_URL).then(function(x){ if(!x.ok) throw new Error('key ' + x.status); return x.json(); });
  }).then(function(j){
    if(!j || !j.publicKey) throw new Error('sin llave');
    var llave = nxaB64(j.publicKey);
    return reg.pushManager.getSubscription().then(function(sub){
      if(sub && !nxaMismaLlave(sub, llave)) return sub.unsubscribe().then(function(){ return null; });
      return sub;
    }).then(function(sub){
      return sub || reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:llave});
    });
  }).then(function(sub){
    return nxaId(sub.endpoint).then(function(id){
      p = nxaPrefs(); p.subId = id; p.push = true; nxaGuardar(p);
      return nxaSubirSub(sub, p);
    });
  }).then(function(){ return true; }).catch(function(){
    p = nxaPrefs(); p.push = false; nxaGuardar(p);
    return false;
  });
}
// Cambio de turno o de avisos: el servidor tiene que saberlo
function nxaSincronizar(){
  var p = nxaPrefs();
  if(!p.on || !p.push || !nxaSoportaPush()) return;
  navigator.serviceWorker.ready.then(function(reg){ return reg.pushManager.getSubscription(); })
    .then(function(sub){ if(sub) return nxaSubirSub(sub, p); }).catch(function(){});
}

// ------------------------------------------------------------------
// Prender, apagar y escoger
// ------------------------------------------------------------------
function nxaPrender(){
  if(!nxaSoporta()){ toast('This browser has no notifications'); return; }
  if(Notification.permission === 'denied'){ toast('Notifications are blocked for this app in the browser settings'); nxaRepintar(); return; }
  var pide = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
  pide.then(function(perm){
    if(perm !== 'granted'){ nxaRepintar(); return; }
    var p = nxaPrefs(); p.on = true; nxaGuardar(p);
    nxaRepintar();
    nxaArrancar();
    return nxaSuscribir().then(function(push){
      nxaRepintar();
      nxaMostrarYa({title:'Notifications are on', tag:'nx-on',
        body: push ? 'You will get alerts even with the app closed.' : 'You will get alerts while the app is open.'});
    });
  });
}
function nxaApagar(){
  var p = nxaPrefs(), id = p.subId;
  p.on = false; p.push = false; p.subId = ''; nxaGuardar(p);
  nxaRepintar();
  if(nxaSoportaPush()){
    navigator.serviceWorker.ready.then(function(reg){ return reg.pushManager.getSubscription(); })
      .then(function(sub){ if(sub) return sub.unsubscribe(); }).catch(function(){});
  }
  if(id && typeof window.nxBorrarPushSub === 'function') window.nxBorrarPushSub(id);
}
function nxaTurno(v){
  var p = nxaPrefs();
  p.shifts = v === 'both' ? ['1', '2'] : [v];
  nxaGuardar(p); nxaRepintar(); nxaSincronizar();
}
function nxaTipo(k){
  var p = nxaPrefs();
  p.alerts[k] = !p.alerts[k];
  nxaGuardar(p); nxaRepintar(); nxaSincronizar();
}
function nxaPrueba(){
  if(!nxaSoporta() || Notification.permission !== 'granted'){ toast('Turn notifications on first'); return; }
  nxaMostrarYa({title:'Test notification', body:'Alerts will look like this.', tag:'nx-test'});
}

// El administrador pone las horas de los turnos para todos
function nxaGuardarHoras(){
  var v = function(id){ var e = document.getElementById(id); return e ? e.value : ''; };
  var h = {shifts:{'1':{start:v('nxa-1s'), end:v('nxa-1e')}, '2':{start:v('nxa-2s'), end:v('nxa-2e')}}};
  var bien = ['1', '2'].every(function(s){ return NX_AVISOS.hm(h.shifts[s].start) != null && NX_AVISOS.hm(h.shifts[s].end) != null; });
  if(!bien){ toast('Enter the start and end of both shifts'); return; }
  var db = getDB();
  db.reminders = Object.assign({}, db.reminders || {}, h);
  saveDB(db);
  if(typeof window.nxGuardarAvisosCfg === 'function') window.nxGuardarAvisosCfg(db.reminders);
  if(typeof logActivity === 'function') logActivity('admin', 'Shift hours for alerts',
    '1st '+h.shifts['1'].start+'–'+h.shifts['1'].end+' · 2nd '+h.shifts['2'].start+'–'+h.shifts['2'].end, currentUser ? currentUser.name : '—');
  if(typeof cbtnSaved === 'function') cbtnSaved('nxa-horas-btn');
  toast('Shift hours saved');
}

// ------------------------------------------------------------------
// La ventana (menu del usuario > Notifications)
// ------------------------------------------------------------------
function nxaEstado(p){
  if(!nxaSoporta()) return 'This browser has no notifications. On iPhone, add the app to the Home Screen first (Share › Add to Home Screen) and open it from the icon.';
  if(Notification.permission === 'denied') return 'Blocked in this browser. Allow notifications for this site in its settings, then come back.';
  if(!p.on) return 'Off';
  return p.push ? 'On · they arrive even with the app closed' : 'On · while the app is open';
}
function nxaCuerpo(){
  var p = nxaPrefs(), cfg = nxaCfg();
  var turno = p.shifts.length > 1 ? 'both' : p.shifts[0];
  var seg = function(v, txt){
    return '<button type="button" class="seg'+(turno === v ? ' on' : '')+'" onclick="nxaTurno(\''+v+'\')">'+txt+'</button>';
  };
  var admin = typeof canSeeModule === 'function' && canSeeModule('admin');
  var hora = function(id, val){ return '<input type="time" class="field" id="'+id+'" value="'+esc(val)+'">'; };
  return '<div class="nxa'+(p.on ? '' : ' nxa-off')+'">'+
    '<div class="nxa-row">'+
      '<div class="nxa-head"><span class="nxa-bell" data-icon="bell"></span>'+
        '<div><b>Alerts on this device</b><div class="nxa-st">'+esc(nxaEstado(p))+'</div></div></div>'+
      '<button type="button" class="nxa-sw'+(p.on ? ' on' : '')+'" role="switch" aria-checked="'+p.on+'" '+
        'aria-label="Alerts on this device" onclick="'+(p.on ? 'nxaApagar()' : 'nxaPrender()')+'"></button>'+
    '</div>'+
    '<div class="nxa-opts">'+
      '<div><div class="nxa-lbl">Shift</div><div class="segmented">'+seg('1', '1st')+seg('2', '2nd')+seg('both', 'Both')+'</div></div>'+
      '<div><div class="nxa-lbl">What to remind</div><div class="nxa-chips">'+
        NXA_TIPOS.map(function(t){
          var on = p.alerts[t[0]];
          return '<button type="button" class="nxa-chip'+(on ? ' on' : '')+'" style="--c:'+t[3]+'" aria-pressed="'+on+'" '+
            'onclick="nxaTipo(\''+t[0]+'\')"><span data-icon="'+t[2]+'"></span>'+t[1]+'</button>';
        }).join('')+
      '</div></div>'+
    '</div>'+
    '<div class="nxa-row nxa-pie">'+
      '<button type="button" class="nxa-q" aria-expanded="false" onclick="var h=this.closest(\'.nxa\').querySelector(\'.nxa-help\');h.hidden=!h.hidden;this.setAttribute(\'aria-expanded\',String(!h.hidden))">?</button>'+
      (typeof recIco === 'function' ? recIco('nxaPrueba()', 'bell', 'Send a test') : '')+
    '</div>'+
    '<div class="nxa-help" hidden>'+
      '<p><b>Weights</b> · every hour on each line that is running; at 1 h 15 min it is late.</p>'+
      '<p><b>Temperatures</b> · beginning, middle and end of the shift.</p>'+
      '<p><b>GMP audit</b> · one per shift.</p>'+
      '<p><b>Metal detector</b> · once a week for each line that ran (it knows from the weights).</p>'+
      '<p><b>Pre-Op</b> · every day, Monday to Saturday.</p>'+
      '<p class="soft">Each phone chooses its own shift and alerts. On iPhone the app must be on the Home Screen.</p>'+
    '</div>'+
    (admin ?
      '<div class="nxa-adm"><div class="nxa-lbl">Shift hours · for everyone</div>'+
        '<div class="nxa-horas">'+
          '<span>1st</span>'+hora('nxa-1s', cfg.shifts['1'].start)+hora('nxa-1e', cfg.shifts['1'].end)+
          '<span>2nd</span>'+hora('nxa-2s', cfg.shifts['2'].start)+hora('nxa-2e', cfg.shifts['2'].end)+
        '</div>'+
        '<button type="button" class="cbtn cbtn-primary" id="nxa-horas-btn" onclick="nxaGuardarHoras()"><span class="cb-lbl">Save hours</span></button>'+
      '</div>' : '')+
  '</div>';
}
function nxaAbrir(){
  var m = document.getElementById('user-menu'); if(m) m.classList.remove('open');
  openRecordModal('Notifications', '<div id="nxa-host">'+nxaCuerpo()+'</div>', '');
}
function nxaRepintar(){
  var h = document.getElementById('nxa-host');
  if(!h) return;
  h.innerHTML = nxaCuerpo();
  if(typeof renderIcons === 'function') renderIcons(h);
}

// ------------------------------------------------------------------
// Tocar la notificacion abre su pantalla
// ------------------------------------------------------------------
function nxaIr(screen, mod){
  if(!screen) return;
  if(typeof currentUser === 'undefined' || !currentUser){ nxaPendiente = {screen:screen, mod:mod}; return; }
  if(typeof canSeeScreen === 'function' && !canSeeScreen(screen, currentUser, mod || undefined)) return;
  if(typeof snavGo === 'function' && mod) snavGo(mod, screen); else goTo(screen);
}
(function(){
  try{
    var q = new URLSearchParams(location.search), go = q.get('go');
    if(go && /^screen-[a-z]+$/.test(go)){
      nxaPendiente = {screen:go, mod:q.get('mod') || ''};
      q.delete('go'); q.delete('mod');
      var resto = q.toString();
      history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    }
  }catch(e){}
})();

// Al entrar: si este equipo tiene los avisos prendidos, arrancan; y si la
// app se abrio tocando una notificacion, se va a su pantalla
function nxaDespuesDeEntrar(){
  var p = nxaPrefs();
  if(p.on && nxaSoporta() && Notification.permission !== 'granted'){ p.on = false; p.push = false; nxaGuardar(p); }
  if(p.on){ nxaArrancar(); if(p.push) nxaSuscribir(); }
  if(nxaPendiente){ var x = nxaPendiente; nxaPendiente = null; setTimeout(function(){ nxaIr(x.screen, x.mod); }, 300); }
}
