// ===== NAV =====
// ===== COLOR DE LA FUNCION EN TODA LA PANTALLA =====
// Cada tarjeta tiene su color. Al entrar, la pantalla completa se pinta con
// ese mismo color: titulo, flecha, botones, chips, foco y un velo suave
// arriba. En el inicio y en el login se vuelve al verde de la marca.
function accentRgb(h){
  h = String(h||'').replace('#','');
  if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h,16);
  return isNaN(n) ? null : [(n>>16)&255,(n>>8)&255,n&255];
}
// Mezcla hacia negro (t=0) o hacia blanco (t=255)
function accentMix(hex, t, amt){
  var c = accentRgb(hex); if(!c) return hex;
  var out = '#';
  for(var i=0;i<3;i++){
    var v = Math.round(c[i] + (t - c[i]) * amt);
    out += (v<16?'0':'') + v.toString(16);
  }
  return out;
}
function screenColor(id){
  var m = activeModule ? moduleById(activeModule) : null;
  var it = m ? m.items.filter(function(i){ return i.screen===id; })[0] : null;
  if(!it){
    for(var k=0;k<MODULES.length && !it;k++){
      var hit = MODULES[k].items.filter(function(i){ return i.screen===id; })[0];
      if(hit){ it = hit; m = MODULES[k]; }
    }
  }
  if(id==='screen-module') return m ? m.ink : null;
  return it ? (it.color || (m && m.ink)) : null;
}
function applyScreenAccent(id){
  var s = document.documentElement.style;
  var c = (id==='screen-home' || id==='screen-login') ? null : screenColor(id);
  if(!c){
    ['--accent','--accent-deep','--accent-tint','--tint','--mod'].forEach(function(k){
      s.removeProperty(k);
    });
    return;
  }
  // En oscuro el color de la tarjeta se aclara para que se lea sobre el fondo
  var dark = document.documentElement.getAttribute('data-theme')==='dark';
  s.setProperty('--accent',      dark ? accentMix(c,255,0.42) : c);
  s.setProperty('--accent-deep', dark ? accentMix(c,255,0.66) : accentMix(c,0,0.24));
  s.setProperty('--accent-tint', dark ? 'rgba(255,255,255,0.07)' : accentMix(c,255,0.87));
  s.setProperty('--tint',        dark ? 'rgba(255,255,255,0.035)' : accentMix(c,255,0.92));
  s.setProperty('--mod',         dark ? accentMix(c,255,0.42) : c);
}

function goTo(id){
  // Una funcion que no le toca a este usuario no se abre, ni aunque se llegue
  // por un enlace viejo o por el historial
  if(typeof canSeeScreen==='function' && typeof currentUser!=='undefined' && currentUser &&
     id!=='screen-login' && !canSeeScreen(id)){
    toast('You do not have access to that function');
    id = 'screen-home';
  }
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
  if(id==='screen-customers') initCustomers();
  if(id==='screen-addproduct') initAddProduct();
  if(id==='screen-lotsearch') initSearch();
  if(id==='screen-capa') initCapa();
  if(id==='screen-shift') initShift();
  if(id==='screen-production') initProduction();
  if(id==='screen-samplelist') initSampleList();
  if(id==='screen-lab') initLab();
  if(id==='screen-analysis') initAnalysis();
  if(id==='screen-yeast') initYeast();
  if(id==='screen-coa') initCoa();
  if(id==='screen-labresults') initLabResults();
  if(id==='screen-coastatus') initCoaStatus();
  if(id==='screen-raw') initRawSection('raw');
  if(id==='screen-dry') initRawSection('dry');
  if(id==='screen-formag') initRawSection('formag');
  if(id==='screen-rd') initRawSection('rd');
  if(id==='screen-grilling') initGrilling();
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
  // La cinta (solo escritorio) marca la funcion abierta y su pestaña
  if(typeof renderRibbon==='function'){
    var _rb = document.getElementById('ribbon');
    if(_rb && !_rb.firstChild) renderRibbon(); else if(typeof ribbonMark==='function') ribbonMark(id);
  }
  // La barra lateral marca la funcion abierta y despliega su modulo
  if(typeof renderSideNav==='function'){
    var _sn = document.getElementById('snav');
    if(_sn && !_sn.firstChild) renderSideNav();
    else if(typeof snavMark==='function') snavMark(id);
  }
  applyScreenAccent(id);
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
  // Solo las funciones que este usuario tiene permitidas EN ESTE modulo
  var items = (typeof moduleItemsFor==='function') ? moduleItemsFor(m) : m.items;
  if(hero){
    hero.innerHTML = '<button class="back-btn" onclick="goTo(\'screen-home\')">'+
      '<span class="btn-ico" data-icon="back"></span></button>'+
      '<span class="mod-hero-ico" data-icon="'+m.icon+'"></span>'+
      '<div><b>'+esc(m.name)+'</b><span>'+
      items.filter(function(i){ return !i.soon; }).length+' functions</span></div>';
    hero.style.setProperty('--mod', m.ink);
    renderIcons(hero);
  }
  grid.innerHTML = items.map(function(i){
    if(i.soon) return '<span class="mcard solid soon" style="--mod:'+(i.color||m.ink)+'">'+
      '<span class="mcard-ico" data-icon="'+i.icon+'"></span><b>'+esc(i.name)+'</b>'+
      '<span class="mcard-n">coming soon</span></span>';
    return '<button class="mcard solid" style="--mod:'+(i.color||m.ink)+'" onclick="goTo(\''+i.screen+'\')">'+
      '<span class="mcard-ico" data-icon="'+i.icon+'"></span><b>'+esc(i.name)+'</b></button>';
  }).join('');
  renderIcons(grid);
}

function renderModuleBar(){ /* la barra se eliminó: se navega por tarjetas */ }

// Volver: de un formulario al menú del módulo, y del módulo al inicio
function goBack(){
  var cur=(document.querySelector('.screen.active')||{}).id;
  if(cur==='screen-module' || !activeModule) goTo('screen-home');
  else goTo('screen-module');
}

// ===== TOPBAR (sólo visible en escritorio) =====
var CRUMBS = {
  'screen-home':     ['', 'Home'],
  'screen-module':   ['', 'Modules'],
  'screen-production':['Capture', 'Production Schedule'],
  'screen-samplelist':['Capture', 'List Samples'],
  'screen-lab':      ['Capture', 'Lab Samples'],
  'screen-analysis': ['Capture', 'Sample Analysis'],
  'screen-yeast':    ['Capture', 'Yeast & Mold'],
  'screen-raw':      ['Capture', 'Raw Analysis'],
  'screen-dry':      ['Capture', 'Dry 1935'],
  'screen-formag':   ['Capture', 'Formag'],
  'screen-rd':       ['Capture', 'R&D'],
  'screen-grilling': ['Capture', 'Grilling Cheese'],
  'screen-coa':      ['COA', 'COA Generator'],
  'screen-labresults':['COA', 'Lab Results'],
  'screen-coastatus':['COA', 'Status'],
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
  'screen-products': ['Setup', 'Product Catalog'],
  'screen-customers': ['Setup', 'Customers'],
  'screen-addproduct':['Setup', 'Create Product'],
  'screen-admin':    ['Setup', 'Admin']
};
// ===== EL SALUDO DE LA MARCA =====
// Se enciende al entrar: tapa la pantalla mientras el inicio se arma detras,
// y se retira solo. Si el equipo pidio menos movimiento, apenas se asoma.
function playSplash(){
  var sp = document.getElementById('splash');
  if(!sp) return;
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  sp.classList.remove('gone');
  sp.classList.add('on');
  setTimeout(function(){
    sp.classList.add('gone');
    setTimeout(function(){ sp.classList.remove('on'); sp.classList.remove('gone'); }, 460);
  }, quieto ? 260 : 1900);
}

function updateTopbar(id){
  // Sin sesión no hay barra lateral ni barra superior: el login ocupa la ventana
  document.body.classList.toggle('logged-out', id==='screen-login');
  var bar = document.getElementById('topbar');
  if(!bar) return;
  var c = CRUMBS[id] || ['', ''];
  var am = (typeof moduleById==='function' && activeModule) ? moduleById(activeModule) : null;
  if(am) c = [am.name, c[1]];
  var el = document.getElementById('tb-crumb');
  if(el) el.innerHTML = (c[0] ? '<span class="tb-eyebrow">'+c[0]+'</span>' : '')+
                        '<b>'+c[1]+'</b>';
  var st = document.getElementById('tb-stamp');
  if(st){
    var now = new Date();
    st.innerHTML = '<b>'+now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</b>'+
      '<span>'+now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</span>';
  }
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
  var iv=document.getElementById('tb-init');
  if(iv) iv.textContent = currentUser.name.split(' ').map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();
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
  updateTopbar((document.querySelector('.screen.active')||{}).id||'screen-home');
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

  // Con la cinta el inicio no es un menu: las funciones ya estan arriba, asi
  // que aqui va lo que falta hoy y donde estabas. Sin cinta, las tarjetas.
  var conCinta = (typeof renderRibbonStart === 'function') && renderRibbonStart();
  var ml = document.getElementById('home-modules');
  if(conCinta){ if(ml) ml.innerHTML = ''; return; }
  if(ml && typeof myModules==='function'){
    ml.innerHTML = myModules().map(function(m){
      var n = ((typeof moduleItemsFor==='function') ? moduleItemsFor(m) : m.items)
                .filter(function(i){ return !i.soon; }).length;
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
