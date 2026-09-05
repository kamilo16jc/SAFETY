// ===== LOGIN =====
var currentUser = null;
var adminRole = 'operator';

function getOperators() {
  var db = getDB();
  return db.operators || [];
}
function saveOperators(ops) {
  var db = getDB();
  db.operators = ops;
  saveDB(db);
  // Sync each operator to Firebase
  if(window.saveOperatorsToFirebase) window.saveOperatorsToFirebase(ops);
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
  var ops = getOperators();
  if(!ops.length) {
    // First run on a fresh device: create a local default admin (admin / admin123).
    // Local only — never pushed to Firebase, so a fresh browser can't overwrite real users.
    hashPassword('admin','admin123').then(function(h){
      var db = getDB();
      if(db.operators && db.operators.length) return; // Firebase sync won the race
      db.operators = [{id:Date.now(), name:'Administrator', username:'admin', email:'', passHash:h, role:'admin'}];
      saveDB(db);
    });
  }
  var u = document.getElementById('login-user');
  var p = document.getElementById('login-pass');
  var err = document.getElementById('login-error');
  if(u) { u.value=''; u.onkeydown = function(e){ if(e.key==='Enter') p.focus(); }; }
  if(p) { p.value=''; p.onkeydown = function(e){ if(e.key==='Enter') doLogin(); }; }
  if(err) err.style.display = 'none';
}

function showLoginError(msg) {
  var err = document.getElementById('login-error');
  if(err) { err.textContent = msg; err.style.display = 'block'; }
}

function doLogin() {
  var id = (document.getElementById('login-user').value||'').trim().toLowerCase();
  var pass = document.getElementById('login-pass').value||'';
  if(!id || !pass) { showLoginError('Enter your username and password'); return; }

  var ops = getOperators();
  var op = ops.find(function(o){
    return (o.username && o.username.toLowerCase()===id) ||
           (o.email && o.email.toLowerCase()===id) ||
           (o.name && o.name.toLowerCase()===id);
  });
  if(!op) { showLoginError('User not found'); return; }

  var finish = function(ok){
    if(ok) {
      document.getElementById('login-pass').value = '';
      currentUser = op;
      loginSuccess();
    } else {
      showLoginError('Incorrect password');
    }
  };

  if(op.passHash) {
    verifyPassword(op, pass).then(function(res){
      if(res==='upgrade'){
        // Hash viejo válido: se re-guarda con PBKDF2 (best-effort, no bloquea)
        hashPasswordSecure(pass).then(function(nh){
          try {
            var ops2 = getOperators();
            var t = ops2.find(function(o){ return o.id===op.id; });
            if(t){ t.passHash = nh; saveOperators(ops2); }
          } catch(e){}
        });
      }
      finish(res==='ok' || res==='upgrade');
    });
  } else if(op.pin) {
    // Legacy operator (created in the PIN era): PIN works as password
    // until an admin sets a real one in the Admin panel.
    finish(pass===op.pin);
  } else {
    finish(false);
  }
}

function loginSuccess() {
  // Update user badge
  setDrawerUser();
  logActivity('login','User logged in','Role: '+currentUser.role, currentUser.name);
  startCheckTimer();

  // Show admin card only for admins
  var adminCard = document.getElementById('admin-card');
  if(adminCard) adminCard.style.display = currentUser.role==='admin' ? 'flex' : 'none';

  goTo('screen-home');
}

function logoutUser() {
  if(!confirm('Log out of the app?')) return;
  if(currentUser) logActivity('login','User logged out','', currentUser.name);
  currentUser = null;
  initTheme();
  setupPWA();
  // Register service worker for PWA
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.log('SW:', e); });
  }
  goTo('screen-login');
  initLogin();
}
