// ===== NAV =====
function goTo(id){
  // Redirect to login if not authenticated
  if(id !== 'screen-login' && !currentUser) { id = 'screen-login'; }
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
  document.getElementById(id).classList.add('active');
  if(id==='screen-home') initHome();
  if(id==='screen-module') renderModuleScreen();
  if(id==='screen-weight') initWeight();
  if(id==='screen-seal') initSeal();
  if(id==='screen-dashboard') initDash();
  if(id==='screen-temp') initTempScreen();
  if(id==='screen-gmp') initGmp();
  if(id==='screen-metal') initMetal();
  if(id==='screen-admin') initAdmin();
  if(id==='screen-reports') initReports();
  if(id==='screen-hold') initHold();
  if(id==='screen-activity') initActivity();
  if(id==='screen-products') initCatalog();
  if(id==='screen-lotsearch') initSearch();
  if(id==='screen-capa') initCapa();
  if(id==='screen-shift') initShift();
  if(id==='screen-production') initProduction();
  if(id==='screen-lab') initLab();
  if(id==='screen-analysis') initAnalysis();
  // Mark current screen in the drawer
  document.querySelectorAll('.d-item[data-screen]').forEach(function(b){
    b.classList.toggle('current', b.getAttribute('data-screen')===id);
  });
  // El modulo activo define el alcance de Search / Reports / Shift Report
  if(id!=='screen-login' && id!=='screen-home'){
    var m = (typeof moduleOfScreen==='function') ? moduleOfScreen(id) : null;
    if(m) activeModule = m;
  }
  if(typeof renderModuleBar==='function') renderModuleBar(id);
  updateTopbar(id);
}

// ===== BARRA DE MODULOS (reemplaza el panel lateral) =====
// Al elegir un modulo se despliegan sus funciones debajo; la pantalla activa
// queda marcada. Los modulos que el usuario no tiene no se pintan.
function selectModule(id){
  activeModule = id;
  goTo('screen-module');
}

// Las funciones del módulo, como tarjetas de su color. Al tocar una se abre
// el formulario.
function renderModuleScreen(){
  var m = moduleById(activeModule);
  var hero = document.getElementById('mod-hero');
  var grid = document.getElementById('mod-cards');
  if(!m || !grid) return;
  if(hero){
    hero.innerHTML = '<span class="mod-hero-ico" data-icon="'+m.icon+'"></span>'+
      '<div><b>'+esc(m.name)+'</b><span>'+
      m.items.filter(function(i){return !i.soon;}).length+' functions</span></div>';
    hero.style.setProperty('--mod', m.ink);
    renderIcons(hero);
  }
  grid.innerHTML = m.items.map(function(i){
    if(i.soon) return '<span class="mcard solid soon" style="--mod:'+m.ink+'">'+
      '<span class="mcard-ico" data-icon="'+i.icon+'"></span><b>'+esc(i.name)+'</b>'+
      '<span class="mcard-n">coming soon</span></span>';
    return '<button class="mcard solid" style="--mod:'+m.ink+'" onclick="goTo(\''+i.screen+'\')">'+
      '<span class="mcard-ico" data-icon="'+i.icon+'"></span><b>'+esc(i.name)+'</b></button>';
  }).join('');
  renderIcons(grid);
}

function renderModuleBar(current){
  var bar = document.getElementById('module-bar');
  if(!bar) return;
  if(!currentUser){ bar.innerHTML=''; return; }

  var mods = myModules();
  bar.innerHTML = mods.map(function(m){
    return '<button class="mod-tab'+(m.id===activeModule?' on':'')+'" style="--mod:'+m.color+'" onclick="selectModule(\''+m.id+'\')">'+
      '<span class="mod-ico" data-icon="'+m.icon+'"></span>'+esc(m.name)+'</button>';
  }).join('');

  renderIcons(bar);
}

// ===== TOPBAR (sólo visible en escritorio) =====
var CRUMBS = {
  'screen-home':     ['', 'Home'],
  'screen-module':   ['', 'Modules'],
  'screen-production':['Capture', 'Production Schedule'],
  'screen-lab':      ['Capture', 'Lab Samples'],
  'screen-analysis': ['Capture', 'Sample Analysis'],
  'screen-weight':   ['Capture', 'Weight Log'],
  'screen-seal':     ['Capture', 'Bag Seal'],
  'screen-gmp':      ['Capture', 'GMP Audit'],
  'screen-temp':     ['Capture', 'Temp & Humidity'],
  'screen-metal':    ['Capture', 'Metal Detector'],
  'screen-capa':     ['Capture', 'Incident & CAPA'],
  'screen-shift':    ['Capture', 'Shift Reports'],
  'screen-dashboard':['Review', 'Dashboard'],
  'screen-reports':  ['Review', 'Reports'],
  'screen-lotsearch':['Review', 'Search'],
  'screen-hold':     ['Review', 'Hold Cases'],
  'screen-activity': ['Review', 'Activity Log'],
  'screen-products': ['Setup', 'Products'],
  'screen-admin':    ['Setup', 'Admin']
};
function updateTopbar(id){
  // Sin sesión no hay barra lateral ni barra superior: el login ocupa la ventana
  document.body.classList.toggle('logged-out', id==='screen-login');
  var bar = document.getElementById('topbar');
  if(!bar) return;
  var c = CRUMBS[id] || ['', ''];
  var am = (typeof moduleById==='function' && activeModule) ? moduleById(activeModule) : null;
  if(am) c = [am.name, c[1]];
  var el = document.getElementById('tb-crumb');
  if(el) el.innerHTML = '<span class="tb-eyebrow">'+(c[0]||'SAFETY')+'</span><b>'+c[1]+'</b>';
  var st = document.getElementById('tb-stamp');
  if(st) st.textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})+' · Building 1945';
}

function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2500);
}

// ===== MENÚ DE USUARIO (antes iba en el pie del panel lateral) =====
function setDrawerUser(){
  if(!currentUser) return;
  var n=document.getElementById('tb-uname'); if(n) n.textContent = currentUser.name.split(' ')[0];
  var a=document.getElementById('um-name');  if(a) a.textContent = currentUser.name;
  var r=document.getElementById('um-role');  if(r) r.textContent = currentUser.role;
}
function toggleUserMenu(){
  var m=document.getElementById('user-menu'); if(!m) return;
  setDrawerUser();
  m.classList.toggle('open');
}
// Cerrar el menú al tocar fuera
document.addEventListener('click', function(e){
  var m=document.getElementById('user-menu'), b=document.getElementById('tb-user');
  if(!m || !m.classList.contains('open')) return;
  if(m.contains(e.target) || (b && b.contains(e.target))) return;
  m.classList.remove('open');
});

// ===== HOME =====
function updateDate(){
  document.getElementById('home-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}

function initHome(){
  // Saludo
  var h = new Date().getHours();
  document.getElementById('home-greet').textContent =
    h<12 ? 'Good morning' : h<18 ? 'Good afternoon' : 'Good evening';
  var first = currentUser ? currentUser.name.split(' ')[0] : '';
  first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  document.getElementById('home-name').textContent = first || 'Welcome';

  // Home = sólo los módulos a los que el usuario tiene acceso
  var ml = document.getElementById('home-modules');
  if(ml && typeof myModules==='function'){
    ml.innerHTML = myModules().map(function(m){
      var n = m.items.filter(function(i){ return !i.soon; }).length;
      return '<button class="mcard solid" style="--mod:'+m.ink+'" onclick="selectModule(\''+m.id+'\')">'+
        '<span class="mcard-ico" data-icon="'+m.icon+'"></span>'+
        '<b>'+esc(m.name)+'</b><span class="mcard-n">'+n+' functions</span></button>';
    }).join('');
    renderIcons(ml);
  }
}

function selectLine(n){
  st.line=n||null;
  document.querySelectorAll('select.line-select').forEach(function(sel){ sel.value = n?String(n):''; });
  var wl=document.getElementById('wm-line'); if(wl) wl.textContent=st.line||'—';
  var sl=document.getElementById('sm-line'); if(sl) sl.textContent=st.line||'—';
  if(window.updateDupHint) updateDupHint();
  if(window.updateSealDupHint) updateSealDupHint();
  checkReady();
}
function selectShift(n){
  st.shift=n||null;
  document.querySelectorAll('select.shift-select').forEach(function(sel){ sel.value = n?String(n):''; });
  var lbl=st.shift?(st.shift===1?'1st':'2nd'):'—';
  var ws=document.getElementById('wm-shift'); if(ws) ws.textContent=lbl;
  var ss=document.getElementById('sm-shift'); if(ss) ss.textContent=lbl;
  checkReady();
}
// Selección manual del turno: aplica y avisa si no cuadra con la hora
function onShiftPick(val){
  var n = parseInt(val)||0;
  selectShift(n);
  if(n && !shiftMatchesTime(n)) warnShiftMismatch(n);
}
function checkReady(){
  var btn=document.getElementById('start-btn');
  if(btn) btn.disabled=!(st.line&&st.shift);
}
