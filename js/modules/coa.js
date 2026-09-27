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
  saveDB(db);
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
  var f=document.getElementById('lr-from'), t=document.getElementById('lr-to');
  if(f && !f.value){
    var d=new Date(); d.setDate(d.getDate()-30);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  if(t && !t.value) t.value = localDateStr();
  lrDirty = false; renderLrDirty();
  showDateOrder(document.getElementById('screen-labresults'));
  echoDateRange('lr-date-echo','lr-from','lr-to');
  renderLabResults();
}
function markLrDirty(){
  echoDateRange('lr-date-echo','lr-from','lr-to');
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
    var d=String(a.date||'').slice(0,10);
    if(from && d<from) return false;
    if(to   && d>to)   return false;
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
      ['waiting', n('waiting'), 'waiting for the lab', 'var(--warn)'],
      ['in',      n('in'),      'results in, no verdict', 'var(--dim)'],
      ['done',    n('done'),    'closed', 'var(--pass)'],
      ['all',     all.length,   'records in range', '']
    ].map(function(k){
      return '<button class="kpi'+(lrView===k[0]?' on':'')+'" onclick="setLrView(\''+k[0]+'\')">'+
        '<b>'+k[1]+'</b><span>'+
        (k[3] ? '<i class="dot" style="background:'+k[3]+'"></i>' : '')+k[2]+'</span></button>';
    }).join('');
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
  var f=document.getElementById('coa-from'), t=document.getElementById('coa-to');
  if(f && !f.value){
    var d=new Date(); d.setDate(d.getDate()-30);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  if(t && !t.value) t.value = localDateStr();
  coaPicks = {}; coaDirty = false; renderCoaDirty();
  showDateOrder(document.getElementById('screen-coa'));
  echoDateRange('coa-date-echo','coa-from','coa-to');
  renderCoa();
}
function markCoaDirty(){
  echoDateRange('coa-date-echo','coa-from','coa-to');
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
    var d=String(a.date||'').slice(0,10);
    if(from && d<from) return false;
    if(to   && d>to)   return false;
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
      ['ready',   n('ready'),   'ready to certify', 'var(--warn)'],
      ['waiting', n('waiting'), 'incomplete', 'var(--dim)'],
      ['issued',  n('issued'),  'certified', 'var(--pass)'],
      ['all',     all.length,   'records in range', '']
    ].map(function(k){
      return '<button class="kpi'+(coaView===k[0]?' on':'')+'" onclick="setCoaView(\''+k[0]+'\')">'+
        '<b>'+k[1]+'</b><span>'+
        (k[3] ? '<i class="dot" style="background:'+k[3]+'"></i>' : '')+k[2]+'</span></button>';
    }).join('');
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
           : st==='ready'  ? '<span class="pill warn">Ready</span>'
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
      : '<span class="soft">—</span>')+'</td>'+
  '</tr>';
}

// Qué le falta a un registro para poder certificarse
function coaMissing(a){
  var m = [];
  if(!(a.moisture && a.fat && a.ph)) m.push('analysis');
  if(!(a.result && String(a.result).trim())) m.push('verdict');
  return m.length ? 'Missing '+m.join(' + ') : 'Incomplete';
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
function openCoaDocument(g){
  var ink='#141a17', body='#2f3833', soft='#6b756f', line='#c9cfc9', head='#eceee9';
  var e = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
  var th='style="border:1px solid '+line+';padding:5px 7px;background:'+head+';font-size:8.5px;text-align:left;font-weight:800"';
  var td='style="border:1px solid '+line+';padding:5px 7px;font-size:9.5px"';
  // El valor del laboratorio externo manda; si no hay, el de la casa
  var val = function(a, own, mx){
    var m = a[mx], o = a[own];
    if(m!=null && String(m).trim()!=='') return e(m)+'<sup>M</sup>';
    return (o!=null && String(o).trim()!=='') ? e(o) : '—';
  };
  var rows = g.list.map(function(a){
    return '<tr>'+
      '<td '+td+'>'+e(a.product||'—')+'</td>'+
      '<td '+td+'>'+e(a.cheese||'—')+'</td>'+
      '<td '+td+'>'+e(a.prodDate||'—')+'</td>'+
      '<td '+td+'>'+e(a.order||'—')+'</td>'+
      '<td '+td+'>'+e(a.po||'—')+'</td>'+
      '<td '+td+' align="right">'+val(a,'moisture','mxMoisture')+'</td>'+
      '<td '+td+' align="right">'+val(a,'fat','mxFat')+'</td>'+
      '<td '+td+' align="right">'+val(a,'ph','mxPh')+'</td>'+
      '<td '+td+' align="right">'+(a.coliform?e(a.coliform):'—')+'</td>'+
      '<td '+td+' align="right">'+(a.ecoli?e(a.ecoli):'—')+'</td>'+
      '<td '+td+' align="right">'+val(a,'yeast','mxYeast')+'</td>'+
      '<td '+td+' align="right">'+val(a,'mold','mxMold')+'</td>'+
      '<td '+td+'>'+e(a.result||'—')+'</td>'+
    '</tr>';
  }).join('');

  var doc='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+e(g.no)+'</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+body+';font-size:10px;margin:0;padding:24px 28px}'+
    '@page{size:portrait;margin:0}'+
    '@media print{body{padding:14mm}.savebtn{display:none}}'+
    'h1{font-size:17px;color:'+ink+';margin:0;font-weight:800;letter-spacing:-.02em}'+
    'table{width:100%;border-collapse:collapse}'+
    'sup{font-size:7px;color:'+soft+'}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
    '.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 18px;margin:14px 0 16px}'+
    '.meta div span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:'+soft+';font-weight:700}'+
    '.meta div b{font-size:11px;color:'+ink+'}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
  '<header style="border-bottom:2px solid '+ink+';padding-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px">'+
    '<div><h1>Certificate of Analysis</h1>'+
      '<div style="font-size:10px;color:'+soft+';margin-top:3px">Caputo Foods · Building 1945</div></div>'+
    '<div style="text-align:right;font-size:9px;color:'+soft+';line-height:1.7">'+
      '<div><b style="color:'+ink+';font-size:12px">'+e(g.no)+'</b>'+(g.rev>1?' <span>Revision '+g.rev+'</span>':'')+'</div>'+
      '<div>Issued '+generated+'</div></div>'+
  '</header>'+
  '<div class="meta">'+
    '<div><span>Customer</span><b>'+e(g.customer)+'</b></div>'+
    '<div><span>Products</span><b>'+g.list.length+'</b></div>'+
    '<div><span>Sampled</span><b>'+fmtDate(g.list[0].date)+'</b></div>'+
    '<div><span>Issued by</span><b>'+e(g.list[0].coaBy||(currentUser?currentUser.name:'—'))+'</b></div>'+
  '</div>'+
  '<table><tr>'+
    '<th '+th+'>Product #</th><th '+th+'>Description</th><th '+th+'>Prod. date</th>'+
    '<th '+th+'>Order #</th><th '+th+'>PO #</th>'+
    '<th '+th+' align="right">Moisture</th><th '+th+' align="right">Fat</th><th '+th+' align="right">pH</th>'+
    '<th '+th+' align="right">Coliform</th><th '+th+' align="right">E. coli</th>'+
    '<th '+th+' align="right">Yeast</th><th '+th+' align="right">Mold</th><th '+th+'>Result</th>'+
  '</tr>'+rows+'</table>'+
  '<div style="font-size:8.5px;color:'+soft+';margin-top:8px">'+
    '<sup>M</sup> Result from the external laboratory. Values without the mark were run in house. '+
    'Micro counts in CFU/g.</div>'+
  '<div style="border-top:1px solid '+line+';margin-top:26px;padding-top:10px;display:flex;gap:40px;font-size:9px;color:'+soft+'">'+
    '<div style="flex:1">Quality Assurance: ____________________________</div>'+
    '<div style="flex:1">Date: ______________</div>'+
  '</div>'+
  '</body></html>';

  var blob=new Blob([doc],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); },4000);
}

// ============================================================
// CHANGES — el rastro, sobre todo de lo que se tocó tras certificar
// ============================================================
var chView = 'after';   // after | all
function setChView(v){ chView = v; renderCoaChanges(); }

var chDirty = false;
function markChDirty(){
  echoDateRange('ch-date-echo','ch-from','ch-to');
  if(chDirty) return;
  chDirty = true; renderChDirty();
}
function renderChDirty(){
  var el = document.getElementById('ch-dirty');
  if(el) el.style.display = chDirty ? 'block' : 'none';
  var b = document.getElementById('ch-go');
  if(b) b.classList.toggle('pending', chDirty);
}
function applyChFilters(){
  chDirty = false; renderChDirty();
  var f = document.getElementById('ch-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderCoaChanges); return; }
  renderCoaChanges();
}

function initCoaChanges(){
  var f=document.getElementById('ch-from'), t=document.getElementById('ch-to');
  if(f && !f.value){
    var d=new Date(); d.setDate(d.getDate()-30);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  if(t && !t.value) t.value = localDateStr();
  chDirty = false; renderChDirty();
  showDateOrder(document.getElementById('screen-coachanges'));
  echoDateRange('ch-date-echo','ch-from','ch-to');
  renderCoaChanges();
}

function changeRows(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var from=g('ch-from'), to=g('ch-to'), q=(g('ch-search')||'').trim().toLowerCase();
  var out = [];
  (typeof getAnalyses==='function' ? getAnalyses() : []).forEach(function(a){
    (a.changes||[]).forEach(function(c){
      var d = String(c.at||'').slice(0,10);
      if(from && d<from) return;
      if(to   && d>to)   return;
      if(chView==='after' && !c.afterCoa) return;
      if(q){
        var hay=(String(a.product||'')+' '+String(a.customer||'')+' '+String(a.coaNo||'')+' '+
                 String(c.field||'')+' '+String(c.by||'')+' #'+String(a.seq||'')).toLowerCase();
        if(hay.indexOf(q)<0) return;
      }
      out.push({rec:a, ch:c});
    });
  });
  return out.sort(function(x,y){ return String(y.ch.at||'').localeCompare(String(x.ch.at||'')); });
}

var CH_LABELS = {
  moisture:'Moisture', fat:'Fat', ph:'pH', yeast:'Yeast', mold:'Mold',
  mxMoisture:'Matrix moisture', mxFat:'Matrix fat', mxPh:'Matrix pH',
  mxYeast:'Matrix yeast', mxMold:'Matrix mold',
  coliform:'Coliform', ecoli:'E. coli', result:'Result', resultBy:'Result by',
  testedBy:'Tested by', ymBy:'Read by', COA:'Certificate'
};

function renderCoaChanges(){
  var host = document.getElementById('ch-sheet');
  if(!host) return;
  var list = changeRows();

  var kp = document.getElementById('ch-kpis');
  if(kp){
    var afterAll = 0, total = 0;
    (typeof getAnalyses==='function' ? getAnalyses() : []).forEach(function(a){
      (a.changes||[]).forEach(function(c){ total++; if(c.afterCoa) afterAll++; });
    });
    kp.innerHTML =
      '<button class="kpi'+(chView==='after'?' on':'')+'" onclick="setChView(\'after\')">'+
        '<b>'+afterAll+'</b><span><i class="dot" style="background:var(--fail)"></i>'+
        'changed after the COA</span></button>'+
      '<button class="kpi'+(chView==='all'?' on':'')+'" onclick="setChView(\'all\')">'+
        '<b>'+total+'</b><span>all changes</span></button>'+
      '<div class="kpi"><b>'+list.length+'</b><span>in this view</span></div>';
  }

  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (chView==='after'
        ? 'Nothing was changed after a certificate was issued in this range. That is the good case.'
        : 'No changes recorded in this range.')+'</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>When</th><th>Who</th><th>ID</th><th>Customer</th>'+
      '<th>Product</th><th class="wide">Cheese</th><th>Field</th><th>From</th><th>To</th>'+
      '<th>COA</th><th>After COA</th>'+
    '</tr></thead><tbody>'+
    list.slice(0,400).map(function(x,i){
      var a=x.rec, c=x.ch;
      var v=function(s){ return (s==null||s==='') ? '—' : esc(s); };
      return '<tr>'+
        '<td class="rn">'+(i+1)+'</td>'+
        '<td class="soft">'+esc(fmtDate(c.at))+' '+esc(String(c.at||'').slice(11,16))+'</td>'+
        '<td>'+v(c.by)+'</td>'+
        '<td class="code">#'+v(a.seq)+'</td>'+
        '<td class="soft">'+v(a.customer)+'</td>'+
        '<td class="code">'+v(a.product)+'</td>'+
        '<td class="wide">'+v(a.cheese)+'</td>'+
        '<td>'+esc(CH_LABELS[c.field] || c.field)+'</td>'+
        '<td class="soft">'+v(c.from)+'</td>'+
        '<td><b>'+v(c.to)+'</b></td>'+
        '<td class="code soft">'+v(a.coaNo)+'</td>'+
        '<td>'+(c.afterCoa ? '<span class="pill bad">Yes</span>' : '<span class="pill">No</span>')+'</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
}

function exportChangesCSV(){
  var list = changeRows();
  if(!list.length){ toast('Nothing to export for these filters'); return; }
  var out = [['When','Who','ID','Customer','Product','Cheese','Field','From','To','COA','After COA']];
  list.forEach(function(x){
    var a=x.rec, c=x.ch;
    out.push([String(c.at||'').replace('T',' ').slice(0,16), c.by||'', a.seq||'', a.customer||'',
      a.product||'', a.cheese||'', CH_LABELS[c.field]||c.field||'', c.from||'', c.to||'',
      a.coaNo||'', c.afterCoa?'Yes':'No']);
  });
  downloadCSV('coa-changes-'+localDateStr()+'.csv', out);
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
