// ===== LOGIN =====
var currentUser = null;
var adminRole = 'operator';

function getOperators() {
  var db = getDB();
  return db.operators || [];
}
// Lo que decide que alguien tenga que volver a entrar: rol, funciones, contraseña
function nxHuellaOps(list){
  var m = {};
  (list || []).forEach(function(o){ if(o) m[o.id] = JSON.stringify([o.role, o.screens || [], o.passHash || '', o.pin || '']); });
  return m;
}
function saveOperators(ops) {
  // La lista de usuarios con contraseñas solo la tiene el administrador con
  // sesion (js/core/firebase.js). Guardar sin ella borraria las contraseñas de
  // todos: sin la lista completa no se guarda.
  if(!window.NEXORA_DESIGN_LOCAL && window._opsFull !== true){
    toast('Connect to the internet and sign in again to change users');
    return false;
  }
  var db = getDB();
  // Lo que habia guardado (las pantallas de Admin cambian la lista en el sitio,
  // asi que se compara contra la ultima version guardada, no contra db.operators)
  var antes = window._opsHuella || nxHuellaOps(db.operators);
  db.operators = ops;
  saveDB(db);
  if(window.saveOperatorsToFirebase) window.saveOperatorsToFirebase(ops);
  // A quien se le cambio el rol, las funciones o la contraseña (o se borro)
  // se le quita la entrada al momento: vuelve a entrar con lo nuevo
  var ahora = nxHuellaOps(ops);
  window._opsHuella = ahora;
  if(window.revokeAccess){
    Object.keys(antes).forEach(function(id){
      if(currentUser && String(currentUser.id) === String(id)) return;
      if(ahora[id] !== antes[id]) window.revokeAccess(id);
    });
  }
  return true;
}

// ---- Hash de contraseñas ----
// Antes: un solo SHA-256. Es demasiado rápido: si los hashes se filtran, se
// prueban miles de millones por segundo. Ahora se usa PBKDF2-SHA256 con 150k
// iteraciones y sal aleatoria por usuario, que hace la fuerza bruta lenta.
// Formato guardado: "pbkdf2$<iter>$<salHex>$<hashHex>". Los hashes viejos
// (SHA-256 hex de 64 chars) se siguen aceptando y se re-hashean al entrar.
var PBKDF2_ITER = 150000;

function _hex(buf){
  return Array.prototype.map.call(new Uint8Array(buf), function(b){
    return ('0'+b.toString(16)).slice(-2);
  }).join('');
}
function _bytesFromHex(hex){
  var a = new Uint8Array(hex.length/2);
  for(var i=0;i<a.length;i++) a[i] = parseInt(hex.substr(i*2,2),16);
  return a;
}

// Hash moderno con sal aleatoria; devuelve la cadena completa a guardar
function hashPasswordSecure(password, saltHex){
  var salt = saltHex ? _bytesFromHex(saltHex)
                     : crypto.getRandomValues(new Uint8Array(16));
  var sHex = saltHex || _hex(salt.buffer);
  return crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)),
      {name:'PBKDF2'}, false, ['deriveBits'])
    .then(function(key){
      return crypto.subtle.deriveBits(
        {name:'PBKDF2', salt:salt, iterations:PBKDF2_ITER, hash:'SHA-256'}, key, 256);
    })
    .then(function(bits){ return 'pbkdf2$'+PBKDF2_ITER+'$'+sHex+'$'+_hex(bits); });
}

// Esquema viejo (SHA-256 con sal = usuario), sólo para verificar hashes antiguos
function hashPasswordLegacy(username, password){
  var data = new TextEncoder().encode(String(username).toLowerCase()+':'+password+':safetyQC');
  return crypto.subtle.digest('SHA-256', data).then(_hex);
}

// Usado por Admin y por el alta de usuarios: siempre genera el esquema nuevo
function hashPassword(username, password){ return hashPasswordSecure(password); }

// PBKDF2 con sal e iteraciones dadas (para verificar un hash guardado)
function hashPBKDF2With(password, saltHex, iter){
  var salt = _bytesFromHex(saltHex);
  return crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)),
      {name:'PBKDF2'}, false, ['deriveBits'])
    .then(function(key){
      return crypto.subtle.deriveBits(
        {name:'PBKDF2', salt:salt, iterations:iter, hash:'SHA-256'}, key, 256);
    })
    .then(function(bits){ return 'pbkdf2$'+iter+'$'+saltHex+'$'+_hex(bits); });
}

// Verifica una contraseña contra el hash guardado.
// Devuelve 'ok' (hash nuevo), 'upgrade' (hash viejo válido, re-hashear) o false.
function verifyPassword(op, password){
  var stored = op.passHash || '';
  if(stored.indexOf('pbkdf2$')===0){
    var p = stored.split('$'); // ['pbkdf2', iter, salt, hash]
    return hashPBKDF2With(password, p[2], parseInt(p[1])).then(function(cand){
      return cand===stored ? 'ok' : false;
    });
  }
  return hashPasswordLegacy(op.username||op.name, password).then(function(h){
    return h===stored ? 'upgrade' : false;
  });
}

function initLogin() {
  // Ya no se crea el admin de fabrica (admin / admin123) en un equipo nuevo:
  // la contraseña la revisa el servidor, que conoce a los usuarios reales.
  var u = document.getElementById('login-user');
  var p = document.getElementById('login-pass');
  var err = document.getElementById('login-error');
  if(u) { u.value=''; u.onkeydown = function(e){ if(e.key==='Enter'){e.preventDefault();p.focus();} }; }
  if(p) { p.value=''; p.onkeydown = function(e){ if(e.key==='Enter'){e.preventDefault();doLogin();} }; }
  if(err) err.style.display = 'none';
}

function showLoginError(msg) {
  var err = document.getElementById('login-error');
  if(err) { err.textContent = msg; err.style.display = 'block'; }
}

// ===== ENTRAR (seguridad, 10 nov 2026) =====
// La contraseña la revisa el servidor (funcion safetyLogin), que devuelve un
// pase de Firebase: sin el, Firestore no deja leer ni escribir nada. Sin señal
// (o con el servidor caido) se entra con lo de ESTE equipo: la credencial de
// quien ya entro aqui con internet, solo la suya.
// ESTRENO: mientras las reglas de Firestore sigan abiertas, si el servidor de
// login no responde se entra como antes (la contraseña revisada en el equipo y
// sesion anonima): si algo falla el primer dia, nadie se queda afuera. El dia
// que se cierran las reglas esto pasa a false (ver SECURITY.md).
var NX_TRANSICION = true;
window.NX_TRANSICION = NX_TRANSICION;

var NX_LOGIN_URL = window.NEXORA_EMULATORS
  ? 'http://127.0.0.1:5001/caputo-cheese/us-central1/safetyLogin'
  : 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyLogin';

function nxCreds(){
  try { return JSON.parse(localStorage.getItem('nx_creds') || '{}') || {}; } catch(e){ return {}; }
}
function nxGuardarCred(me){
  try {
    var c = nxCreds(), cred = me.cred || {}, op = Object.assign({}, me);
    delete op.cred;
    c[String(op.id)] = {op:op, passHash:cred.passHash || '', pin:cred.pin || '', at:Date.now()};
    localStorage.setItem('nx_creds', JSON.stringify(c));
  } catch(e){}
}
function nxCredDe(id){
  var c = nxCreds(), k = Object.keys(c);
  for(var i=0;i<k.length;i++){
    var o = (c[k[i]] || {}).op || {};
    if((o.username && String(o.username).toLowerCase()===id) ||
       (o.email && String(o.email).toLowerCase()===id) ||
       (o.name && String(o.name).toLowerCase()===id)) return c[k[i]];
  }
  return null;
}
// La lista de usuarios de este equipo: sin contraseñas (la completa solo la
// recibe el administrador, js/core/firebase.js)
function nxPonerEquipo(staff){
  if(!staff || !staff.length || window._opsFull === true) return;
  var db = getDB();
  db.operators = staff;
  saveDB(db);
}
function nxLoginServidor(id, pass){
  var ctl = window.AbortController ? new AbortController() : null;
  var t = ctl ? setTimeout(function(){ ctl.abort(); }, 25000) : null;    // primera vez del dia: ~5-10 s
  return fetch(NX_LOGIN_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username:id, password:pass}), signal: ctl ? ctl.signal : undefined
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; });
  }).catch(function(){ return {ok:false, error:'offline', status:0}; })
    .then(function(j){ if(t) clearTimeout(t); return j; });
}
// Contraseña contra una credencial guardada (hash PBKDF2/viejo, o PIN)
function nxVerificarLocal(c, pass){
  if(!c) return Promise.resolve(false);
  if(c.passHash) return verifyPassword({passHash:c.passHash, username:c.op && c.op.username, name:c.op && c.op.name}, pass)
    .then(function(r){ return r === 'ok' || r === 'upgrade'; });
  return Promise.resolve(!!c.pin && String(pass) === String(c.pin));
}

function doLogin() {
  if(window.nxLoginBusy) return;
  var id = (document.getElementById('login-user').value||'').trim().toLowerCase();
  var pass = document.getElementById('login-pass').value||'';
  if(!id || !pass) { showLoginError('Enter your username and password'); return; }

  if(typeof nxSetLoginBusy==='function') nxSetLoginBusy(true);
  var listo = function(){ if(typeof nxSetLoginBusy==='function') nxSetLoginBusy(false); };
  var entrar = function(op){
    listo();
    document.getElementById('login-pass').value = '';
    currentUser = op;
    loginSuccess();
  };
  var error = function(m){ listo(); showLoginError(m); };

  // Copia de diseño sin Firebase: los usuarios de prueba de este equipo
  if(window.NEXORA_DESIGN_LOCAL && !window.NEXORA_EMULATORS){
    var op0 = getOperators().find(function(o){
      return (o.username && o.username.toLowerCase()===id) || (o.name && o.name.toLowerCase()===id);
    });
    if(!op0) return error('Incorrect username or password');
    return nxVerificarLocal({passHash:op0.passHash, pin:op0.pin, op:op0}, pass)
      .then(function(ok){ ok ? entrar(op0) : error('Incorrect username or password'); });
  }

  // Estreno: como entraba antes, con la lista de usuarios que ya tiene el equipo
  var comoAntes = function(){
    var op0 = getOperators().find(function(o){
      return (o.username && o.username.toLowerCase()===id) || (o.email && o.email.toLowerCase()===id) ||
             (o.name && o.name.toLowerCase()===id);
    });
    if(!op0 || !(op0.passHash || op0.pin)) return error('No connection. The first time you sign in on this device you need internet.');
    nxVerificarLocal({passHash:op0.passHash, pin:op0.pin, op:op0}, pass).then(function(ok){
      if(!ok) return error('Incorrect username or password');
      if(window.nxSesionAnonima) window.nxSesionAnonima();
      entrar(op0);
    }).catch(function(){ error('Unable to sign in. Please try again.'); });
  };
  var sinRed = function(){
    var c = nxCredDe(id);
    if(!c && NX_TRANSICION) return comoAntes();
    if(!c) return error('No connection. The first time you sign in on this device you need internet.');
    nxVerificarLocal(c, pass).then(function(ok){
      if(!ok) return error('Incorrect username or password');
      entrar(c.op);
      toast('Signed in without internet. Your records sync when the connection is back.');
    }).catch(function(){ error('Unable to sign in. Please try again.'); });
  };
  if(navigator.onLine === false || typeof window.nxSignInWithToken !== 'function') return sinRed();

  nxLoginServidor(id, pass).then(function(j){
    if(j.ok && j.token){
      return window.nxSignInWithToken(j.token).then(function(){
        nxGuardarCred(j.me);
        nxPonerEquipo(j.staff);
        var op = Object.assign({}, j.me); delete op.cred;
        entrar(op);
      }, function(){ sinRed(); });
    }
    if(j.status === 401) return error('Incorrect username or password');
    if(j.status === 429) return error('Too many attempts. Wait 15 minutes and try again.');
    sinRed();     // sin red, o el servidor no responde: lo de este equipo
  });
}

// Le quitaron la entrada (el administrador cambio su usuario) o vencio: lo que
// escriba se queda en el telefono hasta que vuelva a entrar
var _nxAvisoSesion = false;
function nxSesionPerdida(){
  if(_nxAvisoSesion || !currentUser) return;
  _nxAvisoSesion = true;
  setTimeout(function(){ _nxAvisoSesion = false; }, 60000);
  if(typeof showGuardModal === 'function'){
    showGuardModal({
      icon:'lock', title:'Sign in again',
      detail:'Your access changed or expired, so this device stopped syncing. What you record stays on this device until you sign in again.',
      ask:'Sign in with your username and password to keep going.',
      primaryLabel:'Later', onPrimary:closeDupModal,
      secondaryLabel:'Sign in', onSecondary:function(){ closeDupModal(); currentUser = null; goTo('screen-login'); initLogin(); }
    });
  } else toast('Sign in again to keep syncing');
}
window.nxSesionPerdida = nxSesionPerdida;

function loginSuccess() {
  // Update user badge
  setDrawerUser();
  logActivity('login','User logged in','Role: '+currentUser.role, currentUser.name);
  startCheckTimer();

  // La barra de módulos se arma según los módulos del usuario
  activeModule = null;
  if(typeof renderModuleBar==='function') renderModuleBar(null);

  goTo('screen-home');
  if(typeof playSplash==='function') playSplash();
}

function logoutUser() {
  if(!confirm('Log out of the app?')) return;
  if(currentUser) logActivity('login','User logged out','', currentUser.name);
  currentUser = null;
  goTo('screen-login');
  initLogin();
}
