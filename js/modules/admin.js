// ===== USUARIOS Y ROLES =====
// Dos cosas viven en esta pantalla:
//
//   1. Las PERSONAS: se dan de alta y se les pone un rol.
//   2. Los ROLES: los hace el administrador, con el nombre que quiera
//      —"Supervisor Production", "QA Night"— y con casillas: que pantallas ve
//      ese rol y que puede hacer con lo ya guardado.
//
// El usuario no guarda permisos, guarda la llave de su rol. Si manana cambia
// lo que hace un supervisor de produccion, se toca el rol una vez y le cambia
// a todos los que lo tienen.
var rolEditor = null;      // rol que se esta editando (o uno nuevo sin guardar)

// ---- Alta de una persona ----
function addOperator() {
  var name = document.getElementById('admin-name').value.trim();
  var username = document.getElementById('admin-username').value.trim().toLowerCase();
  var email = document.getElementById('admin-email').value.trim().toLowerCase();
  var pass = document.getElementById('admin-pass').value;
  var rol = document.getElementById('admin-role').value;

  if(!name) { toast('Enter full name'); return; }
  if(!username || /\s/.test(username)) { toast('Username required (no spaces)'); return; }
  if(email && !/^\S+@\S+\.\S+$/.test(email)) { toast('Invalid email'); return; }
  if(pass.length < 4) { toast('Password must be at least 4 characters'); return; }
  if(!roleByKey(rol)) { toast('Pick a role'); return; }

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
    ops.push({id:newRecordId(), name:name, username:username, email:email, passHash:h,
              role:rol, createdAt:localDateStr()});
    saveOperators(ops);
    ['admin-name','admin-username','admin-email','admin-pass'].forEach(function(id){
      document.getElementById(id).value = '';
    });
    logActivity('admin','User created', name+' · '+roleName(rol), currentUser?currentUser.name:'—');
    initAdmin();
    toast('User added');
  });
}

function setUserRole(id, key){
  var ops = getOperators();
  var u = ops.filter(function(o){ return o.id===id; })[0];
  if(!u || !roleByKey(key)) return;
  // Nadie se deja a si mismo fuera del panel
  if(currentUser && currentUser.id===id){
    var r = roleByKey(key);
    var sigueEntrando = (r.screens||[]).some(function(s){ return s.indexOf('admin:')===0; });
    if(!sigueEntrando){ toast('That role cannot open this panel — pick another one'); initAdmin(); return; }
    currentUser.role = key;
  }
  u.role = key;
  saveOperators(ops);
  logActivity('admin','Role assigned', u.name+' · '+roleName(key), currentUser?currentUser.name:'—');
  initAdmin();
  toast(u.name+' is now '+roleName(key));
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
  initAdmin();
  toast('User deleted');
}

// ============================================================
// LA PANTALLA
// ============================================================
function initAdmin() {
  if(!currentUser || !canSeeModule('admin')) {
    toast('Admin access only');
    goTo('screen-home');
    return;
  }
  var sel = document.getElementById('admin-role');
  if(sel){
    var antes = sel.value;
    sel.innerHTML = getRoles().map(function(r){
      return '<option value="'+esc(r.key)+'">'+esc(r.name)+'</option>'; }).join('');
    if(antes && roleByKey(antes)) sel.value = antes;
  }
  renderUsers();
  renderRoles();
  renderRoleEditor();
}

function renderUsers(){
  var host = document.getElementById('operators-list');
  if(!host) return;
  var ops = getOperators();
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>User</th><th>Role</th>'+
      '<th class="wide">What that role gives</th><th></th><th></th>'+
    '</tr></thead><tbody>'+
    (ops.length ? ops.map(function(op,i){ return userRowHTML(op,i+1); }).join('')
                : '<tr><td colspan="6" class="sheet-empty" style="border:0">No users yet</td></tr>')+
    '</tbody></table></div>';
  renderIcons(host);
}

function userRowHTML(op, i){
  var entra = op.username ? '@'+esc(op.username) : 'PIN';
  if(!op.passHash && op.pin) entra += ' · signs in with PIN';
  var yo = currentUser && currentUser.id===op.id;
  var opciones = getRoles().map(function(r){
    return '<option value="'+esc(r.key)+'"'+(op.role===r.key?' selected':'')+'>'+esc(r.name)+'</option>';
  }).join('');
  if(!roleByKey(op.role)) opciones = '<option selected>'+esc(op.role||'—')+' (missing)</option>'+opciones;
  return '<tr>'+
    '<td class="rn">'+i+'</td>'+
    '<td><b>'+esc(op.name)+'</b>'+(yo?' <span class="soft">(you)</span>':'')+
      '<div class="soft">'+entra+'</div></td>'+
    '<td><select class="cell" onchange="setUserRole('+op.id+', this.value)">'+opciones+'</select></td>'+
    '<td class="wide soft">'+esc(roleSummary(op.role))+'</td>'+
    '<td><button class="sheet-btn" onclick="resetPassword('+op.id+')">Password</button></td>'+
    '<td><button class="run-del" onclick="deleteOperator('+op.id+')" title="Delete">'+
      '<span data-icon="close"></span></button></td>'+
  '</tr>';
}

// ---- Los roles ----
function renderRoles(){
  var host = document.getElementById('roles-list');
  if(!host) return;
  var ops = getOperators();
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Role</th><th class="num">People</th>'+
      '<th class="wide">Sees</th><th>Can</th><th></th><th></th>'+
    '</tr></thead><tbody>'+
    getRoles().map(function(r,i){
      var gente = ops.filter(function(o){ return o.role===r.key; }).length;
      return '<tr'+(rolEditor && rolEditor.key===r.key ? ' class="done"' : '')+'>'+
        '<td class="rn">'+(i+1)+'</td>'+
        '<td><b>'+esc(r.name)+'</b>'+(r.protected?' <span class="soft">(built in)</span>':'')+'</td>'+
        '<td class="num">'+gente+'</td>'+
        '<td class="wide soft">'+esc(roleModulesText(r))+'</td>'+
        '<td class="soft">'+esc(rolePermsText(r) || '—')+'</td>'+
        '<td><button class="sheet-btn" onclick="editRole(\''+esc(r.key)+'\')">Edit</button></td>'+
        '<td>'+(r.protected ? '' :
          '<button class="run-del" onclick="deleteRole(\''+esc(r.key)+'\')" title="Delete">'+
          '<span data-icon="close"></span></button>')+'</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
  renderIcons(host);
}

// Los modulos de un rol, con cuantas funciones de cada uno
function roleModulesText(r){
  var lista = r.screens || [];
  var partes = [];
  MODULES.forEach(function(m){
    var suyas = m.items.filter(function(i){
      return !i.soon && (lista.indexOf(m.id+':'+i.screen)>=0 || lista.indexOf(i.screen)>=0);
    }).length;
    if(!suyas) return;
    var total = m.items.filter(function(i){ return !i.soon; }).length;
    partes.push(m.name + (suyas<total ? ' ('+suyas+'/'+total+')' : ''));
  });
  return partes.length ? partes.join(', ') : 'nothing yet';
}
function rolePermsText(r){
  var p = r.perms || {}, out = [];
  if(p.edit) out.push('edit');
  if(p.remove) out.push('delete');
  if(p.approve) out.push('approve');
  return out.join(' / ');
}
function roleSummary(key){
  var r = roleByKey(key);
  if(!r) return 'role not found';
  var t = roleModulesText(r), p = rolePermsText(r);
  return t + (p ? ' · '+p : '');
}

// ---- El editor ----
function newRole(){
  rolEditor = {key:'', name:'', screens:[], perms:{edit:false, remove:false, approve:false}, nuevo:true};
  renderRoles(); renderRoleEditor();
  var n = document.getElementById('role-name'); if(n) n.focus();
}
function editRole(key){
  var r = roleByKey(key);
  if(!r) return;
  rolEditor = {key:r.key, name:r.name, screens:(r.screens||[]).slice(),
               perms:Object.assign({edit:false,remove:false,approve:false}, r.perms||{}),
               protected:!!r.protected};
  renderRoles(); renderRoleEditor();
  var p = document.getElementById('role-editor'); if(p) p.scrollIntoView({block:'nearest'});
}
function closeRoleEditor(){ rolEditor = null; renderRoles(); renderRoleEditor(); }

function deleteRole(key){
  var r = roleByKey(key);
  if(!r || r.protected){ toast('That role cannot be deleted'); return; }
  var gente = getOperators().filter(function(o){ return o.role===key; });
  if(gente.length){
    toast(gente.length+' '+(gente.length===1?'person has':'people have')+
          ' this role — move them first'); return;
  }
  if(!confirm('Delete the role "'+r.name+'"?')) return;
  saveRoles(getRoles().filter(function(x){ return x.key!==key; }));
  logActivity('admin','Role deleted', r.name, currentUser?currentUser.name:'—');
  if(rolEditor && rolEditor.key===key) rolEditor = null;
  initAdmin();
  toast('Role deleted');
}

function renderRoleEditor(){
  var p = document.getElementById('role-editor');
  if(!p) return;
  if(!rolEditor){ p.innerHTML = ''; return; }
  var e = rolEditor;
  var tiene = function(mid, screen){
    return e.screens.indexOf(mid+':'+screen) >= 0 || e.screens.indexOf(screen) >= 0;
  };

  var bloques = MODULES.map(function(m){
    var items = m.items.filter(function(it){ return !it.soon; });
    var on = items.some(function(it){ return tiene(m.id, it.screen); });
    var filas = items.map(function(it){
      return '<label class="acc-item"><input type="checkbox" data-screen="'+it.screen+'" '+
        'data-mod="'+m.id+'"'+(tiene(m.id,it.screen)?' checked':'')+' onchange="accItemChanged(this)"> '+
        esc(it.name)+'</label>';
    }).join('');
    return '<div class="acc-mod"'+(on?'':' data-off')+'>'+
      '<label class="acc-mod-head"><input type="checkbox" data-mod-head="'+m.id+'"'+
        (on?' checked':'')+' onchange="accModChanged(this)"> '+
        '<span class="acc-dot" style="background:'+m.ink+'"></span>'+esc(m.name)+'</label>'+
      '<div class="acc-items">'+filas+'</div></div>';
  }).join('');

  var permiso = function(k, txt, nota){
    return '<label class="acc-item"><input type="checkbox" data-perm="'+k+'"'+
      (e.perms[k]?' checked':'')+'> <b>'+txt+'</b> <span class="soft">'+nota+'</span></label>';
  };

  p.innerHTML =
    '<div class="acc-panel">'+
      '<div class="acc-head"><div>'+
        '<b>'+(e.nuevo ? 'New role' : esc(e.name))+'</b>'+
        '<div class="soft">Tick what this role sees and what it can do. '+
        'Everyone with the role gets the same.</div></div>'+
        '<button class="ico-btn" onclick="closeRoleEditor()" aria-label="Close" title="Close">'+
          '<span data-icon="close"></span></button></div>'+

      '<div class="sec-label">Role name</div>'+
      '<input type="text" class="field" id="role-name" maxlength="40" '+
        'placeholder="Supervisor Production, QA Night, Lab Tech…" value="'+esc(e.name)+'" '+
        (e.protected?'readonly ':'')+'style="max-width:420px">'+

      '<div class="sec-label">What it sees</div>'+
      '<div class="acc-grid">'+bloques+'</div>'+

      '<div class="sec-label">What it can do</div>'+
      '<div class="acc-perms">'+
        permiso('edit','Change saved records','weights, reports and times already saved') +
        permiso('remove','Delete records','removes the record for everyone') +
        permiso('approve','Approve and sign','signs the grilling cheese form') +
      '</div>'+

      '<div class="cd-actions">'+
        '<button class="main-btn" onclick="saveRoleEdit()">'+(e.nuevo?'Create role':'Save role')+'</button>'+
        '<button class="btn-ghost" onclick="closeRoleEditor()">Cancel</button>'+
      '</div>'+
    '</div>';
  renderIcons(p);
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

function saveRoleEdit(){
  if(!rolEditor) return;
  var p = document.getElementById('role-editor');
  var nombre = document.getElementById('role-name').value.trim();
  if(!nombre){ toast('Give the role a name'); return; }

  var screens = [];
  p.querySelectorAll('[data-screen]').forEach(function(c){
    if(c.checked) screens.push(c.getAttribute('data-mod')+':'+c.getAttribute('data-screen'));
  });
  if(!screens.length){ toast('Tick at least one function'); return; }

  var perms = {};
  p.querySelectorAll('[data-perm]').forEach(function(c){
    perms[c.getAttribute('data-perm')] = c.checked;
  });

  var lista = getRoles();
  var repetido = lista.filter(function(r){
    return r.key!==rolEditor.key && r.name.toLowerCase()===nombre.toLowerCase(); }).length;
  if(repetido){ toast('There is already a role with that name'); return; }

  if(rolEditor.nuevo){
    lista.push({key:roleKeyFrom(nombre), name:nombre, screens:screens, perms:perms});
    logActivity('admin','Role created', nombre, currentUser?currentUser.name:'—');
  } else {
    var r = lista.filter(function(x){ return x.key===rolEditor.key; })[0];
    if(!r) return;
    // Quien esta dentro no se puede quitar a si mismo el panel de usuarios
    var esMio = currentUser && currentUser.role===r.key;
    var abrePanel = screens.some(function(s){ return s.indexOf('admin:screen-admin')===0; });
    if(esMio && !abrePanel){
      toast('This is your own role: leave Users & Roles ticked'); return;
    }
    if(!r.protected) r.name = nombre;
    r.screens = screens;
    r.perms = perms;
    logActivity('admin','Role updated', r.name+' · '+screens.length+' functions',
      currentUser?currentUser.name:'—');
  }
  saveRoles(lista);
  rolEditor = null;
  initAdmin();
  toast('Role saved');
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
