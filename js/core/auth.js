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

// SHA-256 hash: salted with the username so equal passwords produce different hashes
function hashPassword(username, password) {
  var data = new TextEncoder().encode(String(username).toLowerCase()+':'+password+':safetyQC');
  return crypto.subtle.digest('SHA-256', data).then(function(buf){
    return Array.prototype.map.call(new Uint8Array(buf), function(b){
      return ('0'+b.toString(16)).slice(-2);
    }).join('');
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
    hashPassword(op.username||op.name, pass).then(function(h){ finish(h===op.passHash); });
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
  document.getElementById('user-badge').textContent = '👤 ' + currentUser.name;
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
