// ===== PRODUCTION SCHEDULE =====
// El orden de producción llega en papel: aquí se captura por día/turno y cada
// corrida lleva su checklist (LOT, muestra recogida, testeado, muestra al lab).
// "Testeado" NO es un check manual: se deduce de los registros de Weight/Bag
// Seal que ya existen para ese producto + línea + turno + fecha.
var prodDate = null, prodShift = null;

function getRuns(){ var db=getDB(); if(!db.runs) db.runs=[]; return db.runs; }

function initProduction(){
  var d=document.getElementById('pr-date');
  if(d && !d.value) d.value = localDateStr();
  var s=document.getElementById('pr-shift');
  if(s && !s.value) s.value = String(expectedShift());
  renderProductOptions('pr-product-list');
  renderProduction();
}

function prodFilters(){
  var d=document.getElementById('pr-date'), s=document.getElementById('pr-shift');
  prodDate  = (d && d.value) ? d.value : localDateStr();
  prodShift = String((s && s.value) ? s.value : expectedShift());
}

function runsFor(date, shift){
  return getRuns().filter(function(r){
    return String(r.date).slice(0,10)===String(date) && String(r.shift)===String(shift);
  }).sort(function(a,b){
    return String(a.time||'zz').localeCompare(String(b.time||'zz')) || (a.id||0)-(b.id||0);
  });
}

// ---- Testeado automático desde los registros reales ----
function runTestCount(run){
  var db = getDB();
  var day = String(run.date).slice(0,10);
  var match = function(r){
    if(r.issue) return false;                       // un issue de línea no es un test
    return String(r.date||'').slice(0,10)===day &&
           String(r.shift)===String(run.shift) &&
           String(r.line)===String(run.line) &&
           String(r.product||'')===String(run.product||'');
  };
  var w = (db.weights||[]).filter(match).length;
  var s = (db.seals||[]).filter(match).length;
  return {w:w, s:s, tested:(w+s)>0};
}

function runComplete(run){
  if(!run.lot || !run.collected) return false;
  if(!runTestCount(run).tested) return false;
  if(run.labSample && !run.labSent) return false;
  return true;
}

// ---- Persistencia ----
// Nuevo: push + saveToFirebase (es el último del array, el _fbId cae bien).
// Edición: saveToFirebaseAt sobre el mismo doc; si aún no tiene _fbId (creado
// sin señal) se queda local y lo sube flushPending.
function persistRunEdit(run, db){
  saveDB(db);
  if(run._fbId && window.saveToFirebaseAt) window.saveToFirebaseAt('runs', run._fbId, run);
}

function findRun(id){
  return getRuns().filter(function(r){ return r.id===id; })[0] || null;
}

// ---- Alta / baja ----
function addRun(){
  prodFilters();
  var numEl = document.getElementById('pr-product');
  var num  = normNumber(numEl.value);
  var line = document.getElementById('pr-line').value;
  var time = document.getElementById('pr-time').value;
  if(!num){  toast('Enter the product number'); return; }
  if(!line){ toast('Select the line'); return; }

  var p = findProduct(num);
  var db = getDB(); if(!db.runs) db.runs = [];
  var run = {
    id: Date.now(),
    date: prodDate, shift: parseInt(prodShift), line: parseInt(line),
    time: time || '',
    product: num,
    productName: p ? (p.name||'') : '',
    labSample: p ? !!p.labSample : false,
    lot:'', collected:false, labSent:false, notes:'',
    createdBy: currentUser ? currentUser.name : '—',
    createdAt: localISOStr()
  };
  db.runs.push(run);
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('runs', run);
  logActivity('production','Run scheduled',
    'Line '+run.line+' · Product '+run.product+(run.productName?' — '+run.productName:'')+
    (run.labSample?' · LAB sample':''),
    currentUser?currentUser.name:'—');

  numEl.value=''; document.getElementById('pr-time').value='';
  if(window.renderProductCard) { /* no-op: el schedule no usa tarjeta de producto */ }
  renderProduction();
}

function deleteRun(id){
  var run = findRun(id); if(!run) return;
  if(!confirm('Remove this run from the schedule?')) return;
  var db = getDB();
  db.runs = (db.runs||[]).filter(function(r){ return r.id!==id; });
  saveDB(db);
  if(run._fbId && window.deleteFromFirebase) window.deleteFromFirebase('runs', run._fbId);
  renderProduction();
}

// Copia el schedule de otro día (el orden se repite mucho): trae las corridas
// pero deja el checklist en blanco.
function copySchedule(){
  prodFilters();
  var from = prompt('Copy the schedule from which date? (YYYY-MM-DD)');
  if(!from) return;
  from = String(from).trim().slice(0,10);
  var src = getRuns().filter(function(r){ return String(r.date).slice(0,10)===from; });
  if(!src.length){ toast('No runs scheduled on '+from); return; }

  var db = getDB(); if(!db.runs) db.runs = [];
  var now = Date.now();
  src.forEach(function(r, i){
    var copy = Object.assign({}, r, {
      id: now + i,
      date: prodDate, shift: parseInt(prodShift),
      lot:'', collected:false, labSent:false, notes:'',
      createdBy: currentUser ? currentUser.name : '—',
      createdAt: localISOStr()
    });
    delete copy._fbId;          // es un registro nuevo
    db.runs.push(copy);
  });
  saveDB(db);
  if(window.flushPendingNow) window.flushPendingNow();   // sube las copias
  logActivity('production','Schedule copied',
    src.length+' run(s) copied from '+from+' to '+prodDate,
    currentUser?currentUser.name:'—');
  toast(src.length+' run(s) copied');
  renderProduction();
}

// ---- Checklist ----
function setRunLot(id, val){
  var db = getDB();
  var run = (db.runs||[]).filter(function(r){ return r.id===id; })[0];
  if(!run) return;
  run.lot = String(val||'').trim();
  persistRunEdit(run, db);
  refreshRunViews();
}

function toggleRunCheck(id, field){
  var db = getDB();
  var run = (db.runs||[]).filter(function(r){ return r.id===id; })[0];
  if(!run) return;
  run[field] = !run[field];
  // Se guarda la hora: la de recolección la pide la forma del laboratorio
  if(field==='collected') run.collectedAt = run.collected ? localISOStr() : '';
  if(field==='labSent')   run.labSentAt   = run.labSent   ? localISOStr() : '';
  persistRunEdit(run, db);
  refreshRunViews();
}

// Repinta la vista que esté abierta (Production o Lab Samples)
function refreshRunViews(){
  var pr = document.getElementById('screen-production');
  if(pr && pr.classList.contains('active')) renderProduction();
  var lb = document.getElementById('screen-lab');
  if(lb && lb.classList.contains('active') && typeof renderLab==='function') renderLab();
}

function scanRunLot(id){ openScanner('runlot:'+id); }

// ---- Desde la corrida a Hold / CAPA (ya ligados por LOT, producto y línea) ----
function holdFromRun(id){
  var r = findRun(id); if(!r) return;
  if(!r.lot && !confirm('This run has no LOT yet. Continue anyway?')) return;
  goTo('screen-hold');
  if(typeof switchHoldTab==='function') switchHoldTab('new', document.getElementById('hold-tab-new'));
  var set = function(el, v){ var e=document.getElementById(el); if(e) e.value = v; };
  set('hold-product', r.productName || r.product || '');
  set('hold-lot', r.lot || '');
  set('hold-initby', currentUser ? currentUser.name : '');
  var lb = document.querySelector('[data-group="hline"][data-val="'+r.line+'"]');
  if(lb && typeof selectHoldLine==='function') selectHoldLine(lb);
  toast('Hold prefilled from the run — add the reason');
}

function capaFromRun(id){
  var r = findRun(id); if(!r) return;
  goTo('screen-capa');
  var set = function(el, v){ var e=document.getElementById(el); if(e) e.value = v; };
  set('capa-date', String(r.date).slice(0,10));
  set('capa-product', r.product || '');
  set('capa-lot', r.lot || '');
  toast('CAPA prefilled from the run — describe the problem');
}

// ---- Render ----
function renderProduction(){
  prodFilters();
  var el = document.getElementById('pr-list');
  if(!el) return;
  var list = runsFor(prodDate, prodShift);

  // Resumen
  var done=0, labs=0, labsPending=0, untested=0;
  list.forEach(function(r){
    if(runComplete(r)) done++;
    if(r.labSample){ labs++; if(!r.labSent) labsPending++; }
    if(!runTestCount(r).tested) untested++;
  });
  var sum = document.getElementById('pr-summary');
  if(sum){
    sum.innerHTML = list.length
      ? '<div class="pr-sum">'+
          '<div class="pr-stat"><b>'+list.length+'</b><span>runs</span></div>'+
          '<div class="pr-stat"><b class="'+(done===list.length?'ok':'')+'">'+done+'</b><span>complete</span></div>'+
          '<div class="pr-stat"><b class="'+(untested?'bad':'')+'">'+untested+'</b><span>not tested</span></div>'+
          '<div class="pr-stat"><b class="'+(labsPending?'warn':'')+'">'+labsPending+'/'+labs+'</b><span>lab pending</span></div>'+
        '</div>'
      : '';
  }

  if(!list.length){
    el.innerHTML = '<div class="panel"><div class="cd-empty">'+
      'No runs scheduled for this day and shift. Add them from the production sheet above, '+
      'or copy the schedule from another day.</div></div>';
    return;
  }

  el.innerHTML = list.map(function(r){
    var t = runTestCount(r);
    var complete = runComplete(r);
    var chk = function(on, label, onclick){
      return '<button class="run-chk'+(on?' on':'')+'" onclick="'+onclick+'">'+
        '<span class="run-box">'+(on?'✓':'')+'</span>'+label+'</button>';
    };
    return '<div class="run-card'+(complete?' done':'')+'">'+
      '<div class="run-head">'+
        '<div>'+
          '<div class="run-title">Line '+r.line+' · '+esc(r.product||'—')+
            (r.labSample?' <span class="tag warn">LAB</span>':'')+
            (complete?' <span class="tag ok">Complete</span>':'')+'</div>'+
          '<div class="run-meta">'+esc(r.productName||'—')+(r.time?' · '+esc(r.time):'')+'</div>'+
        '</div>'+
        '<button class="run-del" title="Remove from schedule" onclick="deleteRun('+r.id+')"><span data-icon="close"></span></button>'+
      '</div>'+
      '<div class="run-lot">'+
        '<input type="text" class="field" placeholder="LOT number" value="'+esc(r.lot||'')+'" '+
          'onchange="setRunLot('+r.id+', this.value)">'+
        '<button class="scan-btn" title="Scan LOT" onclick="scanRunLot('+r.id+')"><span data-icon="scan"></span></button>'+
      '</div>'+
      '<div class="run-checks">'+
        chk(r.collected, 'Collected from line', 'toggleRunCheck('+r.id+",'collected')")+
        '<div class="run-chk auto'+(t.tested?' on':'')+'">'+
          '<span class="run-box">'+(t.tested?'✓':'')+'</span>Tested'+
          '<span class="run-auto">'+(t.tested ? (t.w+' weight · '+t.s+' seal') : 'no records yet')+'</span>'+
        '</div>'+
        (r.labSample ? chk(r.labSent, 'Sent to lab', 'toggleRunCheck('+r.id+",'labSent')") : '')+
      '</div>'+
      '<div class="run-actions">'+
        '<button class="btn-ghost" onclick="holdFromRun('+r.id+')"><span data-icon="lock"></span>Place on hold</button>'+
        '<button class="btn-ghost" onclick="capaFromRun('+r.id+')"><span data-icon="alert"></span>Open CAPA</button>'+
      '</div>'+
    '</div>';
  }).join('');
  renderIcons(el);
}
