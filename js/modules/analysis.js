// ===== SAMPLE ANALYSIS (COA) =====
// Captura de los análisis que se hacen en casa: Moisture, Fat y pH.
// Es la fuente REAL de "testeado": un producto está testeado cuando tiene su
// análisis capturado, no porque se haya tomado un peso (los pesos se toman con
// el producto que esté corriendo, así que no prueban nada sobre otro producto).
//
// La captura es una hoja: la primera fila es la de alta y debajo van los
// registros guardados, con Moisture / Fat / pH editables en su celda. El
// segundo paso del laboratorio (la placa) vive en Yeast & Mold y arrastra
// estos mismos registros.
var anFrom = '', anTo = '', anQuery = '';

function getAnalyses(){ var d=getDB(); if(!d.analysis) d.analysis=[]; return d.analysis; }

function initAnalysis(){
  // Por defecto solo el dia: el historial completo se pide ampliando el rango
  var f=document.getElementById('an-from'), t=document.getElementById('an-to');
  if(f && !f.value) f.value = localDateStr();
  if(t && !t.value) t.value = localDateStr();
  anDirty = false; renderAnDirty();
  showDateOrder(document.getElementById('screen-analysis'));
  echoDateRange('an-date-echo','an-from','an-to');
  buildAnalysisSheet();
  renderProductOptions('an-product-list');
  renderAnalysisRows();
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

// El LOT del analisis. Si no se escribio, se toma el de la corrida de ese
// producto y ese dia, que es de donde salio la muestra.
function analysisLot(a){
  if(!a) return '';
  if(a.lot && String(a.lot).trim()) return a.lot;
  if(typeof getRuns !== 'function') return '';
  var day = String(a.date||'').slice(0,10);
  var run = getRuns().filter(function(r){
    return String(r.product||'')===String(a.product||'') &&
           String(r.date||'').slice(0,10)===day && r.lot;
  })[0];
  return run ? run.lot : '';
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

// ===== FILTROS =====
// El texto filtra al instante (es la lista que ya está en memoria); el rango
// de fechas espera al botón, porque puede tener que pedir historial.
var anDirty = false;
function markAnDirty(){
  echoDateRange('an-date-echo','an-from','an-to');
  if(anDirty) return;
  anDirty = true;
  renderAnDirty();
}
function renderAnDirty(){
  var el = document.getElementById('an-dirty');
  if(el) el.style.display = anDirty ? 'block' : 'none';
  var b = document.getElementById('an-go');
  if(b) b.classList.toggle('pending', anDirty);
}
function applyAnFilters(){
  anDirty = false; renderAnDirty();
  var f = document.getElementById('an-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderAnalysisRows); return; }
  renderAnalysisRows();
}
function anOnKey(e){ if(e.key==='Enter') applyAnFilters(); }

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
               String(a.order||'')+' '+String(a.po||'')+' #'+String(a.seq||'')).toLowerCase();
      if(hay.indexOf(anQuery)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date).localeCompare(String(a.date)) || (b.seq||0)-(a.seq||0);
  });
}

// ===== LA HOJA =====
// El esqueleto se arma una sola vez: así la fila de alta no se borra cuando
// se filtra o se guarda. Solo se repinta el cuerpo con los registros.
function buildAnalysisSheet(){
  var host = document.getElementById('an-sheet');
  if(!host || document.getElementById('an-body')) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Date</th><th>Product</th><th class="wide">Cheese</th>'+
      '<th>Customer</th><th>LOT</th><th>Prod. date</th><th>Order</th><th>PO</th>'+
      '<th class="num">Moisture</th><th class="num">Fat</th><th class="num">pH</th>'+
      '<th>By</th><th>Save</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="an-new"><tr class="newrow">'+
      '<td class="rn">new</td>'+
      '<td><input type="date" class="cell" id="an-date"></td>'+
      '<td><input class="cell" id="an-product" list="an-product-list" placeholder="Product #" '+
        'autocomplete="off" autocapitalize="characters" oninput="onAnalysisProduct()"></td>'+
      '<td><input class="cell" id="an-cheese" placeholder="Description"></td>'+
      '<td class="soft" id="an-customer-cell">—</td>'+
      '<td><input class="cell" id="an-lot" placeholder="LOT"></td>'+
      '<td><input class="cell" id="an-proddate" placeholder="e.g. 26002"></td>'+
      '<td><input class="cell" id="an-order" placeholder="Order"></td>'+
      '<td><input class="cell" id="an-po" placeholder="PO"></td>'+
      '<td class="num"><input class="cell num" id="an-moisture" inputmode="decimal" placeholder="%"></td>'+
      '<td class="num"><input class="cell num" id="an-fat" inputmode="decimal" placeholder="%"></td>'+
      '<td class="num"><input class="cell num" id="an-ph" inputmode="decimal" placeholder="pH"></td>'+
      '<td class="soft" id="an-by">'+esc(typeof getInitials==='function' ? getInitials() : '')+'</td>'+
      '<td><button class="sheet-btn" onclick="saveAnalysis()">Add</button></td>'+
      '<td></td>'+
    '</tr></tbody>'+
    '<tbody id="an-body"></tbody></table></div>';
  resetAnalysisRow();
}

// Deja la fila de alta lista para el siguiente registro
function resetAnalysisRow(){
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
  set('an-date', localDateStr());
  ['an-product','an-cheese','an-lot','an-proddate','an-order','an-po','an-moisture','an-fat','an-ph']
    .forEach(function(id){ set(id,''); });
  var by=document.getElementById('an-by');
  if(by && typeof getInitials==='function') by.textContent = getInitials();
  var c=document.getElementById('an-customer-cell'); if(c) c.textContent='—';
}

function renderAnalysisRows(){
  var body = document.getElementById('an-body');
  if(!body) return;
  var list = analysisResults();

  var sum = document.getElementById('an-summary');
  if(sum){
    var full = list.filter(analysisComplete).length;
    var plate = (typeof ymDone==='function') ? list.filter(ymDone).length : 0;
    sum.innerHTML =
      '<div class="kpi"><b>'+list.length+'</b><span>analyses</span></div>'+
      '<div class="kpi"><b>'+full+'</b><span><i class="dot" style="background:var(--pass)"></i>complete</span></div>'+
      '<div class="kpi"><b>'+(list.length-full)+'</b><span><i class="dot" style="background:var(--fail)"></i>partial</span></div>'+
      '<div class="kpi"><b>'+plate+'</b><span>plates read</span></div>';
  }

  if(!list.length){
    body.innerHTML = '<tr><td colspan="15" class="sheet-empty" style="border:0">'+
      'No analyses for these filters. Fill the top row to add the first one.</td></tr>';
    return;
  }
  body.innerHTML = list.slice(0,300).map(function(a,i){ return anRowHTML(a,i+1); }).join('');
  renderIcons(body);
}

function anRowHTML(a, i){
  var cell = function(field, val, ph){
    return '<input class="cell num" inputmode="decimal" placeholder="'+ph+'" data-f="'+field+'" '+
      'value="'+esc(val==null?'':val)+'" onchange="setAnalysisCell('+a.id+',\''+field+'\',this.value)">';
  };
  return '<tr>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td class="code">'+esc(a.product||'—')+'</td>'+
    '<td class="wide">'+esc(a.cheese||'—')+'</td>'+
    '<td class="soft">'+esc(a.customer||'—')+'</td>'+
    '<td class="code">'+esc(analysisLot(a)||'—')+'</td>'+
    '<td class="soft">'+esc(a.prodDate||'—')+'</td>'+
    '<td class="soft">'+esc(a.order||'—')+'</td>'+
    '<td class="soft">'+esc(a.po||'—')+'</td>'+
    '<td class="num">'+cell('moisture', a.moisture, '%')+'</td>'+
    '<td class="num">'+cell('fat', a.fat, '%')+'</td>'+
    '<td class="num">'+cell('ph', a.ph, 'pH')+'</td>'+
    '<td class="soft">'+esc(a.testedBy||'\u2014')+'</td>'+
    '<td><button class="sheet-btn" onclick="saveAnRow('+a.id+',this)">Save</button></td>'+
    '<td><button class="run-del" onclick="deleteAnalysis('+a.id+')" title="Delete">'+
      '<span data-icon="close"></span></button></td>'+
  '</tr>';
}

// Guarda VARIOS campos de un analisis en un solo ciclo: una escritura local
// y una sola subida, en vez de una por celda. Lo usan los botones de fila.
function saveAnalysisFields(id, obj){
  var db = getDB();
  var a = (db.analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(!a) return null;
  Object.keys(obj||{}).forEach(function(f){
    var nv = String(obj[f]==null?'':obj[f]).trim();
    if(typeof logAnalysisChange==='function') logAnalysisChange(a, f, a[f], nv);
    a[f] = nv;
  });
  a.editedAt = localISOStr();
  a.editedBy = currentUser ? currentUser.name : '\u2014';
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('analysis', a);
  return a;
}

// Editar una celda guardada. No repinta la hoja: se perdería el foco al pasar
// de Moisture a Fat. Solo se actualizan los conteos de arriba.
function setAnalysisCell(id, field, value){
  var db = getDB();
  var a = (db.analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(!a) return;
  var nv = String(value==null?'':value).trim();
  if(typeof logAnalysisChange==='function') logAnalysisChange(a, field, a[field], nv);
  a[field] = nv;
  a.editedAt = localISOStr();
  a.editedBy = currentUser ? currentUser.name : '—';
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('analysis', a);
  anRefreshCounts();
  if(typeof refreshRunViews==='function') refreshRunViews();
}

function anRefreshCounts(){
  var sum = document.getElementById('an-summary');
  if(!sum || !sum.children.length) return;
  var list = analysisResults();
  var full = list.filter(analysisComplete).length;
  var plate = (typeof ymDone==='function') ? list.filter(ymDone).length : 0;
  var vals = [list.length, full, list.length-full, plate];
  for(var i=0;i<vals.length;i++){
    var b = sum.children[i] && sum.children[i].querySelector('b');
    if(b) b.textContent = vals[i];
  }
}

// ---- Alta ----
// Guarda la fila completa, a la vista
function saveAnRow(id, btn){
  var vals = readRowFields(btn);
  if(!vals) return;
  saveAnalysisFields(id, vals);
  anRefreshCounts();
  if(typeof refreshRunViews==='function') refreshRunViews();
  flashSaved(btn);
}

function onAnalysisProduct(){
  var num = normNumber(document.getElementById('an-product').value);
  var p = findProduct(num);
  var ch = document.getElementById('an-cheese');
  if(p && ch && !ch.value) ch.value = p.name || '';
  var c = (p && typeof productCustomer==='function') ? productCustomer(p) : null;
  var el = document.getElementById('an-customer-cell');
  if(el) el.textContent = c ? c.company : '—';
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
    lot: g('an-lot'),
    prodDate: g('an-proddate'),
    order: g('an-order'),
    po: g('an-po'),
    moisture: moisture, fat: fat, ph: ph,
    yeast: '', mold: '',                 // los llena Yeast & Mold a los 5 días
    testedBy: (typeof getInitials==='function') ? getInitials() : '',
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
  resetAnalysisRow();
  var pe=document.getElementById('an-product'); if(pe) pe.focus();
  toast('Analysis #'+rec.seq+' saved');
  renderAnalysisRows();
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
  renderAnalysisRows();
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
  set('an-lot', r.lot||'');
  set('an-order', '');
  onAnalysisProduct();
  var mo=document.getElementById('an-moisture'); if(mo) mo.focus();
  toast('Analysis prefilled from the run');
}

// El sistema sigue llamando a renderAnalysis() desde otras pantallas
function renderAnalysis(){ renderAnalysisRows(); }

// ---- Exportar la hoja tal como se ve ----
function csvCell(v){
  v = String(v==null?'':v);
  return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
}
function downloadCSV(name, rows){
  var csv = rows.map(function(r){ return r.map(csvCell).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportAnalysisCSV(){
  var list = analysisResults();
  if(!list.length){ toast('Nothing to export for these filters'); return; }
  var out = [['ID','Date','Product','Cheese','Customer','LOT','Prod. date','Order','PO',
              'Moisture','Fat','pH','Tested by','Yeast','Mold','Plate read']];
  list.forEach(function(a){
    out.push([a.seq||'', String(a.date||'').slice(0,10), a.product||'', a.cheese||'', a.customer||'',
      analysisLot(a), a.prodDate||'', a.order||'', a.po||'', a.moisture||'', a.fat||'', a.ph||'',
      a.testedBy||'', a.yeast||'', a.mold||'', String(a.ymAt||'').slice(0,10)]);
  });
  downloadCSV('sample-analysis-'+localDateStr()+'.csv', out);
}
