// ===== NAV =====
function goTo(id){
  // Redirect to login if not authenticated
  if(id !== 'screen-login' && !currentUser) { id = 'screen-login'; }
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
  document.getElementById(id).classList.add('active');
  if(id==='screen-home') initHome();
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
  var m = moduleById(id);
  renderModuleBar(null);
  if(m && m.items.length){
    var first = m.items.filter(function(i){ return !i.soon; })[0];
    if(first) goTo(first.screen);
  }
}

function renderModuleBar(current){
  var bar = document.getElementById('module-bar');
  var sub = document.getElementById('module-sub');
  if(!bar || !sub) return;
  if(!currentUser){ bar.innerHTML=''; sub.innerHTML=''; return; }

  var mods = myModules();
  bar.innerHTML = mods.map(function(m){
    return '<button class="mod-tab'+(m.id===activeModule?' on':'')+'" style="--mod:'+m.color+'" onclick="selectModule(\''+m.id+'\')">'+
      '<span class="mod-ico" data-icon="'+m.icon+'"></span>'+esc(m.name)+'</button>';
  }).join('');

  var m = moduleById(activeModule);
  if(!m){ sub.innerHTML=''; sub.classList.remove('open'); renderIcons(bar); return; }
  sub.style.setProperty('--mod', m.ink);
  var screen = current || (document.querySelector('.screen.active')||{}).id;
  sub.innerHTML = m.items.map(function(i){
    if(i.soon) return '<span class="mod-item soon" title="Coming soon">'+
      '<span data-icon="'+i.icon+'"></span>'+esc(i.name)+'</span>';
    return '<button class="mod-item'+(i.screen===screen?' on':'')+'" onclick="goTo(\''+i.screen+'\')">'+
      '<span data-icon="'+i.icon+'"></span>'+esc(i.name)+'</button>';
  }).join('');
  sub.classList.add('open');
  renderIcons(bar); renderIcons(sub);
}

// ===== TOPBAR (sólo visible en escritorio) =====
var CRUMBS = {
  'screen-home':     ['', 'Home'],
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
  // Greeting
  var h = new Date().getHours();
  var greet = h<12 ? 'Good morning' : h<18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('home-greet').textContent = greet;
  var first = currentUser ? currentUser.name.split(' ')[0] : '';
  first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  document.getElementById('home-name').textContent = first || 'Welcome';

  // Today stats
  var db = getDB();
  var today = localDateStr();
  var isToday = function(r){ return r.date && r.date.slice(0,10)===today; };

  var w = (db.weights||[]).filter(isToday);
  var wc = w.filter(function(r){ return r.compliance!=null; });
  var comp = wc.length ? Math.round(wc.reduce(function(a,r){return a+r.compliance},0)/wc.length) : null;
  var seals = (db.seals||[]).filter(isToday).length;
  var gmpDone = (db.gmps||[]).some(isToday);
  var holds = (db.holds||[]).filter(function(x){return x.status!=='released' && x.status!=='destroyed'}).length;

  var compColor = comp===null ? 'var(--dim)' : comp>=90 ? 'var(--pass)' : comp>=80 ? 'var(--warn)' : 'var(--fail)';
  var tile = function(onclick, note, ico, val, lbl, valColor){
    return '<div class="tile" onclick="'+onclick+'">'+
      '<div class="t-top"><span class="t-lbl">'+lbl+'</span>'+
        '<span class="t-ico">'+(ICONS[ico]||'')+'</span></div>'+
      '<div class="t-val"'+(valColor?' style="color:'+valColor+'"':'')+'>'+val+'</div>'+
      '<div class="t-note">'+note+'</div>'+
    '</div>';
  };
  var lines={}; w.forEach(function(r){ if(r.line) lines[r.line]=1; });
  var lineCount=Object.keys(lines).length;
  var sealFails=(db.seals||[]).filter(isToday).filter(function(s){
    return Object.keys(s.checks||{}).some(function(k){ return s.checks[k]==='fail'; });
  }).length;

  // Lanzador de módulos: cada uno con su color
  var ml=document.getElementById('home-modules');
  if(ml && typeof myModules==='function'){
    ml.innerHTML = myModules().map(function(m){
      var n=m.items.filter(function(i){return !i.soon;}).length;
      return '<button class="mcard" style="--mod:'+m.ink+'" onclick="selectModule(\''+m.id+'\')">'+
        '<span class="mcard-ico" data-icon="'+m.icon+'"></span>'+
        '<b>'+esc(m.name)+'</b><span class="mcard-n">'+n+' functions</span></button>';
    }).join('');
    renderIcons(ml);
  }

  document.getElementById('home-tiles').innerHTML =
    tile("goTo('screen-dashboard')", lineCount?lineCount+' line(s) active':'none logged yet',
         'scale', w.length, 'Weight checks') +
    tile("goTo('screen-dashboard')", 'target 90% or higher',
         'check', comp===null ? '—' : comp+'<small>%</small>', 'Compliance', compColor) +
    tile("goTo('screen-seal')", sealFails?sealFails+' with a failed check':'all checks passed',
         'droplet', seals, 'Bag seals') +
    (holds > 0
      ? tile("goTo('screen-hold')", 'open cases', 'lock', holds, 'Hold cases', 'var(--warn)')
      : tile("goTo('screen-gmp')", 'SQF 2.5.D.A daily',
             'clipboard', gmpDone?'Done':'Pending', 'GMP audit', gmpDone?'var(--pass)':'var(--warn)'));

  // Recent activity (last 3, most recent first)
  var typeColor = {weight:'var(--accent)', seal:'var(--pass)', gmp:'var(--warn)', hold:'#ff9500', temp:'#5ac8fa', login:'var(--dim)'};
  var recent = (db.activityLog||[]).slice(-3).reverse();
  document.getElementById('home-recent').innerHTML = recent.length ?
    recent.map(function(e){
      return '<div class="recent-row">'+
        '<div class="r-dot" style="background:'+(typeColor[e.type]||'var(--dim)')+'"></div>'+
        '<div class="r-txt">'+
          '<div class="r-action">'+esc(e.action)+'</div>'+
          '<div class="r-meta">'+esc(e.user||'')+'</div>'+
        '</div>'+
        '<div class="r-time">'+(e.date ? e.date.slice(11,16) : '')+'</div>'+
      '</div>';
    }).join('') :
    '<div class="empty" style="padding:20px">No activity yet today</div>';
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
