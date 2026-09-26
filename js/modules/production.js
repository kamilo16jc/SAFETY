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
  var auto = (w+s)>0;
  // Si no hay registro que lo pruebe, QA puede marcarlo a mano (queda constancia)
  var manual = !!run.testedManual;
  return {w:w, s:s, auto:auto, manual:manual, tested: auto || manual};
}

// Marca "testeado" a mano. Solo cuando no hay registro que lo confirme: lo que
// los registros ya prueban no se puede desmarcar.
function toggleRunTested(id){
  var db = getDB();
  var run = (db.runs||[]).filter(function(r){ return r.id===id; })[0];
  if(!run) return;
  if(runTestCount(run).auto){
    toast('Already confirmed by the weight / bag seal records');
    return;
  }
  run.testedManual   = !run.testedManual;
  run.testedManualAt = run.testedManual ? localISOStr() : '';
  run.testedManualBy = run.testedManual ? (currentUser ? currentUser.name : '—') : '';
  persistRunEdit(run, db);
  logActivity('production', run.testedManual ? 'Run marked as tested (manual)' : 'Manual tested mark removed',
    'Line '+run.line+' · '+(run.product||'—')+' · '+String(run.date).slice(0,10),
    currentUser?currentUser.name:'—');
  refreshRunViews();
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
  // Al recoger, solo los clientes con numeración (5 samples por orden) piden
  // números. Los demás llevan 1 sample y no se enumera.
  if(field==='collected' && run.collected && run.labSample && !run.sampleFrom){
    var rc = runCustomer(run);
    if(rc && rc.numbered) assignLabSampleRange(run, db);
  }
  if(field==='collected' && !run.collected){ run.sampleFrom=null; run.sampleTo=null; }
  persistRunEdit(run, db);
  refreshRunViews();
}

// ===== NUMERACIÓN DE SAMPLES =====
// El contador es POR CLIENTE (cada cliente lleva su propia enumeración) y
// se resetea cada semana. Como parte de las muestras se recogen fuera del
// sistema, siempre se pregunta en qué número arrancar.
function weekKey(d){
  var dt = new Date(String(d||'').slice(0,10)+'T12:00:00');
  if(isNaN(dt)) dt = new Date();
  dt.setDate(dt.getDate() - ((dt.getDay()+6)%7));   // lunes de esa semana
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function getLabCounters(){ var d=getDB(); return d.labCounters || {}; }
// db: si viene, se muta esa MISMA referencia y la persiste quien llama. Sin
// esto, el saveDB posterior del registro pisaba el contador recién escrito.
function setLabCounter(customerId, week, next, db){
  var d = db || getDB();
  if(!d.labCounters) d.labCounters = {};
  d.labCounters[customerId] = {week:week, next:next};
  if(!db) saveDB(d);
  if(window.saveLabCountersToFirebase) window.saveLabCountersToFirebase(d.labCounters);
}

function runCustomer(run){
  var p = (typeof findProduct==='function') ? findProduct(run.product) : null;
  return (typeof productCustomer==='function') ? productCustomer(p || {number:run.product}) : null;
}

function assignLabSampleRange(run, db){
  var c = runCustomer(run);
  if(!c){ toast('Assign a customer to this product first (Products)'); return; }
  if(!c.numbered) return;                               // este cliente no enumera
  var per = c.samplesPerOrder || 5;
  var wk = weekKey(run.date);
  var st = ((db && db.labCounters) || getLabCounters())[c.customerId];
  var proposed = (st && st.week===wk) ? st.next : 1;   // semana nueva -> arranca en 1
  var ans = prompt('Sample numbers for '+c.company+'\n'+
    'Week of '+wk+'. This order takes '+per+' samples.\n'+
    'Start at which sample number?', String(proposed));
  if(ans===null) return;                                // canceló: queda sin números
  var n = parseInt(ans,10);
  if(isNaN(n) || n<1){ toast('Invalid sample number'); return; }
  run.sampleFrom = n; run.sampleTo = n+per-1;
  setLabCounter(c.customerId, wk, n+per, db);
  toast('Samples '+run.sampleFrom+'–'+run.sampleTo+' assigned');
}

// Texto que va en la forma: "Producto (51-55)"
function sampleRangeLabel(run){
  return run.sampleFrom ? ' ('+run.sampleFrom+'-'+run.sampleTo+')' : '';
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
        chk(r.collected, 'Collected from line'+
            (r.sampleFrom ? ' · samples '+r.sampleFrom+'–'+r.sampleTo : ''),
            'toggleRunCheck('+r.id+",'collected')")+
        (t.auto
          // Confirmado por los registros: no se puede desmarcar
          ? '<div class="run-chk auto on"><span class="run-box">✓</span>Tested'+
              '<span class="run-auto">'+t.w+' weight · '+t.s+' seal</span></div>'
          // Sin registro: QA lo puede marcar a mano
          : '<button class="run-chk'+(t.manual?' on':'')+'" onclick="toggleRunTested('+r.id+')">'+
              '<span class="run-box">'+(t.manual?'✓':'')+'</span>Tested'+
              '<span class="run-auto">'+(t.manual?'marked manually':'no records — tap if tested')+'</span>'+
            '</button>')+
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
