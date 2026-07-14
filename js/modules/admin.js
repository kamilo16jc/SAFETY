// ===== ADMIN =====
function setRole(btn) {
  adminRole = btn.getAttribute('data-role');
  document.querySelectorAll('[data-role]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function addOperator() {
  var name = document.getElementById('admin-name').value.trim();
  var username = document.getElementById('admin-username').value.trim().toLowerCase();
  var email = document.getElementById('admin-email').value.trim().toLowerCase();
  var pass = document.getElementById('admin-pass').value;

  if(!name) { toast('Enter full name'); return; }
  if(!username || /\s/.test(username)) { toast('Username required (no spaces)'); return; }
  if(email && !/^\S+@\S+\.\S+$/.test(email)) { toast('Invalid email'); return; }
  if(pass.length < 4) { toast('Password must be at least 4 characters'); return; }

  var ops = getOperators();
  if(ops.find(function(o){return o.username && o.username.toLowerCase()===username})) {
    toast('Username already exists'); return;
  }
  if(email && ops.find(function(o){return o.email && o.email.toLowerCase()===email})) {
    toast('Email already registered'); return;
  }
  if(ops.find(function(o){return o.name.toLowerCase()===name.toLowerCase()})) {
    toast('User already exists'); return;
  }

  hashPassword(username, pass).then(function(h){
    ops.push({id:Date.now(), name:name, username:username, email:email, passHash:h, role:adminRole, createdAt:localDateStr()});
    saveOperators(ops);

    document.getElementById('admin-name').value = '';
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-pass').value = '';
    adminRole = 'operator';
    document.querySelectorAll('[data-role]').forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('role-operator').classList.add('active');

    initAdmin();
    toast('User added! ✓');
  });
}

function resetPassword(id) {
  var ops = getOperators();
  var op = ops.find(function(o){return o.id===id});
  if(!op) return;
  var np = prompt('New password for '+op.name+':');
  if(np===null) return;
  if(np.length < 4) { toast('Password must be at least 4 characters'); return; }
  if(!op.username) op.username = op.name.toLowerCase();
  hashPassword(op.username, np).then(function(h){
    op.passHash = h;
    saveOperators(ops);
    initAdmin();
    toast('Password updated ✓');
  });
}

function deleteOperator(id) {
  if(!confirm('Delete this user?')) return;
  var ops = getOperators().filter(function(o){return o.id!==id});
  saveOperators(ops);
  initAdmin();
  toast('User deleted');
}

function initAdmin() {
  // Only admins can access this
  if(!currentUser || currentUser.role !== 'admin') {
    toast('Admin access only');
    goTo('screen-home');
    return;
  }
  var paUrl = document.getElementById('pa-url');
  if(paUrl) paUrl.value = paGetUrl();
  paRefreshStatus();

  var ops = getOperators();
  var roleColor = function(r){ return r==='admin'?'var(--accent)':r==='supervisor'?'#1a5276':'var(--muted)'; };
  document.getElementById('operators-list').innerHTML = ops.length ?
    ops.map(function(op){
      var idLine = op.username ? '@'+op.username : 'legacy PIN user';
      if(op.email) idLine += ' · '+op.email;
      if(!op.passHash && op.pin) idLine += ' · signs in with PIN';
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<div style="min-width:0">' +
          '<div style="font-size:14px;font-weight:700">'+op.name+'</div>' +
          '<div style="font-size:10px;color:'+roleColor(op.role)+';font-weight:700;text-transform:uppercase;letter-spacing:0.1em">'+op.role+'</div>' +
          '<div style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+idLine+'</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button onclick="resetPassword('+op.id+')" style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.3);color:#2563eb;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer">Password</button>' +
          '<button onclick="deleteOperator('+op.id+')" style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.3);color:var(--fail);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('') :
    '<div class="empty">No users yet</div>';
}

// Auto-fill operator initials in forms when user is logged in
function getInitials() {
  if(!currentUser) return '';
  return currentUser.name.split(' ').map(function(n){return n[0]}).join('').toUpperCase();
}
