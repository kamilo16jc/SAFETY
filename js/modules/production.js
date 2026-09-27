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
  showDateOrder(document.getElementById('screen-production'));
  echoDateRange('pr-date-echo','pr-date','');
  buildProductionSheet();
  renderProductOptions('pr-product-list');
  renderProduction();
}

// ===== LA HOJA =====
// El esqueleto se arma una vez: la fila de alta (numero de producto + linea)
// no se borra al cambiar de dia ni al agregar una corrida. El orden de
// produccion llega en papel, asi que no se pide hora: solo que producto y en
// que linea va.
function buildProductionSheet(){
  var host = document.getElementById('pr-sheet');
  if(!host || document.getElementById('pr-body')) return;
  var lines = '';
  for(var i=1;i<=6;i++) lines += '<option value="'+i+'">Line '+i+'</option>';
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Product</th><th class="wide">Description</th><th>Line</th>'+
      '<th>LOT</th><th class="num">Samples</th><th>Collected</th><th>Tested</th>'+
      '<th>Sent to lab</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="pr-new"><tr class="newrow">'+
      '<td class="rn">new</td>'+
      '<td><input class="cell" id="pr-product" list="pr-product-list" placeholder="Product #" '+
        'autocomplete="off" autocapitalize="characters" oninput="onScheduleProduct()" '+
        'onkeydown="if(event.key===\'Enter\')addRun()"></td>'+
      '<td class="wide soft" id="pr-desc">\u2014</td>'+
      '<td><select class="cell" id="pr-line"><option value="">Line</option>'+lines+'</select></td>'+
      '<td colspan="5" class="soft">The checklist fills in as the run goes</td>'+
      '<td><button class="sheet-btn" onclick="addRun()">Add</button></td>'+
    '</tr></tbody>'+
    '<tbody id="pr-body"></tbody></table></div>';
}

// Al escribir el numero, la descripcion sale del catalogo
function onScheduleProduct(){
  var el = document.getElementById('pr-desc');
  if(!el) return;
  var p = findProduct(normNumber((document.getElementById('pr-product')||{}).value||''));
  el.textContent = p ? (p.name || '\u2014') : '\u2014';
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
    // Sin hora, el orden es el de captura: como viene el papel de produccion
    return String(a.time||'').localeCompare(String(b.time||'')) || (a.id||0)-(b.id||0);
  });
}

// ---- Testeado: viene del ANÁLISIS capturado, no de los pesos ----
// Los pesos se toman con el producto que esté corriendo, así que un registro de
// peso no prueba que este producto programado se haya analizado. Lo que sí lo
// prueba es tener su Moisture / Fat / pH capturados.
function runTestCount(run){
  var day = String(run.date).slice(0,10);
  var list = (typeof getAnalyses==='function') ? getAnalyses().filter(function(a){
    if(a.runId && a.runId===run.id) return true;
    return String(a.product||'')===String(run.product||'') &&
           String(a.date||'').slice(0,10)===day;
  }) : [];
  var full = list.filter(function(a){
    return (typeof analysisComplete==='function') ? analysisComplete(a) : true; }).length;
  var auto = list.length>0;
  // Si no hay análisis que lo pruebe, QA puede marcarlo a mano (queda constancia)
  var manual = !!run.testedManual;
  return {n:list.length, full:full, seq:(list[0]||{}).seq,
          auto:auto, manual:manual, tested: auto || manual};
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
  if(runSampleCount(run)>0 && !run.labSent) return false;
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
  if(!num){  toast('Enter the product number'); return; }
  if(!line){ toast('Select the line'); return; }

  var p = findProduct(num);
  var db = getDB(); if(!db.runs) db.runs = [];
  var run = {
    id: Date.now(),
    date: prodDate, shift: parseInt(prodShift), line: parseInt(line),
    time: '',                              // el orden llega en papel: no se pide hora
    product: num,
    productName: p ? (p.name||'') : '',
    labSamples: p ? productSampleCount(p) : 0,
    labSample: p ? productSampleCount(p) > 0 : false,
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

  numEl.value='';
  onScheduleProduct();
  numEl.focus();
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
  if(field==='collected' && run.collected && runSampleCount(run)>0 && !run.sampleFrom){
    var rc = runCustomer(run);
    if(rc && rc.numbered) assignLabSampleRange(run, db);
  }
  if(field==='collected' && !run.collected){ run.sampleFrom=null; run.sampleTo=null; }
  persistRunEdit(run, db);
  refreshRunViews();
}

// Al guardar un peso, si ese producto está programado hoy y todavía debe una
// muestra de laboratorio, se ofrece marcarla como recogida: es justo el momento
// en que QA está parado en la línea.
function offerRunCollect(rec){
  if(!rec || !rec.product || rec.issue) return;
  var day = String(rec.date).slice(0,10);
  var run = getRuns().filter(function(r){
    return String(r.date).slice(0,10)===day &&
           String(r.shift)===String(rec.shift) &&
           String(r.line)===String(rec.line) &&
           String(r.product||'')===String(rec.product||'') &&
           runSampleCount(r) > 0 && !r.collected;
  })[0];
  if(!run) return;

  var c = runCustomer(run);
  var tests = c ? (c.tests||[]).join(', ') : '';
  var n = runSampleCount(run);
  showGuardModal({
    title: n+' lab sample'+(n===1?'':'s')+' due — '+(run.productName || run.product),
    detail: 'Line '+run.line+(c ? ' · '+c.company : '')+(tests ? ' · '+tests : ''),
    ask: 'Did you collect the lab sample from the line?',
    primaryLabel: 'Yes, collected',
    onPrimary: function(){ closeDupModal(); toggleRunCheck(run.id, 'collected'); },
    secondaryLabel: 'Not yet',
    onSecondary: closeDupModal
  });
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

// Cuantos samples pide esta corrida: lo dice el producto (Products), y si es
// un producto viejo sin el campo, su cliente.
function runSampleCount(run){
  var p = (typeof findProduct==='function') ? findProduct(run.product) : null;
  if(p && typeof productSampleCount==='function') return productSampleCount(p);
  var c = runCustomer(run);
  return run.labSample ? (typeof customerSampleCount==='function' ? customerSampleCount(c) : 1) : 0;
}

function runCustomer(run){
  var p = (typeof findProduct==='function') ? findProduct(run.product) : null;
  return (typeof productCustomer==='function') ? productCustomer(p || {number:run.product}) : null;
}

function assignLabSampleRange(run, db){
  var c = runCustomer(run);
  if(!c){ toast('Assign a customer to this product first (Products)'); return; }
  if(!c.numbered) return;                               // este cliente no enumera
  var per = runSampleCount(run) || (c.samplesPerOrder || 5);
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
  var sl = document.getElementById('screen-samplelist');
  if(sl && sl.classList.contains('active') && typeof renderSampleList==='function') renderSampleList();
}

function scanRunLot(id){ openScanner('runlot:'+id); }

// ---- Desde la corrida a Hold / CAPA (ya ligados por LOT, producto y línea) ----
function holdFromRun(id){
  var r = findRun(id); if(!r) return;
  if(!r.lot && !confirm('This run has no LOT yet. Continue anyway?')) return;
  goTo('screen-hold');
  if(typeof toggleHoldForm==='function') toggleHoldForm(true);
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

function renderProduction(){
  prodFilters();
  echoDateRange('pr-date-echo','pr-date','');
  buildProductionSheet();
  var body = document.getElementById('pr-body');
  if(!body) return;
  var list = runsFor(prodDate, prodShift);

  var done=0, labs=0, labsPending=0, untested=0;
  list.forEach(function(r){
    if(runComplete(r)) done++;
    if(runSampleCount(r)>0){ labs++; if(!r.labSent) labsPending++; }
    if(!runTestCount(r).tested) untested++;
  });
  var sum = document.getElementById('pr-summary');
  if(sum){
    var k = function(n, label, color){
      return '<div class="kpi"><b>'+n+'</b><span>'+
        (color ? '<i class="dot" style="background:'+color+'"></i>' : '')+label+'</span></div>';
    };
    sum.innerHTML = list.length
      ? k(list.length, 'runs scheduled', '') +
        k(done, 'complete', 'var(--pass)') +
        k(untested, 'not tested', untested?'var(--fail)':'var(--dim)') +
        k(labsPending+'/'+labs, 'lab samples pending', labsPending?'var(--fail)':'var(--dim)')
      : '';
  }

  if(!list.length){
    body.innerHTML = '<tr><td colspan="10" class="sheet-empty" style="border:0">'+
      'No runs scheduled for this day and shift. Add them in the top row as they come on the '+
      'production sheet, or copy the schedule from another day.</td></tr>';
    return;
  }
  body.innerHTML = list.map(function(r,i){ return runRowHTML(r,i+1); }).join('');
  renderIcons(body);
}

function runRowHTML(r, i){
  var t = runTestCount(r);
  var n = runSampleCount(r);
  var complete = runComplete(r);
  var tog = function(on, label, onclick){
    return '<button class="cell-tog'+(on?' on':'')+'" onclick="'+onclick+'">'+
      (on ? '\u2713 ' : '') + label + '</button>';
  };
  var tested = t.auto
    ? '<span class="pill ok" title="Confirmed by analysis #'+(t.seq||'')+'">\u2713 #'+(t.seq||'\u2014')+'</span>'
    : tog(t.manual, t.manual ? 'Marked' : 'Not tested', 'toggleRunTested('+r.id+')');
  var ico = function(icon, title, onclick){
    return '<button class="ico-btn sm" title="'+title+'" onclick="'+onclick+'"><span data-icon="'+icon+'"></span></button>';
  };
  return '<tr'+(complete?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+esc(r.product||'\u2014')+'</td>'+
    '<td class="wide">'+esc(r.productName||'\u2014')+
      (complete ? ' <span class="tag ok">Complete</span>'
                : ' <span class="tag warn">Pending</span>')+'</td>'+
    '<td class="mid">'+esc(String(r.line||'\u2014'))+'</td>'+
    '<td><input class="cell" placeholder="LOT" value="'+esc(r.lot||'')+'" '+
      'onchange="setRunLot('+r.id+', this.value)"></td>'+
    '<td class="num">'+(n||'\u2014')+
      (r.sampleFrom ? ' <span class="soft">('+r.sampleFrom+'\u2013'+r.sampleTo+')</span>' : '')+'</td>'+
    '<td>'+(n>0 ? tog(r.collected, r.collected?'Collected':'Collect', "toggleRunCheck("+r.id+",'collected')")
                : '<span class="soft">\u2014</span>')+'</td>'+
    '<td>'+tested+'</td>'+
    '<td>'+(n>0 ? tog(r.labSent, r.labSent?'Sent':'Send', "toggleRunCheck("+r.id+",'labSent')")
                : '<span class="soft">\u2014</span>')+'</td>'+
    '<td class="acts">'+
      ico('scan','Scan LOT','scanRunLot('+r.id+')')+
      ico('close','Remove from schedule','deleteRun('+r.id+')')+
    '</td>'+
  '</tr>';
}

// La hoja del dia, tal como se ve
function exportScheduleCSV(){
  prodFilters();
  var list = runsFor(prodDate, prodShift);
  if(!list.length){ toast('Nothing scheduled for that day and shift'); return; }
  var out = [['Product','Description','Line','LOT','Samples','Sample #s','Collected','Tested','Sent to lab']];
  list.forEach(function(r){
    var t = runTestCount(r), n = runSampleCount(r);
    out.push([r.product||'', r.productName||'', r.line||'', r.lot||'', n,
      r.sampleFrom ? r.sampleFrom+'-'+r.sampleTo : '',
      n>0 ? (r.collected?'Yes':'No') : '', t.tested?'Yes':'No',
      n>0 ? (r.labSent?'Yes':'No') : '']);
  });
  downloadCSV('schedule-'+prodDate+'-shift'+prodShift+'.csv', out);
}

