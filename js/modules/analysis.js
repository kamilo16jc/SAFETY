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
// Las tarjetas de arriba filtran la hoja: pulsando una se ve solo eso, y
// pulsandola otra vez se vuelve a verlo todo.
var anView = 'all';   // all | complete | partial | plates
function setAnView(v){
  anView = (anView === v || v === 'all') ? 'all' : v;
  renderAnalysisRows();
}

function getAnalyses(){ var d=getDB(); if(!d.analysis) d.analysis=[]; return d.analysis; }

function initAnalysis(){
  anDirty = false; renderAnDirty();
  buildAnalysisSheet();
  renderProductOptions('an-product-list');
  renderAnalysisRows();
}

// Número correlativo del año (como el ID de la hoja). Sigue al ULTIMO que se
// guardo, no al mayor: si QA pone el 10 en la fila nueva, el siguiente es el
// 11 aunque haya numeros mas altos de antes.
function nextAnalysisSeq(year){
  var y = String(year||new Date().getFullYear());
  var ultimo = null;
  getAnalyses().forEach(function(a){
    if(String(a.date||'').slice(0,4)!==y || !(+a.seq>0)) return;
    if(!ultimo) { ultimo = a; return; }
    var ka = String(a.createdAt||''), ku = String(ultimo.createdAt||'');
    if(ka>ku || (ka===ku && (+a.id||0)>(+ultimo.id||0))) ultimo = a;
  });
  return ultimo ? (+ultimo.seq)+1 : 1;
}

// El numero que lleva la fila nueva: el que se escribio, o el que sigue
function anSeqWanted(year){
  var e = document.getElementById('an-seq');
  var n = e ? parseInt(String(e.value).trim(), 10) : NaN;
  return (n > 0 && String(n) === String(e.value).trim()) ? n : nextAnalysisSeq(year);
}

// Sugiere el siguiente numero, salvo que QA ya haya escrito uno
function anSuggestSeq(){
  var e = document.getElementById('an-seq');
  if(!e || e.dataset.manual) return;
  var d = (document.getElementById('an-date')||{}).value || localDateStr();
  e.value = nextAnalysisSeq(String(d).slice(0,4));
}
function anSeqTyped(e){ if(e.value.trim()) e.dataset.manual = '1'; else delete e.dataset.manual; }
function anDateChanged(){ anSuggestSeq(); onAnalysisProduct(); }

// La muestra recolectada de un producto: la de ese mismo dia si la hay; si no,
// la mas reciente que todavia no tenga analisis. Solo cuentan las corridas con
// la muestra recogida y su LOT puesto, de la semana anterior al dia del
// analisis (una muestra de hace un mes no es la que se esta analizando).
function anCollectedRun(product, day){
  if(typeof getRuns !== 'function' || !product) return null;
  day = String(day||'').slice(0,10) || localDateStr();
  var desde = new Date(day+'T12:00:00'); desde.setDate(desde.getDate()-7);
  desde = desde.getFullYear()+'-'+('0'+(desde.getMonth()+1)).slice(-2)+'-'+('0'+desde.getDate()).slice(-2);
  var list = getRuns().filter(function(r){
    var d = String(r.date||'').slice(0,10);
    return String(r.product||'')===String(product) && r.collected &&
           String(r.lot||'').trim() && d<=day && d>=desde;
  });
  if(!list.length) return null;
  var probado = function(r){ return (typeof runTestCount==='function' && runTestCount(r).auto) ? 1 : 0; };
  list.sort(function(a,b){
    var da = String(a.date||'').slice(0,10), db = String(b.date||'').slice(0,10);
    return ((db===day?1:0)-(da===day?1:0)) || (probado(a)-probado(b)) ||
           db.localeCompare(da) || String(b.collectedAt||'').localeCompare(String(a.collectedAt||''));
  });
  return list[0];
}

// Si QA escribe el LOT a mano, ya no se cambia solo
function anLotTyped(e){
  delete e.dataset.auto;
  e.classList.remove('from-run');
  e.title = '';
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
    if(!inScope(a.date, anFrom, anTo, !analysisComplete(a))) return false;
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
      '<th>Customer</th><th>LOT</th><th>Order</th><th>PO</th>'+
      '<th class="num">Moisture</th><th class="num">Fat</th><th class="num">pH</th>'+
      '<th>By</th><th>Save</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="an-new"><tr class="newrow">'+
      '<td class="rn"><input class="cell an-seq" id="an-seq" inputmode="numeric" '+
        'aria-label="Analysis number" title="Analysis number. Change it to set where the count continues" '+
        'oninput="anSeqTyped(this)"></td>'+
      '<td><input type="date" class="cell" id="an-date" onchange="anDateChanged()"></td>'+
      '<td><input class="cell" id="an-product" list="an-product-list" placeholder="Product #" '+
        'autocomplete="off" autocapitalize="characters" oninput="onAnalysisProduct()"></td>'+
      '<td><input class="cell" id="an-cheese" placeholder="Description"></td>'+
      '<td class="soft" id="an-customer-cell">—</td>'+
      '<td><input class="cell" id="an-lot" placeholder="LOT" oninput="anLotTyped(this)"></td>'+

      '<td><input class="cell" id="an-order" placeholder="Order"></td>'+
      '<td><input class="cell" id="an-po" placeholder="PO"></td>'+
      '<td class="num"><input class="cell num" id="an-moisture" inputmode="decimal" placeholder="%" oninput="anMarkNewRow()"></td>'+
      '<td class="num"><input class="cell num" id="an-fat" inputmode="decimal" placeholder="%" oninput="anMarkNewRow()"></td>'+
      '<td class="num"><input class="cell num" id="an-ph" inputmode="decimal" placeholder="pH" oninput="anMarkNewRow()"></td>'+
      '<td class="soft" id="an-by">'+esc(typeof getInitials==='function' ? getInitials() : '')+'</td>'+
      '<td><button class="add-btn" onclick="saveAnalysis()">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
        'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add</button></td>'+
      '<td></td>'+
    '</tr></tbody>'+
    '<tbody id="an-body"></tbody></table></div>';
  resetAnalysisRow();
}

// Deja la fila de alta lista para el siguiente registro
function resetAnalysisRow(){
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
  set('an-date', localDateStr());
  ['an-product','an-cheese','an-lot','an-order','an-po','an-moisture','an-fat','an-ph']
    .forEach(function(id){ set(id,''); });
  var by=document.getElementById('an-by');
  if(by && typeof getInitials==='function') by.textContent = getInitials();
  var c=document.getElementById('an-customer-cell'); if(c) c.textContent='—';
  var lt=document.getElementById('an-lot'); if(lt) anLotTyped(lt);
  var sq=document.getElementById('an-seq'); if(sq) delete sq.dataset.manual;
  window._anRunAuto = false;
  anSuggestSeq();
}

function renderAnalysisRows(){
  var body = document.getElementById('an-body');
  if(!body) return;
  var list = analysisResults();

  var sum = document.getElementById('an-summary');
  if(sum){
    var full = list.filter(analysisComplete).length;
    var plate = (typeof ymDone==='function') ? list.filter(ymDone).length : 0;
    var k = function(v, n, rot, tono, icono){
      return kpiCard(n, rot, {tono:tono, icono:icono, on:anView===v,
                              click:"setAnView('"+v+"')"});
    };
    sum.innerHTML =
      k('all',      list.length,      'analyses',    '',    'clipboard') +
      k('complete', full,             'complete',    'ok',  'check') +
      k('partial',  list.length-full, 'partial',     'bad', 'alert') +
      k('plates',   plate,            'plates read', '',    'droplet');
    renderIcons(sum);
  }

  if(!list.length){
    body.innerHTML = '<tr><td colspan="15" class="sheet-empty" style="border:0">'+
      'No analyses for these filters. Fill the top row to add the first one.</td></tr>';
    return;
  }
  var vista = list.filter(function(a){
    if(anView === 'complete') return analysisComplete(a);
    if(anView === 'partial')  return !analysisComplete(a);
    if(anView === 'plates')   return typeof ymDone === 'function' && ymDone(a);
    return true;
  });
  if(!vista.length){
    body.innerHTML = '<tr><td colspan="15" class="sheet-empty" style="border:0">'+
      'Nothing in this view. Tap the card again to see them all.</td></tr>';
    return;
  }
  body.innerHTML = vista.slice(0,300).map(function(a,i){ return anRowHTML(a,i+1); }).join('');
  renderIcons(body);
}

// Pinta o despinta una celda segun el objetivo del producto de esa fila
function anMarkTarget(el, id, field){
  var a = (getDB().analysis||[]).filter(function(x){ return x.id===id; })[0];
  var p = (typeof findProduct==='function') ? findProduct(a ? a.product : '') : null;
  var fuera = (typeof outOfTarget==='function') && outOfTarget(p, field, el.value);
  el.classList.toggle('out', !!fuera);
  el.title = fuera ? 'Out of the product target' : '';
}

// Lo mismo en la fila de alta, donde el producto es el que se acaba de teclear
function anMarkNewRow(){
  var num = (document.getElementById('an-product')||{}).value || '';
  var p = (typeof findProduct==='function') ? findProduct(num) : null;
  ['moisture','fat','ph'].forEach(function(f){
    var el = document.getElementById('an-'+f);
    if(!el) return;
    var fuera = (typeof outOfTarget==='function') && outOfTarget(p, f, el.value);
    el.classList.toggle('out', !!fuera);
    el.title = fuera ? 'Out of the product target' : '';
  });
}

function anRowHTML(a, i){
  // Lo que se sale del objetivo del producto se pinta al escribirlo, no al
  // guardarlo: quien teclea 6.0 en un pH de 4.9 a 5.5 lo ve en ese momento.
  var prod = (typeof findProduct==='function') ? findProduct(a.product) : null;
  var cell = function(field, val, ph){
    var fuera = (typeof outOfTarget==='function') && outOfTarget(prod, field, val);
    return '<input class="cell num'+(fuera?' out':'')+'" inputmode="decimal" placeholder="'+ph+'" '+
      'data-f="'+field+'" value="'+esc(val==null?'':val)+'" '+
      (fuera ? 'title="Out of the product target" ' : '')+
      'oninput="anMarkTarget(this,'+a.id+',\''+field+'\')" '+
      'onchange="setAnalysisCell('+a.id+',\''+field+'\',this.value)">';
  };
  return '<tr>'+
    '<td class="rn">'+esc(a.seq||i)+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td class="code">'+esc(a.product||'—')+'</td>'+
    '<td class="wide">'+esc(a.cheese||'—')+'</td>'+
    '<td class="soft">'+esc(a.customer||'—')+'</td>'+
    '<td class="code">'+esc(analysisLot(a)||'—')+'</td>'+
    '<td class="soft">'+esc(a.order||'—')+'</td>'+
    '<td class="soft">'+esc(a.po||'—')+'</td>'+
    '<td class="num">'+cell('moisture', a.moisture, '%')+'</td>'+
    '<td class="num">'+cell('fat', a.fat, '%')+'</td>'+
    '<td class="num">'+cell('ph', a.ph, 'pH')+'</td>'+
    '<td class="soft">'+esc(a.testedBy||'\u2014')+'</td>'+
    '<td>'+saveBtn("saveAnRow("+a.id+",this)")+'</td>'+
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
  saveDB(db,'analysis');
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
  saveDB(db,'analysis');
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

  // El LOT sale de la muestra recolectada de ese producto (Production
  // Schedule / List Samples). Se pone solo, pero se puede cambiar: si QA lo
  // escribe a mano, ya no se toca.
  var lot = document.getElementById('an-lot');
  if(!lot) return;
  if(window._anRunAuto){ window._anRunId = null; window._anRunAuto = false; }
  if(lot.value.trim() && lot.dataset.auto !== lot.value) return;
  var day = (document.getElementById('an-date')||{}).value || localDateStr();
  var run = anCollectedRun(num, day);
  if(run){
    lot.value = run.lot;
    lot.dataset.auto = run.lot;
    lot.classList.add('from-run');
    lot.title = 'LOT of the collected sample (Line '+(run.line||'—')+', '+
      fmtDate(String(run.date).slice(0,10))+'). You can change it.';
    if(!window._anRunId){ window._anRunId = run.id; window._anRunAuto = true; }
  } else if(lot.dataset.auto){
    lot.value = '';
    anLotTyped(lot);
  }
}

function saveAnalysis(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; };
  var date = g('an-date') || localDateStr();
  var product = normNumber(g('an-product'));
  if(!product){ toast('Enter the product number'); return; }
  var moisture=g('an-moisture'), fat=g('an-fat'), ph=g('an-ph');
  if(!moisture && !fat && !ph){ toast('Enter at least one measurement'); return; }

  var seq = anSeqWanted(date.slice(0,4));
  var repetido = getAnalyses().some(function(a){
    return String(a.date||'').slice(0,4)===date.slice(0,4) && +a.seq===seq;
  });
  if(repetido && !confirm('Analysis #'+seq+' already exists in '+date.slice(0,4)+
                          '. Save another #'+seq+' anyway?')) return;

  var p = findProduct(product);
  var c = (p && typeof productCustomer==='function') ? productCustomer(p) : null;
  var db = getDB(); if(!db.analysis) db.analysis = [];
  var rec = {
    id: newRecordId(),
    seq: seq,
    date: date,
    product: product,
    cheese: g('an-cheese') || (p ? (p.name||'') : ''),
    customerId: c ? c.customerId : '',
    // la llave dice CUAL cliente: el Customer ID se puede repetir
    customerKey: c ? custKey(c) : '',
    customer: c ? c.company : '',
    lot: g('an-lot'),
    prodDate: date,          // la fecha de la hoja ES la de produccion
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
  saveDB(db,'analysis');
  if(window.saveToFirebase) window.saveToFirebase('analysis', rec);
  logActivity('analysis','Sample analysis recorded',
    'Product '+rec.product+(rec.cheese?' — '+rec.cheese:'')+
    ' · Moisture '+(rec.moisture||'—')+' · Fat '+(rec.fat||'—')+' · pH '+(rec.ph||'—'),
    rec.testedBy||(currentUser?currentUser.name:'—'));

  window._anRunId = null;
  window._anRunAuto = false;
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
  saveDB(db,'analysis');
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
  window._anRunAuto = false;
  var lt=document.getElementById('an-lot'); if(lt) anLotTyped(lt);
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
// Lo que bajan todas las listas del sistema. Se sigue llamando CSV por
// historia, pero entrega un .xlsx: el CSV separado por comas se abria corrido
// en los equipos con Windows en español, que separan por punto y coma, y la
// fila entera caia en la primera celda. El CSV crudo queda de repuesto.
function downloadCSV(name, rows){
  if(typeof downloadSheet === 'function'){ downloadSheet(name, rows); return; }
  downloadCSVRaw(name, rows);
}

function downloadCSVRaw(name, rows){
  var csv = rows.map(function(r){ return r.map(csvCell).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = String(name||'export').replace(/\.xlsx$/i, '.csv');
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
