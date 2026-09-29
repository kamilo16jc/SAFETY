// ===== USUARIOS Y ACCESOS =====
// Aqui se dan de alta las personas y se decide que ve cada una. El rol es solo
// el punto de partida: encima de el, a cada usuario se le puede marcar modulo
// por modulo y funcion por funcion, y ademas si puede cambiar lo ya guardado,
// borrar o firmar. Lo que se marca aqui manda sobre el rol.
var accUser = null;        // usuario que se esta configurando

function setRole(btn) {
  adminRole = btn.getAttribute('data-role');
  document.querySelectorAll('#admin-roles [data-role]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var h = document.getElementById('admin-role-hint');
  if(h) h.textContent = roleSummary(adminRole);
}

// Lo que trae el rol de fabrica, en una linea
function roleSummary(role){
  var mods = (ROLE_MODULES[role] || []).map(function(id){
    var m = moduleById(id); return m ? m.name : id;
  });
  var p = ROLE_PERMS[role] || {};
  var puede = [];
  if(p.edit) puede.push('change saved records');
  if(p.remove) puede.push('delete');
  if(p.approve) puede.push('approve forms');
  return mods.join(', ') + (puede.length ? ' · can ' + puede.join(', ') : '');
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

  var rol = adminRole;
  hashPassword(username, pass).then(function(h){
    // Sin marcar nada, el usuario entra con lo que trae su rol
    ops.push({id:newRecordId(), name:name, username:username, email:email, passHash:h,
              role:rol, createdAt:localDateStr()});
    saveOperators(ops);

    document.getElementById('admin-name').value = '';
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-pass').value = '';
    adminRole = 'operator';
    document.querySelectorAll('#admin-roles [data-role]').forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('role-operator').classList.add('active');

    logActivity('admin','User created', name+' · '+rol, currentUser?currentUser.name:'—');
    initAdmin();
    toast('User added');
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
    toast('Password updated');
  });
}

function deleteOperator(id) {
  var op = getOperators().filter(function(o){ return o.id===id; })[0];
  if(currentUser && currentUser.id===id){ toast('You cannot delete yourself'); return; }
  if(!confirm('Delete this user?')) return;
  saveOperators(getOperators().filter(function(o){return o.id!==id}));
  if(op) logActivity('admin','User deleted', op.name, currentUser?currentUser.name:'—');
  if(accUser && accUser.id===id) accUser = null;
  initAdmin();
  toast('User deleted');
}

// ---- La lista ----
function initAdmin() {
  // Solo quien tenga el modulo de administrador
  if(!currentUser || !canSeeModule('admin')) {
    toast('Admin access only');
    goTo('screen-home');
    return;
  }
  var h = document.getElementById('admin-role-hint');
  if(h) h.textContent = roleSummary(adminRole);

  var ops = getOperators();
  var host = document.getElementById('operators-list');
  if(!host) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>User</th><th>Role</th>'+
      '<th class="wide">Sees and can do</th><th></th><th></th><th></th>'+
    '</tr></thead><tbody>'+
    (ops.length ? ops.map(function(op, i){ return adminRowHTML(op, i+1); }).join('')
                : '<tr><td colspan="7" class="sheet-empty" style="border:0">No users yet</td></tr>')+
    '</tbody></table></div>';
  renderIcons(host);
  renderAccessPanel();
}

function adminRowHTML(op, i){
  var entra = op.username ? '@'+esc(op.username) : 'PIN';
  if(op.email) entra += ' · '+esc(op.email);
  if(!op.passHash && op.pin) entra += ' · PIN';
  var yo = currentUser && currentUser.id===op.id;
  return '<tr'+(accUser && accUser.id===op.id ? ' class="done"' : '')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td><b>'+esc(op.name)+'</b>'+(yo?' <span class="soft">(you)</span>':'')+
      '<div class="soft">'+entra+'</div></td>'+
    '<td>'+esc(op.role)+'</td>'+
    '<td class="wide soft">'+esc(accessSummary(op))+'</td>'+
    '<td><button class="sheet-btn" onclick="openAccess('+op.id+')">Access</button></td>'+
    '<td><button class="sheet-btn" onclick="resetPassword('+op.id+')">Password</button></td>'+
    '<td><button class="run-del" onclick="deleteOperator('+op.id+')" title="Delete">'+
      '<span data-icon="close"></span></button></td>'+
  '</tr>';
}

// Lo que ve y lo que puede, resumido para la lista
function accessSummary(op){
  var mods = userModules(op).map(function(id){
    var m = moduleById(id); return m ? m.name : id;
  });
  var txt = mods.length ? mods.join(', ') : 'nothing';
  if(op.screens && op.screens.length){
    var total = 0;
    MODULES.forEach(function(m){
      if(userModules(op).indexOf(m.id)<0) return;
      m.items.forEach(function(it){ if(!it.soon) total++; });
    });
    txt += ' · '+op.screens.length+' of '+total+' functions';
  }
  var puede = [];
  if(hasPerm('edit', op)) puede.push('edit');
  if(hasPerm('remove', op)) puede.push('delete');
  if(hasPerm('approve', op)) puede.push('approve');
  return txt + (puede.length ? ' · '+puede.join('/') : '');
}

// ---- El panel de accesos ----
function openAccess(id){
  accUser = getOperators().filter(function(o){ return o.id===id; })[0] || null;
  initAdmin();
  var p = document.getElementById('admin-access');
  if(p) p.scrollIntoView({block:'nearest'});
}
function closeAccess(){ accUser = null; initAdmin(); }

function renderAccessPanel(){
  var p = document.getElementById('admin-access');
  if(!p) return;
  if(!accUser){ p.innerHTML = ''; return; }
  var u = accUser;
  var mods = userModules(u);
  var screens = (u.screens && u.screens.length) ? u.screens : null;

  var bloques = MODULES.map(function(m){
    var on = mods.indexOf(m.id) >= 0;
    var items = m.items.filter(function(it){ return !it.soon; }).map(function(it){
      var marcado = on && (!screens ||
        screens.indexOf(m.id+':'+it.screen) >= 0 || screens.indexOf(it.screen) >= 0);
      return '<label class="acc-item"><input type="checkbox" data-screen="'+it.screen+'" '+
        'data-mod="'+m.id+'"'+(marcado?' checked':'')+' onchange="accItemChanged(this)"> '+
        esc(it.name)+'</label>';
    }).join('');
    return '<div class="acc-mod"'+(on?'':' data-off')+'>'+
      '<label class="acc-mod-head"><input type="checkbox" data-mod-head="'+m.id+'"'+
        (on?' checked':'')+' onchange="accModChanged(this)"> '+
        '<span class="acc-dot" style="background:'+m.ink+'"></span>'+esc(m.name)+'</label>'+
      '<div class="acc-items">'+items+'</div></div>';
  }).join('');

  var rol = ['operator','supervisor','admin'].map(function(r){
    return '<button class="rpt-filter-btn'+(u.role===r?' active':'')+'" data-acc-role="'+r+'" '+
           'onclick="accSetRole(this)">'+cap1Admin(r)+'</button>';
  }).join('');

  var permiso = function(k, txt, nota){
    return '<label class="acc-item"><input type="checkbox" data-perm="'+k+'"'+
      (hasPerm(k,u)?' checked':'')+'> <b>'+txt+'</b> <span class="soft">'+nota+'</span></label>';
  };

  p.innerHTML =
    '<div class="acc-panel">'+
      '<div class="acc-head"><div><b>'+esc(u.name)+'</b>'+
        (u.username?' <span class="soft">@'+esc(u.username)+'</span>':'')+
        '<div class="soft">What this person sees when they sign in</div></div>'+
        '<button class="ico-btn" onclick="closeAccess()" aria-label="Close" title="Close">'+
          '<span data-icon="close"></span></button></div>'+

      '<div class="sec-label">Role</div>'+
      '<div class="role-row" id="acc-roles">'+rol+'</div>'+
      '<div class="hint" id="acc-role-hint">'+esc(roleSummary(u.role))+'</div>'+

      '<div class="sec-label">Modules and functions</div>'+
      '<div class="acc-grid">'+bloques+'</div>'+

      '<div class="sec-label">What this person can do</div>'+
      '<div class="acc-perms">'+
        permiso('edit','Change saved records','weights, reports and times already saved') +
        permiso('remove','Delete records','removes the record for everyone') +
        permiso('approve','Approve and sign','signs the grilling cheese form') +
      '</div>'+

      '<div class="cd-actions">'+
        '<button class="main-btn" onclick="saveAccess()">Save access</button>'+
        '<button class="btn-ghost" onclick="resetAccess()">Back to role default</button>'+
      '</div>'+
    '</div>';
  renderIcons(p);
}

function cap1Admin(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

function accSetRole(btn){
  if(!accUser) return;
  accUser.role = btn.getAttribute('data-acc-role');
  document.querySelectorAll('#acc-roles [data-acc-role]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var h = document.getElementById('acc-role-hint');
  if(h) h.textContent = roleSummary(accUser.role);
}

// El modulo manda sobre sus funciones: si se apaga, se apagan todas
function accModChanged(el){
  var caja = el.closest('.acc-mod');
  caja.querySelectorAll('[data-screen]').forEach(function(c){ c.checked = el.checked; });
  if(el.checked) caja.removeAttribute('data-off'); else caja.setAttribute('data-off','');
}
// Y si se marca una funcion, su modulo tiene que estar encendido
function accItemChanged(el){
  var caja = el.closest('.acc-mod');
  var alguna = false;
  caja.querySelectorAll('[data-screen]').forEach(function(c){ if(c.checked) alguna = true; });
  var cabeza = caja.querySelector('[data-mod-head]');
  if(cabeza) cabeza.checked = alguna;
  if(alguna) caja.removeAttribute('data-off'); else caja.setAttribute('data-off','');
}

function saveAccess(){
  if(!accUser) return;
  var p = document.getElementById('admin-access');
  var mods = [], screens = [], total = 0;

  MODULES.forEach(function(m){
    var cabeza = p.querySelector('[data-mod-head="'+m.id+'"]');
    if(!cabeza || !cabeza.checked) return;
    mods.push(m.id);
    m.items.filter(function(it){ return !it.soon; }).forEach(function(it){
      total++;
      var c = p.querySelector('[data-screen="'+it.screen+'"][data-mod="'+m.id+'"]');
      if(c && c.checked) screens.push(m.id+':'+it.screen);
    });
  });

  if(!mods.length){ toast('Give this person at least one module'); return; }
  // Nadie se puede dejar a si mismo fuera del panel de usuarios
  if(currentUser && currentUser.id===accUser.id && mods.indexOf('admin')<0){
    toast('You cannot remove your own access to Administrator'); return;
  }

  var ops = getOperators();
  var u = ops.filter(function(o){ return o.id===accUser.id; })[0];
  if(!u) return;
  u.role    = accUser.role;
  u.modules = mods;
  // Si estan todas las funciones de sus modulos, no hace falta guardar la lista
  u.screens = (screens.length >= total) ? null : screens;
  u.perms   = {};
  p.querySelectorAll('[data-perm]').forEach(function(c){
    u.perms[c.getAttribute('data-perm')] = c.checked;
  });
  u.accessAt = localISOStr();
  u.accessBy = currentUser ? currentUser.name : '—';
  saveOperators(ops);

  logActivity('admin','Access updated',
    u.name+' · '+u.role+' · '+mods.length+' modules'+
    (u.screens ? ' · '+u.screens.length+' functions' : ''),
    currentUser?currentUser.name:'—');

  // Si se cambio a si mismo, el menu tiene que reflejarlo ya
  if(currentUser && currentUser.id===u.id){
    currentUser.role = u.role; currentUser.modules = u.modules;
    currentUser.screens = u.screens; currentUser.perms = u.perms;
  }
  accUser = null;
  initAdmin();
  toast('Access saved');
}

// Deja al usuario con lo que trae su rol, sin nada marcado a mano
function resetAccess(){
  if(!accUser) return;
  var ops = getOperators();
  var u = ops.filter(function(o){ return o.id===accUser.id; })[0];
  if(!u) return;
  delete u.modules; delete u.screens; delete u.perms;
  saveOperators(ops);
  if(currentUser && currentUser.id===u.id){
    delete currentUser.modules; delete currentUser.screens; delete currentUser.perms;
  }
  logActivity('admin','Access reset to role default', u.name, currentUser?currentUser.name:'—');
  accUser = null;
  initAdmin();
  toast('Back to what the role gives');
}

// Auto-fill operator initials in forms when user is logged in
// Primera letra del nombre y primera del apellido. Antes se tomaban TODAS
// las palabras, asi que "Julian Camilo Agudelo" daba JCA en vez de JA.
function getInitials(name) {
  var n = name || (currentUser ? currentUser.name : '');
  var parts = String(n).trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '';
  var first = parts[0][0];
  var last  = parts.length > 1 ? parts[parts.length-1][0] : '';
  return (first + last).toUpperCase();
}
