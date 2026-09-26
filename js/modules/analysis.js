// ===== SAMPLE ANALYSIS (COA) =====
// Captura de los análisis que se hacen en casa: Moisture, Fat y pH.
// Es la fuente REAL de "testeado": un producto está testeado cuando tiene su
// análisis capturado, no porque se haya tomado un peso (los pesos se toman con
// el producto que esté corriendo, así que no prueban nada sobre otro producto).
var anFrom = '', anTo = '', anQuery = '';

function getAnalyses(){ var d=getDB(); if(!d.analysis) d.analysis=[]; return d.analysis; }

function initAnalysis(){
  var f=document.getElementById('an-from'), t=document.getElementById('an-to');
  if(f && !f.value){
    var d=new Date(); d.setDate(d.getDate()-14);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  if(t && !t.value) t.value = localDateStr();
  var dt=document.getElementById('an-date'); if(dt && !dt.value) dt.value = localDateStr();
  var by=document.getElementById('an-by');
  if(by && !by.value && typeof getInitials==='function' && currentUser) by.value = getInitials();
  renderProductOptions('an-product-list');
  renderAnalysis();
}

// Número correlativo del año (como el ID de la hoja)
function nextAnalysisSeq(year){
  var y = String(year||new Date().getFullYear());
  var max = 0;
  getAnalyses().forEach(function(a){
    if(String(a.date||'').slice(0,4)===y && +a.seq>max) max = +a.seq;
  });
  return max+1;
}

function analysisFor(product, day){
  return getAnalyses().filter(function(a){
    return String(a.product||'')===String(product||'') &&
           String(a.date||'').slice(0,10)===String(day||'').slice(0,10);
  });
}

// ¿Tiene las tres mediciones? Eso es lo que cuenta como analizado
function analysisComplete(a){
  return a && a.moisture!=='' && a.moisture!=null &&
             a.fat!=='' && a.fat!=null &&
             a.ph!=='' && a.ph!=null;
}

// ---- Alta ----
function onAnalysisProduct(){
  var num = normNumber(document.getElementById('an-product').value);
  var p = findProduct(num);
  var ch = document.getElementById('an-cheese');
  if(p && ch && !ch.value) ch.value = p.name || '';
  var c = (p && typeof productCustomer==='function') ? productCustomer(p) : null;
  var el = document.getElementById('an-customer-hint');
  if(el) el.innerHTML = c ? '<div class="cust-hint"><div class="cust-name">'+esc(c.company)+
    ' <span class="tag">'+esc(c.customerId)+'</span></div></div>' : '';
}

function saveAnalysis(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; };
  var date = g('an-date') || localDateStr();
  var product = normNumber(g('an-product'));
  if(!product){ toast('Enter the product number'); return; }
  var moisture=g('an-moisture'), fat=g('an-fat'), ph=g('an-ph');
  if(!moisture && !fat && !ph){ toast('Enter at least one measurement'); return; }

  var p = findProduct(product);
  var c = (p && typeof productCustomer==='function') ? productCustomer(p) : null;
  var db = getDB(); if(!db.analysis) db.analysis = [];
  var rec = {
    id: Date.now(),
    seq: nextAnalysisSeq(date.slice(0,4)),
    date: date,
    product: product,
    cheese: g('an-cheese') || (p ? (p.name||'') : ''),
    customerId: c ? c.customerId : '',
    customer: c ? c.company : '',
    prodDate: g('an-proddate'),
    order: g('an-order'),
    po: g('an-po'),
    moisture: moisture, fat: fat, ph: ph,
    testedBy: g('an-by') || (currentUser ? getInitials() : ''),
    runId: window._anRunId || null,
    createdAt: localISOStr(),
    createdBy: currentUser ? currentUser.name : '—'
  };
  db.analysis.push(rec);
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('analysis', rec);
  logActivity('analysis','Sample analysis recorded',
    'Product '+rec.product+(rec.cheese?' — '+rec.cheese:'')+
    ' · Moisture '+(rec.moisture||'—')+' · Fat '+(rec.fat||'—')+' · pH '+(rec.ph||'—'),
    rec.testedBy||(currentUser?currentUser.name:'—'));

  window._anRunId = null;
  ['an-product','an-cheese','an-proddate','an-order','an-po','an-moisture','an-fat','an-ph']
    .forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
  var hint=document.getElementById('an-customer-hint'); if(hint) hint.innerHTML='';
  toast('Analysis #'+rec.seq+' saved');
  renderAnalysis();
  if(typeof refreshRunViews==='function') refreshRunViews();
}

function deleteAnalysis(id){
  var a = getAnalyses().filter(function(x){ return x.id===id; })[0];
  if(!a) return;
  if(!confirm('Delete analysis #'+a.seq+'?')) return;
  var db = getDB();
  db.analysis = (db.analysis||[]).filter(function(x){ return x.id!==id; });
  saveDB(db);
  if(a._fbId && window.deleteFromFirebase) window.deleteFromFirebase('analysis', a._fbId);
  renderAnalysis();
  if(typeof refreshRunViews==='function') refreshRunViews();
}

// Abre la captura ya llena desde una corrida del schedule
function analysisFromRun(runId){
  var r = (typeof findRun==='function') ? findRun(runId) : null;
  if(!r) return;
  goTo('screen-analysis');
  window._anRunId = runId;
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
  set('an-date', String(r.date).slice(0,10));
  set('an-product', r.product||'');
  set('an-cheese', r.productName||'');
  set('an-order', '');
  onAnalysisProduct();
  var mo=document.getElementById('an-moisture'); if(mo) mo.focus();
  toast('Analysis prefilled from the run');
}

// ---- Render ----
function anFilters(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  anFrom=g('an-from'); anTo=g('an-to'); anQuery=(g('an-search')||'').trim().toLowerCase();
}

function analysisResults(){
  anFilters();
  return getAnalyses().filter(function(a){
    var d=String(a.date||'').slice(0,10);
    if(anFrom && d<anFrom) return false;
    if(anTo   && d>anTo)   return false;
    if(anQuery){
      var hay=(String(a.product||'')+' '+String(a.cheese||'')+' '+String(a.customer||'')+' '+
               String(a.order||'')+' '+String(a.po||'')).toLowerCase();
      if(hay.indexOf(anQuery)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date).localeCompare(String(a.date)) || (b.seq||0)-(a.seq||0);
  });
}

function renderAnalysis(){
  var el=document.getElementById('an-list');
  if(!el) return;
  var list=analysisResults();
  var sum=document.getElementById('an-summary');
  if(sum){
    var full=list.filter(analysisComplete).length;
    sum.innerHTML = list.length
      ? '<div class="pr-sum">'+
          '<div class="pr-stat"><b>'+list.length+'</b><span>analyses</span></div>'+
          '<div class="pr-stat"><b class="ok">'+full+'</b><span>complete</span></div>'+
          '<div class="pr-stat"><b class="'+(list.length-full?'warn':'')+'">'+(list.length-full)+'</b><span>partial</span></div>'+
        '</div>' : '';
  }
  if(!list.length){
    el.innerHTML='<div class="panel"><div class="cd-empty">No analyses for these filters.</div></div>';
    return;
  }
  var rows=list.slice(0,200).map(function(a){
    return '<tr>'+
      '<td class="mono">#'+(a.seq||'—')+'</td>'+
      '<td class="mono">'+fmtDate(a.date)+'</td>'+
      '<td class="mono">'+esc(a.product||'—')+'</td>'+
      '<td>'+esc(a.cheese||'—')+'</td>'+
      '<td class="soft">'+esc(a.customer||'—')+'</td>'+
      '<td class="mono num">'+esc(a.moisture||'—')+'</td>'+
      '<td class="mono num">'+esc(a.fat||'—')+'</td>'+
      '<td class="mono num">'+esc(a.ph||'—')+'</td>'+
      '<td class="soft">'+esc(a.testedBy||'—')+'</td>'+
      '<td class="view-cell"><button class="run-del" onclick="deleteAnalysis('+a.id+')" title="Delete">'+
        '<span data-icon="close"></span></button></td>'+
    '</tr>';
  }).join('');
  el.innerHTML = tablePanel('Sample analysis', list.length, [
    {t:'ID'},{t:'Date'},{t:'Product'},{t:'Cheese'},{t:'Customer'},
    {t:'Moisture',num:true},{t:'Fat',num:true},{t:'pH',num:true},{t:'By'},{t:''}
  ], rows, Math.min(list.length,200));
  renderIcons(el);
}
