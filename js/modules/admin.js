// ===== ADMIN =====
function setRole(btn) {
  adminRole = btn.getAttribute('data-role');
  document.querySelectorAll('[data-role]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function addOperator() {
  var name = document.getElementById('admin-name').value.trim();
  var pin  = document.getElementById('admin-pin').value.trim();

  if(!name) { toast('Enter operator name'); return; }
  if(pin.length !== 4 || !/^\d{4}$/.test(pin)) { toast('PIN must be 4 digits'); return; }

  var ops = getOperators();
  // Check duplicate name
  if(ops.find(function(o){return o.name.toLowerCase()===name.toLowerCase()})) {
    toast('Operator already exists'); return;
  }

  ops.push({id:Date.now(), name:name, pin:pin, role:adminRole, createdAt:localDateStr()});
  saveOperators(ops);

  document.getElementById('admin-name').value = '';
  document.getElementById('admin-pin').value = '';
  adminRole = 'operator';
  document.querySelectorAll('[data-role]').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('role-operator').classList.add('active');

  initAdmin();
  toast('Operator added! ✓');
}

function deleteOperator(id) {
  if(!confirm('Delete this operator?')) return;
  var ops = getOperators().filter(function(o){return o.id!==id});
  saveOperators(ops);
  initAdmin();
  toast('Operator deleted');
}

function initAdmin() {
  // Only admins can access this
  if(!currentUser || currentUser.role !== 'admin') {
    toast('Admin access only');
    goTo('screen-home');
    return;
  }
  var ops = getOperators();
  var roleColor = function(r){ return r==='admin'?'var(--accent)':r==='supervisor'?'#1a5276':'var(--muted)'; };
  document.getElementById('operators-list').innerHTML = ops.length ?
    ops.map(function(op){
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700">'+op.name+'</div>' +
          '<div style="font-size:10px;color:'+roleColor(op.role)+';font-weight:700;text-transform:uppercase;letter-spacing:0.1em">'+op.role+' · PIN: '+op.pin.replace(/./g,'•')+'</div>' +
        '</div>' +
        '<button onclick="deleteOperator('+op.id+')" style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.3);color:var(--fail);border-radius:8px;padding:6px 12px;font-family:Raleway,sans-serif;font-size:11px;font-weight:700;cursor:pointer">Delete</button>' +
      '</div>';
    }).join('') :
    '<div class="empty">No operators yet</div>';
}

// Auto-fill operator initials in forms when user is logged in
function getInitials() {
  if(!currentUser) return '';
  return currentUser.name.split(' ').map(function(n){return n[0]}).join('').toUpperCase();
}

