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
    '<td><button class="sheet-btn" onclick="saveLrRow('+a.id+',this)">Save</button></td>'+
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

// Un registro se puede certificar cuando tiene las tres medidas y un dictamen
function coaReady(a){
  return (typeof analysisComplete==='function' ? analysisComplete(a) : true) &&
         !!(a.result && String(a.result).trim());
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
    if(!inScope(a.date, from, to, coaReady(a) && !a.coaNo)) return false;
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
  var pill = st==='issued' ? '<span class="pill ok">Certified</span>'
           : st==='ready'  ? '<span class="pill warn">Pending</span>'
           : '<span class="pill bad">Pending · '+(coaMissing(a))+'</span>';
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
      : '<span class="soft">—</span>')+'</td>'+
  '</tr>';
}

// Qué le falta a un registro para poder certificarse
function coaMissing(a){
  var m = [];
  if(!(a.moisture && a.fat && a.ph)) m.push('analysis');
  if(!(a.result && String(a.result).trim())) m.push('verdict');
  return m.length ? 'missing '+m.join(' + ') : 'incomplete';
}
// ¿Se tocó algo después de emitir el certificado?
function coaChangedAfterIssue(a){
  return (a.changes||[]).some(function(c){ return c.afterCoa; });
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
    openCoaDocument(g);
  });
  coaPicks = {};
  renderCoa();
  toast(issued.length===1 ? issued[0].no+' issued' : issued.length+' certificates issued');
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

function coaCustomerOf(a){
  if(typeof customerById === 'function' && a.customerId){
    var c = customerById(a.customerId);
    if(c) return c;
  }
  var lista = (typeof getCustomers === 'function') ? getCustomers() : [];
  return lista.filter(function(c){ return c.company === a.customer; })[0] || {};
}

// dd/mm/aaaa del pais, como en la forma
function coaFecha(iso){
  var d = new Date(String(iso||'').slice(0,10)+'T12:00:00');
  return isNaN(d) ? (iso||'') : (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
}

function openCoaDocument(g){
  var ink='#141a17', soft='#6b756f', line='#b9c0b9';
  var e = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
  var dash = '\u2014';
  // El valor del laboratorio externo manda; si no hay, el de la casa
  var val = function(a, own, mx){
    var m = a[mx], o = a[own];
    if(m!=null && String(m).trim()!=='') return e(m);
    return (o!=null && String(o).trim()!=='') ? e(o) : 'Pending';
  };

  var hojas = g.list.map(function(a, i){
    var c = coaCustomerOf(a);
    var t = c.targets || {};
    var prod = (typeof findProduct === 'function') ? findProduct(a.product) : null;
    var pack = c.packaging || (prod ? (prod.pkgLabel || prod.size || '') : '');

    var ficha = function(rot, v){
      return '<tr><th>'+rot+'</th><td>'+(v ? e(v) : '')+'</td></tr>';
    };
    var izq = ficha('Customer ID:', c.customerId || a.customerId)+
              ficha('Customer Part #:', a.product)+
              ficha('Customer Code:', c.code)+
              ficha('Customer Phone:', c.phone)+
              ficha('Customer Fax:', c.fax)+
              ficha('Customer Contact:', c.contact)+
              ficha('Customer Email:', c.email);
    var der = ficha('Customer PO:', a.po)+
              ficha('Caputo Order #:', a.order)+
              ficha('Product Lot #:', (typeof analysisLot === 'function' ? analysisLot(a) : a.lot))+
              ficha('Date of Manufacture:', coaFecha(a.prodDate || a.date))+
              ficha('Product Packaging:', pack);

    var fila = function(nombre, metodo, valor, unidad, objetivo){
      return '<tr><td class="n">'+nombre+'</td><td class="m">'+metodo+'</td>'+
        '<td class="r">'+valor+'</td><td class="u">'+(unidad||'')+'</td>'+
        '<td class="t">'+(objetivo ? e(objetivo) : '')+'</td>'+
        '<td class="u">'+(objetivo && unidad ? unidad : '')+'</td></tr>';
    };

    return '<section class="coa"'+(i ? ' style="page-break-before:always"' : '')+'>'+
      '<h1>Certificate of Analysis</h1>'+
      '<table class="ficha">'+
        '<tr><th>Product Description:</th><td colspan="3">'+e(a.cheese || c.productName || dash)+'</td></tr>'+
        '<tr><th>Customer Name:</th><td colspan="3">'+e(a.customer || c.company || dash)+'</td></tr>'+
      '</table>'+
      '<div class="dos">'+
        '<table class="ficha">'+izq+'</table>'+
        '<table class="ficha">'+der+'</table>'+
      '</div>'+
      '<div class="titulo">Analytical Results</div>'+
      '<table class="res">'+
        '<tr class="cab"><th>Physical</th><th>Method</th><th colspan="2">Results</th>'+
          '<th colspan="2">Target</th></tr>'+
        fila('Moisture', COA_METODO.moisture, val(a,'moisture','mxMoisture'), '%', t.moisture)+
        fila('Fat (dry basis)', COA_METODO.fat, val(a,'fat','mxFat'), '%', t.fat)+
        fila('pH', COA_METODO.ph, val(a,'ph','mxPh'), '', t.ph)+
        '<tr class="cab"><th>Microbiological</th><th>Method</th><th colspan="2">Results</th>'+
          '<th colspan="2">Target</th></tr>'+
        fila('Yeast', COA_METODO.yeast, val(a,'yeast','mxYeast'), 'CFU/g', t.yeast)+
        fila('Mold', COA_METODO.mold, val(a,'mold','mxMold'), 'CFU/g', t.mold)+
      '</table>'+
      '<div class="firma">COA Accuracy, CCP Documentation, Weight &amp; Lot Coding '+
        'Documentation verified by: ______________________________</div>'+
      '<div class="pie">'+e(g.no)+(g.rev>1 ? ' R'+g.rev : '')+
        ' \u00b7 Caputo Foods \u00b7 Building 1945</div>'+
    '</section>';
  }).join('');

  var doc='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+e(g.no)+'</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:Calibri,Segoe UI,Arial,sans-serif;color:'+ink+';font-size:11px;margin:0;padding:22px 26px}'+
    '@page{size:portrait;margin:14mm}'+
    '@media print{body{padding:0}.savebtn{display:none}}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;'+
      'border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
    '.coa{max-width:760px;margin:0 auto}'+
    'h1{font-size:19px;font-weight:700;text-align:center;margin:0 0 16px}'+
    'table{border-collapse:collapse;width:100%}'+
    '.ficha th{text-align:left;font-weight:700;white-space:nowrap;padding:2px 10px 2px 0;'+
      'font-size:11px;vertical-align:top;width:1%}'+
    '.ficha td{padding:2px 0;font-size:11px}'+
    '.dos{display:flex;gap:26px;margin-top:2px}'+
    '.dos > table{width:50%}'+
    '.titulo{font-weight:700;font-size:12px;margin:18px 0 6px;border-bottom:1px solid '+line+';'+
      'padding-bottom:3px}'+
    '.res td,.res th{border:1px solid '+line+';padding:4px 7px;font-size:11px}'+
    '.res .cab th{font-weight:700;text-align:left;background:#f1f3f0}'+
    '.res .n{width:26%}.res .m{width:26%}.res .r{width:14%;text-align:right}'+
    '.res .u{width:8%;color:'+soft+'}.res .t{width:14%;text-align:right}'+
    '.firma{margin-top:34px;font-size:10.5px}'+
    '.pie{margin-top:8px;font-size:9px;color:'+soft+'}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
  hojas+
  '</body></html>';

  var blob=new Blob([doc],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); },4000);
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
