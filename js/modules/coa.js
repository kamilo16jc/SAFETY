// ===== MÓDULO COA =====
// El certificado de análisis se arma con lo que ya está capturado, sin volver
// a escribir nada: Moisture / Fat / pH vienen de Sample Analysis, Yeast y Mold
// de la placa, y aquí se agregan los resultados que devuelve el laboratorio
// EXTERNO (las columnas "Matrix" de la hoja), el Coliform, el E. coli y el
// dictamen final.
//
// Cuatro pantallas:
//   COA Generator · genera y numera el certificado
//   Search        · la búsqueda, acotada a lo del módulo
//   Changes       · qué se cambió, quién y cuándo, sobre todo después de emitir
//   Lab Results   · captura de los resultados del laboratorio externo

// ---- Cambios: todo lo que se toca queda anotado en el propio registro ----
function logAnalysisChange(a, field, from, to){
  if(!a) return;
  from = String(from==null?'':from);
  to   = String(to==null?'':to);
  if(from===to) return;
  if(!a.changes) a.changes = [];
  a.changes.push({
    at: localISOStr(),
    by: currentUser ? currentUser.name : '—',
    field: field,
    from: from,
    to: to,
    afterCoa: !!a.coaNo            // lo grave es cambiar algo ya certificado
  });
  if(a.changes.length > 60) a.changes = a.changes.slice(-60);
}

// Editor genérico de una celda de análisis, con su rastro
function setAnalysisValue(id, field, value){
  var db = getDB();
  var a = (db.analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(!a) return null;
  var v = String(value==null?'':value).trim();
  logAnalysisChange(a, field, a[field], v);
  a[field] = v;
  a.editedAt = localISOStr();
  a.editedBy = currentUser ? currentUser.name : '—';
  saveDB(db,'analysis');
  if(window.saveToFirebase) window.saveToFirebase('analysis', a);
  return a;
}

// ============================================================
// LAB RESULTS — lo que devuelve el laboratorio externo
// ============================================================
var LR_FIELDS = [
  {f:'mxMoisture', t:'Matrix moisture'},
  {f:'mxFat',      t:'Matrix fat'},
  {f:'mxPh',       t:'Matrix pH'},
  {f:'coliform',   t:'Coliform'},
  {f:'ecoli',      t:'E. coli'},
  {f:'mxYeast',    t:'Matrix yeast'},
  {f:'mxMold',     t:'Matrix mold'}
];

function labResultsHave(a){
  return LR_FIELDS.some(function(x){ return a[x.f]!=null && String(a[x.f]).trim()!==''; });
}
function labResultsComplete(a){
  return !!(a.result && String(a.result).trim());
}

var lrDirty = false;
function initLabResults(){
  lrDirty = false; renderLrDirty();
  renderLabResults();
}
function markLrDirty(){
  if(lrDirty) return;
  lrDirty = true; renderLrDirty();
}
function renderLrDirty(){
  var el = document.getElementById('lr-dirty');
  if(el) el.style.display = lrDirty ? 'block' : 'none';
  var b = document.getElementById('lr-go');
  if(b) b.classList.toggle('pending', lrDirty);
}
function applyLrFilters(){
  lrDirty = false; renderLrDirty();
  var f = document.getElementById('lr-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderLabResults); return; }
  renderLabResults();
}

var lrView = 'waiting';   // waiting | in | done | all
function setLrView(v){ lrView = v; renderLabResults(); }

function lrRows(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var from=g('lr-from'), to=g('lr-to'), q=(g('lr-search')||'').trim().toLowerCase();
  return (typeof getAnalyses==='function' ? getAnalyses() : []).filter(function(a){
    if(!inScope(a.date, from, to, lrState(a)!=='done')) return false;
    if(q){
      var hay=(String(a.product||'')+' '+String(a.cheese||'')+' '+String(a.customer||'')+' '+
               String(a.order||'')+' '+String(a.po||'')+' #'+String(a.seq||'')).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date).localeCompare(String(a.date)) || (b.seq||0)-(a.seq||0);
  });
}

function lrState(a){
  if(labResultsComplete(a)) return 'done';
  if(labResultsHave(a))     return 'in';
  return 'waiting';
}

function renderLabResults(){
  var host = document.getElementById('lr-sheet');
  if(!host) return;
  var all = lrRows();

  var kp = document.getElementById('lr-kpis');
  if(kp){
    var n = function(k){ return k==='all' ? all.length
      : all.filter(function(a){ return lrState(a)===k; }).length; };
    kp.innerHTML = [
      ['waiting', n('waiting'), 'waiting for the lab',    'bad',  'clock'],
      ['in',      n('in'),      'results in, no verdict', 'warn', 'doc'],
      ['done',    n('done'),    'closed',                 'ok',   'check'],
      ['all',     all.length,   'records in range',       '',     'grid']
    ].map(function(k){
      return kpiCard(k[1], k[2], {tono:k[3], icono:k[4], on:lrView===k[0],
                                  click:"setLrView('"+k[0]+"')"});
    }).join('');
    renderIcons(kp);
  }

  var list = all.filter(function(a){ return lrView==='all' || lrState(a)===lrView; });
  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No records in range. A record shows up here once its Sample Analysis is captured.')+
      '</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>ID</th><th>Date</th><th>Customer</th><th>Product</th>'+
      '<th class="wide">Cheese</th><th>Prod. date</th><th>Order</th><th>PO</th>'+
      '<th class="num">Moisture</th><th class="num">Matrix</th>'+
      '<th class="num">Fat</th><th class="num">Matrix</th>'+
      '<th class="num">pH</th><th class="num">Matrix</th>'+
      '<th>By</th><th class="num">Coliform</th><th class="num">E. coli</th>'+
      '<th class="num">Yeast</th><th class="num">Mold</th>'+
      '<th class="num">Matrix Y</th><th class="num">Matrix M</th>'+
      '<th>Read by</th><th>Result</th><th>Name by</th><th>Save</th>'+
    '</tr></thead><tbody>'+
    list.map(function(a,i){ return lrRowHTML(a,i+1); }).join('')+
    '</tbody></table></div>';
}

function lrRowHTML(a, i){
  var v = function(x){ return (x==null || x==='') ? '—' : esc(x); };
  var cell = function(field, ph){
    return '<input class="cell num" inputmode="decimal" placeholder="'+ph+'" data-f="'+field+'" '+
      'value="'+esc(a[field]==null?'':a[field])+'" '+
      'onchange="setLrCell('+a.id+',\''+field+'\',this.value)">';
  };
  var txt = function(field, ph){
    return '<input class="cell" placeholder="'+ph+'" data-f="'+field+'" '+
      'value="'+esc(a[field]==null?'':a[field])+'" '+
      'onchange="setLrCell('+a.id+',\''+field+'\',this.value)">';
  };
  return '<tr'+(lrState(a)==='done'?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">#'+v(a.seq)+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td class="soft">'+v(a.customer)+'</td>'+
    '<td class="code">'+v(a.product)+'</td>'+
    '<td class="wide">'+v(a.cheese)+'</td>'+
    '<td class="soft">'+v(a.prodDate)+'</td>'+
    '<td class="soft">'+v(a.order)+'</td>'+
    '<td class="soft">'+v(a.po)+'</td>'+
    '<td class="num soft">'+v(a.moisture)+'</td><td class="num">'+cell('mxMoisture','%')+'</td>'+
    '<td class="num soft">'+v(a.fat)+'</td><td class="num">'+cell('mxFat','%')+'</td>'+
    '<td class="num soft">'+v(a.ph)+'</td><td class="num">'+cell('mxPh','pH')+'</td>'+
    '<td class="soft">'+v(a.testedBy)+'</td>'+
    '<td class="num">'+cell('coliform','CFU/g')+'</td>'+
    '<td class="num">'+cell('ecoli','CFU/g')+'</td>'+
    '<td class="num soft">'+v(a.yeast)+'</td><td class="num soft">'+v(a.mold)+'</td>'+
    '<td class="num">'+cell('mxYeast','CFU/g')+'</td><td class="num">'+cell('mxMold','CFU/g')+'</td>'+
    '<td class="soft">'+v(a.ymBy)+'</td>'+
    '<td>'+txt('result','e.g. No Moldy')+'</td>'+
    '<td class="soft" id="lr-by-'+a.id+'">'+v(a.resultBy)+'</td>'+
    '<td>'+saveBtn("saveLrRow("+a.id+",this)")+'</td>'+
  '</tr>';
}

// Guardar una celda: no repinta la hoja (se perdería el foco), solo el estado
function setLrCell(id, field, value){
  var a = setAnalysisValue(id, field, value);
  if(!a) return;
  if(field==='result' && a.result && !a.resultBy && currentUser && typeof getInitials==='function'){
    a = setAnalysisValue(id, 'resultBy', getInitials()) || a;
    var byEl = document.getElementById('lr-by-'+id);
    if(byEl) byEl.textContent = a.resultBy || '\u2014';
  }
  lrRefreshCounts();
}
// Guarda toda la fila de resultados, a la vista
function saveLrRow(id, btn){
  var vals = readRowFields(btn);
  if(!vals) return;
  var a = (typeof saveAnalysisFields==='function') ? saveAnalysisFields(id, vals) : null;
  if(a && a.result && !a.resultBy && currentUser && typeof getInitials==='function'){
    a = saveAnalysisFields(id, {resultBy: getInitials()}) || a;
  }
  var byEl = document.getElementById('lr-by-'+id);
  if(byEl && a) byEl.textContent = a.resultBy || '\u2014';
  lrRefreshCounts();
  flashSaved(btn);
}

function lrRefreshCounts(){
  var kp = document.getElementById('lr-kpis');
  if(!kp) return;
  var all = lrRows();
  var vals = [
    all.filter(function(a){ return lrState(a)==='waiting'; }).length,
    all.filter(function(a){ return lrState(a)==='in'; }).length,
    all.filter(function(a){ return lrState(a)==='done'; }).length,
    all.length
  ];
  for(var i=0;i<vals.length;i++){
    var b = kp.children[i] && kp.children[i].querySelector('b');
    if(b) b.textContent = vals[i];
  }
}

function exportLabResultsCSV(){
  var list = lrRows();
  if(!list.length){ toast('Nothing to export for these filters'); return; }
  var out = [['ID','Date','Customer','Product','Cheese','Production date','Order','PO',
    'Moisture','Matrix moisture','Fat','Matrix fat','pH','Matrix pH','Tested by',
    'Coliform','E. coli','Yeast','Mold','Matrix yeast','Matrix mold','Read by','Result','Name by']];
  list.forEach(function(a){
    out.push([a.seq||'', String(a.date||'').slice(0,10), a.customer||'', a.product||'', a.cheese||'',
      a.prodDate||'', a.order||'', a.po||'', a.moisture||'', a.mxMoisture||'', a.fat||'', a.mxFat||'',
      a.ph||'', a.mxPh||'', a.testedBy||'', a.coliform||'', a.ecoli||'', a.yeast||'', a.mold||'',
      a.mxYeast||'', a.mxMold||'', a.ymBy||'', a.result||'', a.resultBy||'']);
  });
  downloadCSV('lab-results-'+localDateStr()+'.csv', out);
}

// ============================================================
// COA GENERATOR
// ============================================================
var coaPicks = {}, coaDirty = false, coaView = 'ready';

function nextCoaNo(year){
  var y = String(year || new Date().getFullYear());
  var max = 0;
  (typeof getAnalyses==='function' ? getAnalyses() : []).forEach(function(a){
    var m = /^COA-(\d{4})-(\d+)$/.exec(String(a.coaNo||''));
    if(m && m[1]===y && +m[2]>max) max = +m[2];
  });
  return 'COA-'+y+'-'+String(max+1).padStart(3,'0');
}

// ¿Este producto va al laboratorio de fuera? Si va, el certificado espera su
// dictamen; si no va, no hay dictamen que esperar y nunca llegaria.
function coaNeedsLab(a){
  var p = (typeof findProduct==='function') ? findProduct(a.product) : null;
  if(!p) return false;
  if(p.externalLab === true) return true;
  if(p.externalLab === false) return false;
  return (typeof hasLabTests==='function') ? hasLabTests(p) : ((p.labTests||[]).length > 0);
}

// Un registro se puede certificar cuando tiene las tres medidas y, SOLO si el
// producto va al laboratorio de fuera, su dictamen. La placa de yeast & mold no
// lo detiene: se lee a los cinco dias y la forma la imprime como "Pending",
// que es justo lo que dice la del cliente.
function coaReady(a){
  if(typeof analysisComplete==='function' && !analysisComplete(a)) return false;
  if(a.result && String(a.result).trim()) return true;
  return !coaNeedsLab(a);
}
function coaState(a){
  if(a.coaNo) return 'issued';
  return coaReady(a) ? 'ready' : 'waiting';
}

function initCoa(){
  coaPicks = {}; coaDirty = false; renderCoaDirty();
  renderCoa();
}
function markCoaDirty(){
  if(coaDirty) return;
  coaDirty = true; renderCoaDirty();
}
function renderCoaDirty(){
  var el = document.getElementById('coa-dirty');
  if(el) el.style.display = coaDirty ? 'block' : 'none';
  var b = document.getElementById('coa-go');
  if(b) b.classList.toggle('pending', coaDirty);
}
function applyCoaFilters(){
  coaDirty = false; renderCoaDirty();
  var f = document.getElementById('coa-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderCoa); return; }
  renderCoa();
}
function setCoaView(v){ coaView = v; renderCoa(); }

function coaRows(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var from=g('coa-from'), to=g('coa-to'), q=(g('coa-search')||'').trim().toLowerCase();
  return (typeof getAnalyses==='function' ? getAnalyses() : []).filter(function(a){
    // Pendiente aqui es "medido y sin certificar", aunque el dictamen no haya
    // llegado: si solo se salvara lo que ya esta listo, la cola de espera
    // desapareceria de la pantalla en cuanto pasara el dia.
    var pendiente = !a.coaNo &&
      (typeof analysisComplete!=='function' || analysisComplete(a));
    if(!inScope(a.date, from, to, pendiente)) return false;
    if(q){
      var hay=(String(a.product||'')+' '+String(a.cheese||'')+' '+String(a.customer||'')+' '+
               String(a.order||'')+' '+String(a.po||'')+' '+String(a.coaNo||'')+
               ' #'+String(a.seq||'')).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date).localeCompare(String(a.date)) || (b.seq||0)-(a.seq||0);
  });
}

function renderCoa(){
  var host = document.getElementById('coa-sheet');
  if(!host) return;
  var all = coaRows();

  var kp = document.getElementById('coa-kpis');
  if(kp){
    var n = function(k){ return k==='all' ? all.length
      : all.filter(function(a){ return coaState(a)===k; }).length; };
    kp.innerHTML = [
      ['ready',   n('ready'),   'ready to certify', 'bad', 'pdf'],
      ['waiting', n('waiting'), 'incomplete',       '',    'clock'],
      ['issued',  n('issued'),  'certified',        'ok',  'check'],
      ['all',     all.length,   'records in range', '',    'grid']
    ].map(function(k){
      return kpiCard(k[1], k[2], {tono:k[3], icono:k[4], on:coaView===k[0],
                                  click:"setCoaView('"+k[0]+"')"});
    }).join('');
    renderIcons(kp);
  }

  var list = all.filter(function(a){ return coaView==='all' || coaState(a)===coaView; });
  var bar = document.getElementById('coa-picked');
  var picked = list.filter(function(a){ return coaPicks[a.id]; });
  if(bar){
    bar.innerHTML = picked.length
      ? '<b>'+picked.length+'</b> record'+(picked.length===1?'':'s')+' selected'+
        ' <button class="sheet-btn" onclick="generateCoa()">Generate COA</button>'+
        ' <button class="sheet-btn" onclick="printCoaView()">Print view</button>'+
        ' <button class="sheet-btn" onclick="clearCoaPicks()">Clear</button>'
      : '';
    bar.style.display = picked.length ? 'flex' : 'none';
  }

  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No records in range. A record can be certified once it has Moisture, Fat '+
                    'and pH captured and a verdict in Lab Results.')+
      '</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th></th><th>ID</th><th>Date</th><th>Customer</th><th>Product</th>'+
      '<th class="wide">Cheese</th><th>Order</th><th>PO</th><th>Result</th>'+
      '<th>COA</th><th>Rev.</th><th>Issued</th><th>Status</th><th></th>'+
    '</tr></thead><tbody>'+
    list.map(function(a,i){ return coaRowHTML(a,i+1); }).join('')+
    '</tbody></table></div>';
  renderIcons(host);
}

function coaRowHTML(a, i){
  var v = function(x){ return (x==null || x==='') ? '—' : esc(x); };
  var st = coaState(a);
  // "Pending" decia lo mismo para el que ya se puede emitir y para el que no.
  var pill = st==='issued' ? '<span class="pill ok">Certified</span>'
           : st==='ready'  ? '<span class="pill ok">Ready</span>'
           : '<span class="pill bad">'+(coaMissing(a))+'</span>';
  var dirty = a.coaNo && coaChangedAfterIssue(a)
    ? ' <span class="pill bad" title="Edited after the COA was issued">changed</span>' : '';
  return '<tr'+(st==='issued'?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="mid"><input type="checkbox"'+(coaPicks[a.id]?' checked':'')+
      (st==='waiting'?' disabled':'')+' onchange="toggleCoaPick('+a.id+',this.checked)"></td>'+
    '<td class="code">#'+v(a.seq)+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td>'+v(a.customer)+'</td>'+
    '<td class="code">'+v(a.product)+'</td>'+
    '<td class="wide">'+v(a.cheese)+'</td>'+
    '<td class="soft">'+v(a.order)+'</td>'+
    '<td class="soft">'+v(a.po)+'</td>'+
    '<td class="soft">'+v(a.result)+'</td>'+
    '<td class="code">'+v(a.coaNo)+'</td>'+
    '<td class="num">'+(a.coaRev ? 'R'+a.coaRev : '—')+'</td>'+
    '<td class="soft">'+(a.coaAt ? esc(fmtDate(a.coaAt))+' · '+esc(a.coaBy||'') : '—')+'</td>'+
    '<td>'+pill+dirty+'</td>'+
    '<td>'+(a.coaNo
      ? '<button class="ico-btn sm" title="Open the certificate again" '+
        'aria-label="Open certificate" onclick="reprintCoa('+a.id+')"><span data-icon="doc"></span></button>'
      : st==='ready'
        ? '<button class="sheet-btn" title="Issue the certificate for this record" '+
          'onclick="issueOne('+a.id+')">COA</button>'
        : '<span class="soft">—</span>')+'</td>'+
  '</tr>';
}

// Qué le falta a un registro para poder certificarse
// Que le falta, dicho de forma que se pueda actuar
function coaMissing(a){
  if(!(a.moisture && a.fat && a.ph)) return 'needs analysis';
  if(coaNeedsLab(a) && !(a.result && String(a.result).trim())){
    var p = (typeof findProduct==='function') ? findProduct(a.product) : null;
    var porTests = p && p.externalLab !== true &&
                   (typeof hasLabTests==='function') && hasLabTests(p);
    // Si espera por tests heredados del cliente, se dice: es lo que sorprende
    return porTests ? 'waiting for lab · tests from customer' : 'waiting for lab';
  }
  return 'incomplete';
}
// ¿Se tocó algo después de emitir el certificado?
function coaChangedAfterIssue(a){
  return (a.changes||[]).some(function(c){ return c.afterCoa; });
}

// Emitir el certificado de UN registro, desde su propia fila
function issueOne(id){
  coaPicks = {};
  coaPicks[id] = true;
  generateCoa();
}

function toggleCoaPick(id, on){
  if(on) coaPicks[id] = true; else delete coaPicks[id];
  renderCoa();
}
function clearCoaPicks(){ coaPicks = {}; renderCoa(); }

// Emite el certificado de lo seleccionado. Si ya estaba emitido, sube revisión.
function generateCoa(){
  var db = getDB();
  var list = (db.analysis||[]).filter(function(a){ return coaPicks[a.id]; });
  if(!list.length){ toast('Select at least one record'); return; }
  var bad = list.filter(function(a){ return !coaReady(a); });
  if(bad.length){ toast(bad.length+' selected record(s) are still incomplete'); return; }

  // Un certificado por cliente: no se mezclan clientes en la misma hoja
  var byCustomer = {};
  list.forEach(function(a){
    var k = String(a.customer||'—');
    (byCustomer[k] = byCustomer[k] || []).push(a);
  });
  var keys = Object.keys(byCustomer);
  if(keys.length > 1){
    if(!confirm('The selection covers '+keys.length+' customers. One certificate will be issued for each. Continue?')) return;
  }

  var issued = [];
  keys.forEach(function(k){
    var group = byCustomer[k];
    var reissue = group.filter(function(a){ return a.coaNo; });
    var no, rev;
    if(reissue.length === group.length && group.length){
      no  = group[0].coaNo;                       // misma hoja, nueva revisión
      rev = (parseInt(group[0].coaRev,10) || 1) + 1;
    } else {
      no  = nextCoaNo(new Date().getFullYear());
      rev = 1;
    }
    group.forEach(function(a){
      a.coaNo  = no;
      a.coaRev = rev;
      a.coaAt  = localISOStr();
      a.coaBy  = currentUser ? currentUser.name : '—';
      if(!a.changes) a.changes = [];
      a.changes.push({at:a.coaAt, by:a.coaBy, field:'COA', from:rev>1?('R'+(rev-1)):'', to:no+' R'+rev, afterCoa:false});
    });
    issued.push({no:no, rev:rev, customer:k, list:group});
  });

  saveDB(db);
  if(window.saveToFirebase) list.forEach(function(a){ window.saveToFirebase('analysis', a); });
  issued.forEach(function(g){
    logActivity('analysis','Certificate of analysis issued',
      g.no+' R'+g.rev+' · '+g.customer+' · '+g.list.length+' product(s)',
      currentUser?currentUser.name:'—');
  });

  // Lo que se entrega es la forma del cliente rellenada —su archivo, con su
  // logo y sus bordes—, no una replica nuestra. La vista de impresion sigue
  // ahi, en su boton, para imprimir de prisa.
  var todos = [];
  issued.forEach(function(g){ g.list.forEach(function(a){ todos.push(a); }); });
  if(typeof downloadCoaXlsx === 'function'){
    var i = 0;
    var siguiente = function(){
      if(i >= todos.length) return;
      downloadCoaXlsx(todos[i++]).then(function(){ setTimeout(siguiente, 400); })
        .catch(function(e){
          toast('Could not fill the form: '+(e.message||e));
          openCoaDocument(issued[0]);          // si la plantilla falla, al menos la vista
        });
    };
    siguiente();
  } else {
    issued.forEach(openCoaDocument);
  }
  coaPicks = {};
  renderCoa();
  toast(issued.length===1 ? issued[0].no+' issued' : issued.length+' certificates issued');
}

// La vista de impresion de lo que este marcado, sin emitir ni numerar nada
function printCoaView(){
  var lista = (getDB().analysis||[]).filter(function(a){ return coaPicks[a.id]; });
  if(!lista.length){ toast('Select at least one record'); return; }
  openCoaDocument({no:lista[0].coaNo||'—', rev:lista[0].coaRev||1,
                   customer:lista[0].customer||'—', list:lista});
}

// Vuelve a abrir el certificado de un registro ya emitido, sin cambiar nada
function reprintCoa(id){
  var a = (getDB().analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(!a || !a.coaNo) return;
  var group = (getDB().analysis||[]).filter(function(x){ return x.coaNo===a.coaNo; });
  openCoaDocument({no:a.coaNo, rev:a.coaRev||1, customer:a.customer||'—', list:group});
}

// ---- El documento ----
// Misma cara que la forma de Excel del cliente: titulo, la ficha en dos
// columnas, y los resultados contra su objetivo. Una hoja por registro, que es
// como se manda: un LOT, un producto, un certificado.
var COA_METODO = {
  moisture: 'AOAC: PVM1:2004',
  fat:      'AOAC: PVM1:2005',
  ph:       'pH Meter',
  yeast:    'AOAC 997.02',
  mold:     'AOAC 997.02'
};

// Tres caminos hasta el cliente, en este orden: lo que quedo grabado en el
// analisis, su nombre, y —si el analisis se capturo sin cliente, que es lo
// normal en los viejos— el propio producto, que si sabe de quien es.
function coaCustomerOf(a){
  if(typeof customerById === 'function' && a.customerId){
    var c = customerById(a.customerId);
    if(c) return c;
  }
  var lista = (typeof getCustomers === 'function') ? getCustomers() : [];
  if(a.customer){
    var porNombre = lista.filter(function(c){ return c.company === a.customer; })[0];
    if(porNombre) return porNombre;
  }
  var p = (typeof findProduct === 'function') ? findProduct(a.product) : null;
  var delProducto = (p && typeof productCustomer === 'function') ? productCustomer(p) : null;
  return delProducto || {};
}

// Lo que el certificado necesita del producto cuando el analisis no lo trae
function coaProductOf(a){
  return (typeof findProduct === 'function') ? (findProduct(a.product) || {}) : {};
}

// dd/mm/aaaa del pais, como en la forma
function coaFecha(iso){
  var d = new Date(String(iso||'').slice(0,10)+'T12:00:00');
  return isNaN(d) ? (iso||'') : (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
}

function openCoaDocument(g){
  // La hoja no se dibuja "parecida": se reconstruyo desde el propio Excel
  // —su rejilla de 37 columnas, sus altos de fila, sus combinadas, su Times
  // New Roman, sus bordes y su logo— y se guarda en assets/coa_view.html con
  // las mismas marcas que la plantilla. Aqui solo se rellenan y se imprime,
  // asi que el PDF que salga es la forma, no una version nuestra.
  var lista = g.list || [];
  fetch('assets/coa_view.html')
    .then(function(r){ if(!r.ok) throw new Error('falta assets/coa_view.html'); return r.text(); })
    .then(function(plantilla){
      var hojas = lista.map(function(a, i){
        var cuerpo = plantilla;
        var map = (typeof buildCoaTokens === 'function') ? buildCoaTokens(a) : {};
        Object.keys(map).forEach(function(k){
          cuerpo = cuerpo.split('{{'+k+'}}').join(
            String(map[k]==null?'':map[k]).replace(/[&<>]/g, function(c){
              return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }));
        });
        cuerpo = cuerpo.replace(/\{\{[A-Z0-9]+\}\}/g, '');
        return '<div class="coa-pagina"'+(i ? ' style="page-break-before:always"' : '')+'>'+
               cuerpo+'</div>';
      }).join('');

      var doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+
        String(g.no||'COA')+'</title><style>'+
        'body{margin:0;background:#f4f4f2;padding:26px 0;font-family:Arial,sans-serif}'+
        '.coa-pagina{background:#fff;margin:0 auto 26px;padding:26px 30px;width:946px;'+
          'box-shadow:0 2px 10px rgba(0,0,0,.18)}'+
        '.coa-hoja{position:relative;margin:0 auto}'+
        '.coa-logo{position:absolute;z-index:2}'+
        '.coa-rejilla{border-collapse:collapse;table-layout:fixed;width:100%}'+
        '.coa-rejilla td{padding:0 2px;overflow:hidden;white-space:nowrap}'+
        '.savebtn{position:fixed;top:14px;right:16px;background:#141a17;color:#fff;border:0;'+
          'border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;'+
          'font-family:inherit;z-index:9}'+
        '@page{size:letter portrait;margin:11mm}'+
        '@media print{body{background:#fff;padding:0}.savebtn{display:none}'+
          '.coa-pagina{box-shadow:none;margin:0;padding:0;width:auto}}'+
      '</style></head><body>'+
      '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
      hojas+'</body></html>';

      var blob = new Blob([doc], {type:'text/html'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    })
    .catch(function(e){ toast('Could not open the certificate: '+(e.message||e)); });
}

// ============================================================
// STATUS
// En que va cada muestra, sin numeros ni detalle: el LOT, de quien es, su PO
// y su orden, si la placa ya se leyo y si el laboratorio externo ya respondio.
//
// Dos pendientes distintos, que es lo que hay que saber para perseguirlos:
//   Pending QA Lab  -> falta leer la placa, que la lee la casa
//   Pending Lab     -> la placa esta leida, pero falta el informe del externo
// ============================================================
var stView = 'all';   // all | qa | lab | done
var stDirty = false;

function initCoaStatus(){
  stDirty = false; renderStDirty();
  renderCoaStatus();
}
function markStDirty(){
  if(stDirty) return;
  stDirty = true; renderStDirty();
}
function renderStDirty(){
  var el = document.getElementById('st-dirty');
  if(el) el.style.display = stDirty ? 'block' : 'none';
  var b = document.getElementById('st-go');
  if(b) b.classList.toggle('pending', stDirty);
}
function applyStFilters(){
  stDirty = false; renderStDirty();
  var f = document.getElementById('st-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderCoaStatus); return; }
  renderCoaStatus();
}
function setStView(v){ stView = v; renderCoaStatus(); }

// La placa la lee la casa; el informe lo manda el laboratorio externo
function stPlateDone(a){ return (typeof ymDone==='function') ? ymDone(a) : !!(a.yeast && a.mold); }
function stLabDone(a){ return !!(a.result && String(a.result).trim()); }
function stState(a){
  if(!stPlateDone(a)) return 'qa';
  if(!stLabDone(a))   return 'lab';
  return 'done';
}

function stRows(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var from=g('st-from'), to=g('st-to'), q=(g('st-search')||'').trim().toLowerCase();
  return (typeof getAnalyses==='function' ? getAnalyses() : []).filter(function(a){
    if(!inScope(a.date, from, to, stState(a)!=='done')) return false;
    if(q){
      var hay=(String(analysisLot(a)||'')+' '+String(a.customer||'')+' '+String(a.po||'')+' '+
               String(a.order||'')+' '+String(a.product||'')).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    // Primero lo que lleva mas tiempo esperando
    var rank = {qa:0, lab:1, done:2};
    return (rank[stState(a)]-rank[stState(b)]) || String(a.date).localeCompare(String(b.date));
  });
}

function renderCoaStatus(){
  var host = document.getElementById('st-sheet');
  if(!host) return;
  var all = stRows();

  var kp = document.getElementById('st-kpis');
  if(kp){
    var n = function(k){ return k==='all' ? all.length
      : all.filter(function(a){ return stState(a)===k; }).length; };
    kp.innerHTML = [
      ['qa',   n('qa'),    'pending QA lab',   'warn', 'droplet'],
      ['lab',  n('lab'),   'pending lab',      'bad',  'doc'],
      ['done', n('done'),  'complete',         'ok',   'check'],
      ['all',  all.length, 'samples in range', '',     'grid']
    ].map(function(k){
      return kpiCard(k[1], k[2], {tono:k[3], icono:k[4], on:stView===k[0],
                                  click:"setStView('"+k[0]+"')"});
    }).join('');
    renderIcons(kp);
  }

  var list = all.filter(function(a){ return stView==='all' || stState(a)===stView; });
  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No samples in range.')+'</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>LOT</th><th>Customer</th><th>PO</th><th>Order</th>'+
      '<th>Plate</th><th>Lab report</th><th>Status</th>'+
    '</tr></thead><tbody>'+
    list.map(function(a,i){ return stRowHTML(a,i+1); }).join('')+
    '</tbody></table></div>';
}

function stRowHTML(a, i){
  var v = function(x){ return (x==null || x==='') ? '\u2014' : esc(x); };
  var st = stState(a);

  // La placa: leida, o para cuando se estima. El domingo no se leen placas.
  var plate;
  if(stPlateDone(a)){
    plate = '<span class="pill ok">Read'+(a.ymAt ? ' \u00b7 '+esc(fmtDate(a.ymAt)) : '')+'</span>';
  } else {
    var due = (typeof ymDueDate==='function') ? ymDueDate(a) : '';
    var left = (typeof ymDaysLeft==='function') ? ymDaysLeft(a) : 0;
    plate = '<span class="pill'+(left<=0?' bad':'')+'">'+
      (due ? esc(fmtDate(due)) : '\u2014')+
      (left>0 ? ' \u00b7 in '+left+'d' : (left<0 ? ' \u00b7 '+Math.abs(left)+'d late' : ' \u00b7 today'))+
      '</span>';
  }

  var lab = stLabDone(a)
    ? '<span class="pill ok">Completed</span>'
    : '<span class="pill bad">Pending</span>';

  var status = st==='done' ? '<span class="pill ok">Complete</span>'
             : st==='qa'   ? '<span class="pill warn">Pending QA Lab</span>'
             : '<span class="pill bad">Pending Lab</span>';

  return '<tr'+(st==='done'?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+v(analysisLot(a))+'</td>'+
    '<td>'+v(a.customer)+'</td>'+
    '<td class="soft">'+v(a.po)+'</td>'+
    '<td class="soft">'+v(a.order)+'</td>'+
    '<td>'+plate+'</td>'+
    '<td>'+lab+'</td>'+
    '<td>'+status+'</td>'+
  '</tr>';
}

function exportCoaStatusCSV(){
  var list = stRows().filter(function(a){ return stView==='all' || stState(a)===stView; });
  if(!list.length){ toast('Nothing to export for this view'); return; }
  var label = {qa:'Pending QA Lab', lab:'Pending Lab', done:'Complete'};
  var out = [['LOT','Customer','PO','Order','Plate read','Plate due','Lab report','Status']];
  list.forEach(function(a){
    out.push([analysisLot(a), a.customer||'', a.po||'', a.order||'',
      stPlateDone(a) ? String(a.ymAt||'').slice(0,10) : '',
      stPlateDone(a) ? '' : (typeof ymDueDate==='function' ? ymDueDate(a) : ''),
      stLabDone(a) ? (a.result||'in') : '',
      label[stState(a)]]);
  });
  downloadCSV('coa-status-'+localDateStr()+'.csv', out);
}


function exportCoaCSV(){
  var list = coaRows().filter(function(a){ return coaView==='all' || coaState(a)===coaView; });
  if(!list.length){ toast('Nothing to export for this view'); return; }
  var out = [['ID','Date','Customer','Product','Cheese','Order','PO','Result',
              'COA','Revision','Issued','Issued by','Status','Changed after COA']];
  list.forEach(function(a){
    out.push([a.seq||'', String(a.date||'').slice(0,10), a.customer||'', a.product||'', a.cheese||'',
      a.order||'', a.po||'', a.result||'', a.coaNo||'', a.coaRev||'',
      String(a.coaAt||'').slice(0,10), a.coaBy||'',
      {issued:'Certified', ready:'Ready', waiting:'Incomplete'}[coaState(a)],
      coaChangedAfterIssue(a) ? 'Yes' : 'No']);
  });
  downloadCSV('coa-'+localDateStr()+'.csv', out);
}
