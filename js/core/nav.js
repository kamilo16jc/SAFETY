// ===== NAV =====
function goTo(id){
  // Redirect to login if not authenticated
  if(id !== 'screen-login' && !currentUser) { id = 'screen-login'; }
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
  document.getElementById(id).classList.add('active');
  if(id==='screen-weight') initWeight();
  if(id==='screen-seal') initSeal();
  if(id==='screen-dashboard') initDash();
  if(id==='screen-temp') initTempScreen();
  if(id==='screen-gmp') initGmp();
  if(id==='screen-admin') initAdmin();
  if(id==='screen-reports') initReports();
  if(id==='screen-hold') initHold();
}

function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2500);
}

// ===== HOME =====
function updateDate(){
  document.getElementById('home-date').textContent=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
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

