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
  if(id==='screen-admin') initAdmin();
  if(id==='screen-reports') initReports();
  if(id==='screen-hold') initHold();
  if(id==='screen-activity') initActivity();
  // Mark current screen in the drawer
  document.querySelectorAll('.d-item[data-screen]').forEach(function(b){
    b.classList.toggle('current', b.getAttribute('data-screen')===id);
  });
}

function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2500);
}

// ===== DRAWER =====
function openDrawer(){
  if(currentUser){
    document.getElementById('user-badge').textContent = currentUser.name;
    document.getElementById('drawer-role').textContent = currentUser.role;
  }
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function navDrawer(id){
  closeDrawer();
  goTo(id);
}

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
  var comp = w.length ? Math.round(w.reduce(function(a,r){return a+(r.compliance||0)},0)/w.length) : null;
  var seals = (db.seals||[]).filter(isToday).length;
  var gmpDone = (db.gmps||[]).some(isToday);
  var holds = (db.holds||[]).filter(function(x){return x.status!=='released' && x.status!=='destroyed'}).length;

  var compColor = comp===null ? 'var(--dim)' : comp>=90 ? 'var(--pass)' : comp>=80 ? 'var(--warn)' : 'var(--fail)';
  var tile = function(onclick, icoBg, ico, val, lbl, valColor){
    return '<div class="tile" onclick="'+onclick+'">'+
      '<div class="t-ico" style="background:'+icoBg+'">'+ico+'</div>'+
      '<div class="t-val" style="color:'+(valColor||'var(--text)')+'">'+val+'</div>'+
      '<div class="t-lbl">'+lbl+'</div>'+
    '</div>';
  };
  document.getElementById('home-tiles').innerHTML =
    tile("goTo('screen-dashboard')", 'rgba(0,122,255,0.1)', '⚖️', w.length, 'Weight checks') +
    tile("goTo('screen-dashboard')", comp===null?'rgba(142,142,147,0.12)':comp>=90?'rgba(52,199,89,0.1)':'rgba(255,149,0,0.12)', '✓',
         comp===null ? '—' : comp+'<small>%</small>', 'Compliance', compColor) +
    tile("goTo('screen-seal')", 'rgba(52,199,89,0.1)', '🔍', seals, 'Bag seals') +
    (holds > 0
      ? tile("goTo('screen-hold')", 'rgba(255,149,0,0.14)', '🔒', holds, 'Active holds', 'var(--warn)')
      : tile("goTo('screen-gmp')", gmpDone?'rgba(52,199,89,0.1)':'rgba(255,149,0,0.12)', '🏭',
             gmpDone?'Done':'Pending', 'GMP audit', gmpDone?'var(--pass)':'var(--warn)'));

  // Recent activity (last 3, most recent first)
  var typeColor = {weight:'var(--accent)', seal:'var(--pass)', gmp:'var(--warn)', hold:'#ff9500', temp:'#5ac8fa', login:'var(--dim)'};
  var recent = (db.activityLog||[]).slice(-3).reverse();
  document.getElementById('home-recent').innerHTML = recent.length ?
    recent.map(function(e){
      return '<div class="recent-row">'+
        '<div class="r-dot" style="background:'+(typeColor[e.type]||'var(--dim)')+'"></div>'+
        '<div class="r-txt">'+
          '<div class="r-action">'+e.action+'</div>'+
          '<div class="r-meta">'+(e.user||'')+'</div>'+
        '</div>'+
        '<div class="r-time">'+(e.date ? e.date.slice(11,16) : '')+'</div>'+
      '</div>';
    }).join('') :
    '<div class="empty" style="padding:20px">No activity yet today</div>';
}

function selectLine(n){
  st.line=n;
  document.querySelectorAll('.lines-grid').forEach(function(grid){
    grid.querySelectorAll('.sel-btn').forEach(function(b,i){b.classList.toggle('selected',i===n-1);});
  });
  checkReady();
}
function selectShift(n){
  st.shift=n;
  document.querySelectorAll('.shift-grid').forEach(function(grid){
    grid.querySelectorAll('.shift-btn').forEach(function(b,i){b.classList.toggle('selected',i===n-1);});
  });
  checkReady();
}
function checkReady(){
  var btn=document.getElementById('start-btn');
  if(btn) btn.disabled=!(st.line&&st.shift);
}
