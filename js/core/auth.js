// ===== LOGIN =====
var currentUser = null;
var selectedOperator = null;
var pinEntered = '';
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

function initLogin() {
  var ops = getOperators();
  var list = document.getElementById('operator-list');
  var noOps = document.getElementById('no-operators');
  var pinSec = document.getElementById('pin-section');

  pinSec.style.display = 'none';
  pinEntered = '';
  selectedOperator = null;

  if(!ops.length) {
    list.style.display = 'none';
    noOps.style.display = 'block';
    // Auto-create default admin on first run
    var defaultAdmin = [{name:'Admin',pin:'0000',role:'admin',id:Date.now()}];
    saveOperators(defaultAdmin);
    setTimeout(initLogin, 100);
    return;
  }

  noOps.style.display = 'none';
  list.style.display = 'block';
  list.innerHTML = ops.map(function(op){
    var roleColor = op.role==='admin'?'var(--accent)':op.role==='supervisor'?'#1a5276':'var(--muted)';
    return '<div onclick="selectOperator('+op.id+')" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s" class="operator-item">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:700">'+op.name+'</div>' +
        '<div style="font-size:10px;color:'+roleColor+';font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px">'+op.role+'</div>' +
      '</div>' +
      '<div style="font-size:20px">→</div>' +
    '</div>';
  }).join('');
}

function selectOperator(id) {
  var ops = getOperators();
  selectedOperator = ops.find(function(o){return o.id===id});
  if(!selectedOperator) return;

  document.getElementById('operator-list').style.display = 'none';
  document.getElementById('pin-section').style.display = 'block';
  document.getElementById('pin-operator-name').textContent = selectedOperator.name;
  pinEntered = '';
  renderPinPad();
}

function renderPinPad() {
  // Dots
  document.getElementById('pin-dots').innerHTML = [0,1,2,3].map(function(i){
    var filled = i < pinEntered.length;
    return '<div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--accent);background:'+(filled?'var(--accent)':'transparent')+';transition:all 0.15s"></div>';
  }).join('');

  // Pad - use data-pinkey to avoid quote conflicts
  var keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  document.getElementById('pin-pad').innerHTML = keys.map(function(k){
    if(k==='') return '<div></div>';
    var fs = (k==='⌫') ? '20px' : '22px';
    return '<button data-pinkey="'+k+'" style="padding:18px;border-radius:14px;border:1px solid var(--border);background:var(--surface);font-family:Raleway,sans-serif;font-size:'+fs+';font-weight:700;cursor:pointer;color:var(--text);transition:all 0.1s">'+k+'</button>';
  }).join('');
  document.getElementById('pin-pad').onclick = function(e){
    var btn = e.target.closest('[data-pinkey]');
    if(btn) pinPress(btn.getAttribute('data-pinkey'));
  };
}
function pinPress(key) {
  if(key === '⌫') {
    pinEntered = pinEntered.slice(0,-1);
  } else {
    if(pinEntered.length >= 4) return;
    pinEntered += key;
  }
  renderPinPad();

  if(pinEntered.length === 4) {
    setTimeout(verifyPin, 200);
  }
}

function verifyPin() {
  if(pinEntered === selectedOperator.pin) {
    currentUser = selectedOperator;
    loginSuccess();
  } else {
    // Wrong PIN - shake and reset
    pinEntered = '';
    renderPinPad();
    document.getElementById('pin-dots').style.animation = 'none';
    document.getElementById('pin-label').textContent = '✗ Wrong PIN — try again';
    document.getElementById('pin-label').style.color = 'var(--fail)';
    setTimeout(function(){
      document.getElementById('pin-label').textContent = '';
      document.getElementById('pin-label').innerHTML = 'Enter PIN for <span id="pin-operator-name" style="color:var(--accent)">'+selectedOperator.name+'</span>';
      document.getElementById('pin-label').style.color = '';
    }, 1500);
  }
}

function cancelPin() {
  document.getElementById('pin-section').style.display = 'none';
  document.getElementById('operator-list').style.display = 'block';
  pinEntered = '';
  selectedOperator = null;
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
  selectedOperator = null;
  pinEntered = '';
  initTheme();
  setupPWA();
  // Register service worker for PWA
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.log('SW:', e); });
  }
  goTo('screen-login');
  initLogin();
}

