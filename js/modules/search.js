// ===== SEARCH =====
// Búsqueda por LOT, número de producto, código de barras o descripción, con
// filtros de fecha, línea, turno y tipo de registro. Devuelve la ficha del
// producto y su historial completo: pesos, bag seal y holds.
var searchQuery = '', searchDone = false;
var sf = {field:'all', from:'', to:'', line:'all', shift:'all', type:'all'};

function readFilters(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value : ''; };
  searchQuery = (g('search-input')||'').trim();
  sf.field = g('sf-field')||'all';
  sf.from  = g('sf-from');
  sf.to    = g('sf-to');
  sf.line  = g('sf-line')||'all';
  sf.shift = g('sf-shift')||'all';
  sf.type  = g('sf-type')||'all';
}

function anyFilter(){
  return !!(searchQuery || sf.from || sf.to || sf.line!=='all' || sf.shift!=='all');
}

function initSearch(){
  var i = document.getElementById('search-input');
  if(i) i.value = searchQuery;
  ['sf-field','sf-from','sf-to','sf-line','sf-shift','sf-type'].forEach(function(id){
    var e = document.getElementById(id);
    if(e && !e.onchange) e.onchange = runSearch;
  });
  renderSearch();
}

function runSearch(){
  readFilters();
  if(!anyFilter()){
    searchDone = false;
    toast('Enter a LOT or product, or pick a date, line or shift');
  } else {
    searchDone = true;
  }
  renderSearch();
}

function clearSearch(){
  searchQuery = ''; searchDone = false;
  sf = {field:'all', from:'', to:'', line:'all', shift:'all', type:'all'};
  var i = document.getElementById('search-input');
  if(i){ i.value=''; i.focus(); }
  ['sf-from','sf-to'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
  ['sf-field','sf-line','sf-shift','sf-type'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value='all'; });
  renderSearch();
}

function searchOnKey(e){ if(e.key==='Enter') runSearch(); }

// ¿La fecha del registro cae dentro del rango elegido?
function inDateRange(iso){
  var d = String(iso||'').slice(0,10);
  if(!d) return !sf.from && !sf.to;
  if(sf.from && d < sf.from) return false;
  if(sf.to   && d > sf.to)   return false;
  return true;
}

function matchLineShift(r){
  if(sf.line!=='all'  && String(r.line||'')  !== sf.line)  return false;
  if(sf.shift!=='all' && String(r.shift||'') !== sf.shift) return false;
  return true;
}

function searchProduct(q){
  var direct = findProduct(q);
  if(direct) return direct;
  var l = q.toLowerCase();
  return getProducts().filter(function(p){
    return String(p.name||'').toLowerCase().indexOf(l)>-1;
  })[0] || null;
}

function searchResults(){
  var q = searchQuery.trim();
  var l = q.toLowerCase();
  var prod = q ? searchProduct(q) : null;
  var pnum = prod ? String(prod.number).toLowerCase() : '';

  // El texto se busca en el campo elegido (o en todos)
  var textHit = function(r){
    if(!l) return true;
    var lot  = String(r.lot||'').toLowerCase();
    var num  = String(r.product||'').toLowerCase();
    var name = String(r.productName||'').toLowerCase();
    if(sf.field==='lot')     return lot.indexOf(l)>-1;
    if(sf.field==='product') return num.indexOf(l)>-1 || (pnum && num===pnum);
    if(sf.field==='name')    return name.indexOf(l)>-1 || (pnum && num===pnum);
    return lot.indexOf(l)>-1 || num.indexOf(l)>-1 || name.indexOf(l)>-1 || (pnum && num===pnum);
  };
  var keep = function(r){ return textHit(r) && inDateRange(r.date) && matchLineShift(r); };
  var byDate = function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); };

  var db = getDB();
  var wantW = sf.type==='all' || sf.type==='weight';
  var wantS = sf.type==='all' || sf.type==='seal';
  var wantH = sf.type==='all' || sf.type==='hold';
  var wantC = sf.type==='all' || sf.type==='capa';

  return {
    product: prod,
    weights: wantW ? (db.weights||[]).filter(keep).sort(byDate) : [],
    seals:   wantS ? (db.seals||[]).filter(keep).sort(byDate)   : [],
    holds:   wantH ? (db.holds||[]).filter(function(h){
               var hitTxt = !l || String(h.lot||'').toLowerCase().indexOf(l)>-1 ||
                            String(h.product||'').toLowerCase().indexOf(l)>-1;
               var hitLine = sf.line==='all' || String(h.line||'')===sf.line;
               return hitTxt && hitLine && inDateRange(h.createdAt);
             }).sort(function(a,b){ return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); }) : [],
    capa:    wantC ? (db.capa||[]).filter(function(c){
               var hitTxt = !l ||
                 String(c.reportNumber||'').toLowerCase().indexOf(l)>-1 ||
                 String(c.lot||'').toLowerCase().indexOf(l)>-1 ||
                 String(c.product||'').toLowerCase().indexOf(l)>-1 ||
                 String(c.productName||'').toLowerCase().indexOf(l)>-1 ||
                 String(c.problem||'').toLowerCase().indexOf(l)>-1 ||
                 (pnum && String(c.product||'').toLowerCase()===pnum);
               return hitTxt && inDateRange(c.capaDate);
             }).sort(function(a,b){ return String(b.capaDate||'').localeCompare(String(a.capaDate||'')); }) : [],
    shifts:  (sf.type==='all'||sf.type==='shift') ? (db.shifts||[]).filter(function(s){
               var hitTxt = !l ||
                 String(s.reportNumber||'').toLowerCase().indexOf(l)>-1 ||
                 String(s.lot||'').toLowerCase().indexOf(l)>-1 ||
                 String(s.product||'').toLowerCase().indexOf(l)>-1 ||
                 String(s.area||'').toLowerCase().indexOf(l)>-1 ||
                 String(s.notes||'').toLowerCase().indexOf(l)>-1 ||
                 (pnum && String(s.product||'').toLowerCase()===pnum);
               var hitLine = sf.line==='all' || String(s.line||'')===sf.line;
               var hitShift = sf.shift==='all' || String(s.shift||'')===sf.shift;
               return hitTxt && hitLine && hitShift && inDateRange(s.date);
             }).sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); }) : []
  };
}

// Resumen de lo que se está filtrando
function activeFilterChips(){
  var chips = [];
  if(searchQuery){
    var where = {lot:'LOT', product:'Product', name:'Description'}[sf.field] || 'Any field';
    chips.push(where+': '+esc(searchQuery));
  }
  if(sf.from && sf.to)      chips.push(fmtDate(sf.from)+' — '+fmtDate(sf.to));
  else if(sf.from)          chips.push('From '+fmtDate(sf.from));
  else if(sf.to)            chips.push('Up to '+fmtDate(sf.to));
  if(sf.line!=='all')       chips.push('Line '+sf.line);
  if(sf.shift!=='all')      chips.push((sf.shift==='1'?'1st':'2nd')+' shift');
  if(sf.type!=='all')       chips.push({weight:'Weight only',seal:'Bag seal only',hold:'Holds only',capa:'CAPA only',shift:'Shift reports only'}[sf.type]);
  if(!chips.length) return '';
  return '<div class="filter-chips">'+chips.map(function(c){
    return '<span class="fchip">'+esc(c)+'</span>';
  }).join('')+'<button class="fchip-clear" onclick="clearSearch()">Clear all</button></div>';
}

function fmtDate(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function renderSearch(){
  var el = document.getElementById('search-results');
  if(!el) return;

  if(!searchDone){
    el.innerHTML = '<div class="panel"><div class="cd-empty">'+
      'Search by LOT, product number, barcode or description — or filter by date, line, shift or record type — to pull up the product and its full history.'+
      '</div></div>';
    return;
  }

  var r = searchResults();
  var total = r.weights.length + r.seals.length + r.holds.length + (r.capa?r.capa.length:0) + (r.shifts?r.shifts.length:0);
  if(!total && !r.product){
    el.innerHTML = activeFilterChips()+'<div class="panel"><div class="cd-empty">No records match these filters.</div></div>';
    return;
  }

  var scored = r.weights.filter(function(w){ return w.compliance!=null; });
  var avg = scored.length
    ? Math.round(scored.reduce(function(a,w){ return a+w.compliance; },0)/scored.length)
    : null;
  var dates = r.weights.concat(r.seals).map(function(x){ return String(x.date||'').slice(0,10); })
              .filter(Boolean).sort();
  var openHolds = r.holds.filter(function(h){ return h.status!=='released' && h.status!=='destroyed'; }).length;

  // Con un filtro de tipo activo sólo se muestra ese historial
  el.innerHTML =
    activeFilterChips() +
    (searchQuery ? productPanel(r.product, searchQuery) : '') +
    summaryStrip(r, avg, dates, openHolds) +
    ((sf.type==='all'||sf.type==='weight') ? weightPanel(r.weights) : '') +
    ((sf.type==='all'||sf.type==='seal')   ? sealPanel(r.seals)     : '') +
    holdPanel(r.holds) +
    capaPanel(r.capa) +
    shiftPanel(r.shifts);
  renderIcons(el);
}

function shiftPanel(list){
  if(!list || !list.length) return '';
  var stt = {open:'bad', monitoring:'warn', followup:'warn', resolved:'ok', na:''};
  var rows = list.map(function(s){
    return '<tr class="view-row" onclick="viewShiftReport('+s.id+')">'+
      '<td class="mono code">'+esc(s.reportNumber||'—')+'</td>'+
      '<td>'+fmtDate(s.date)+'</td>'+
      '<td>'+(s.shift?(s.shift===1?'1st':'2nd'):'—')+'</td>'+
      '<td>'+esc(s.area||'—')+'</td>'+
      '<td>'+(s.category?'<span class="pill">'+esc(s.category)+'</span>':'—')+'</td>'+
      '<td>'+(s.status?'<span class="pill '+(stt[s.status]||'')+'">'+(window.shiftStatusLabel?shiftStatusLabel(s.status):cap1(s.status))+'</span>':'—')+'</td>'+
      '<td class="soft">'+esc(s.reportedBy||'—')+'</td>'+
      '<td class="view-cell"><span class="view-btn" title="View report" data-icon="search"></span></td>'+
    '</tr>';
  }).join('');
  return tablePanel('Shift reports', list.length, [
    {t:'Report #'},{t:'Date'},{t:'Shift'},{t:'Area'},{t:'Category'},{t:'Status'},{t:'By'},{t:''}
  ], rows);
}

function viewShiftReport(id){
  var s = (getDB().shifts||[]).filter(function(x){ return x.id===id; })[0];
  if(!s){ toast('Report not found'); return; }
  var stt = {open:'bad', monitoring:'warn', followup:'warn', resolved:'ok', na:''};
  var body =
    '<div class="rec-grid">'+
      recRow('Report number', '<span class="mono">'+esc(s.reportNumber||'—')+'</span>')+
      recRow('Date', fmtDate(s.date))+
      recRow('Shift', s.shift?(s.shift===1?'1st':'2nd')+' shift':'—')+
      recRow('Area', esc(s.area||'—'))+
      recRow('Category', s.category?'<span class="pill">'+esc(s.category)+'</span>':'—')+
      recRow('Status', s.status?'<span class="pill '+(stt[s.status]||'')+'">'+(window.shiftStatusLabel?shiftStatusLabel(s.status):cap1(s.status))+'</span>':'—')+
      recRow('Line', s.line?('Line '+esc(s.line)):'—')+
      recRow('Product', esc(s.product||'—')+(s.productName?' · '+esc(s.productName):''))+
      recRow('Lot', '<span class="mono">'+esc(s.lot||'—')+'</span>')+
      recRow('Follow-up', s.followUp?'<span class="pill warn">Required</span>':'No')+
    '</div>'+
    recBlock('What happened', s.notes)+
    recBlock('Action taken', s.action)+
    '<div class="rec-grid">'+
      recRow('Reported by', esc(s.reportedBy||'—'))+
      recRow('Shift supervisor', esc(s.supervisor||'—'))+
    '</div>';
  var canEdit = currentUser;
  var actions =
    '<button class="btn-solid" onclick="exportShiftPDF('+s.id+')"><span data-icon="doc"></span>Export PDF</button>'+
    (canEdit?'<button class="btn-ghost" onclick="closeRecordModal();goTo(\'screen-shift\');editShift('+s.id+')">Open to edit</button>':'')+
    '<button class="btn-ghost" onclick="closeRecordModal()">Close</button>';
  openRecordModal('Shift report · <span class="mono">'+esc(s.reportNumber||'')+'</span>', body, actions);
}

var SEV_CLS = {major:'bad', moderate:'warn', minimal:''};
var STT_CLS = {open:'bad', progress:'warn', closed:'ok'};
function cap1(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : '—'; }

function capaPanel(list){
  if(!list || !list.length) return '';
  var rows = list.map(function(c){
    return '<tr class="view-row" onclick="viewCapaReport('+c.id+')">'+
      '<td class="mono code">'+esc(c.reportNumber||'—')+'</td>'+
      '<td>'+(c.severity?'<span class="pill '+(SEV_CLS[c.severity]||'')+'">'+cap1(c.severity)+'</span>':'—')+'</td>'+
      '<td>'+(c.status?'<span class="pill '+(STT_CLS[c.status]||'')+'">'+cap1(c.status)+'</span>':'—')+'</td>'+
      '<td class="mono">'+esc(c.product||'—')+'</td>'+
      '<td class="mono code">'+esc(c.lot||'—')+'</td>'+
      '<td>'+fmtDate(c.capaDate)+'</td>'+
      '<td class="soft">'+esc(c.completedBy||'—')+'</td>'+
      '<td class="view-cell"><span class="view-btn" title="View report" data-icon="search"></span></td>'+
    '</tr>';
  }).join('');
  return tablePanel('Incident & CAPA reports', list.length, [
    {t:'Report #'},{t:'Severity'},{t:'Status'},{t:'Product'},{t:'LOT'},{t:'Date'},{t:'By'},{t:''}
  ], rows);
}

// ===== VISOR DE REGISTROS (modal de sólo lectura) =====
function closeRecordModal(){
  var m = document.getElementById('record-modal');
  if(m) m.style.display = 'none';
  document.body.style.overflow = '';
}

function openRecordModal(title, body, actions){
  var m = document.getElementById('record-modal');
  if(!m) return;
  document.getElementById('rec-modal-title').innerHTML = title;
  document.getElementById('rec-modal-body').innerHTML = body;
  document.getElementById('rec-modal-actions').innerHTML = actions || '';
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderIcons(m);
}

function recRow(label, value){
  return '<div class="rec-field"><div class="rec-lbl">'+label+'</div>'+
         '<div class="rec-val">'+(value===''||value==null ? '—' : value)+'</div></div>';
}
function recBlock(label, value){
  return '<div class="rec-block"><div class="rec-lbl">'+label+'</div>'+
         '<div class="rec-text">'+(value ? esc(value).replace(/\n/g,'<br>') : '—')+'</div></div>';
}

function viewCapaReport(id){
  var c = (getDB().capa||[]).filter(function(x){ return x.id===id; })[0];
  if(!c){ toast('Report not found'); return; }
  var sevInfo = (typeof CAPA_SEVERITY!=='undefined') ? CAPA_SEVERITY.filter(function(s){return s.key===c.severity;})[0] : null;
  var sevTag  = c.severity ? '<span class="pill '+(SEV_CLS[c.severity]||'')+'">'+cap1(c.severity)+'</span>' : '—';
  var sttTag  = c.status   ? '<span class="pill '+(STT_CLS[c.status]||'')+'">'+cap1(c.status)+'</span>'   : '—';

  var body =
    '<div class="rec-grid">'+
      recRow('Report number', '<span class="mono">'+esc(c.reportNumber||'—')+'</span>')+
      recRow('Date of CAPA', fmtDate(c.capaDate))+
      recRow('Severity', sevTag + (sevInfo?' <span class="rec-hint">investigate '+sevInfo.deadline+'</span>':''))+
      recRow('Status', sttTag)+
      recRow('Product', esc(c.product||'—')+(c.productName?' · '+esc(c.productName):''))+
      recRow('Lot number', '<span class="mono">'+esc(c.lot||'—')+'</span>')+
      recRow('Customer complaint #', esc(c.complaint||'—'))+
      recRow('Created by', esc(c.createdBy||'—')+' · '+fmtDate(c.createdAt))+
    '</div>'+
    recBlock('Problem / Deviation', c.problem)+
    recBlock('Investigation, affected product/area and outcome(s)', c.description)+
    recBlock('Short-term corrective action' + (c.shortDate?' — '+fmtDate(c.shortDate):''), c.shortTerm)+
    recBlock('Long-term corrective / preventative action' + (c.longDate?' — '+fmtDate(c.longDate):''), c.longTerm)+
    '<div class="rec-grid">'+
      recRow('Completed by', esc(c.completedBy||'—'))+
      recRow('Verified by', esc(c.verifiedBy||'—'))+
    '</div>';

  var canEdit = currentUser;
  var actions =
    '<button class="btn-solid" onclick="exportCapaPDF('+c.id+')"><span data-icon="doc"></span>Export PDF</button>'+
    (canEdit?'<button class="btn-ghost" onclick="closeRecordModal();goTo(\'screen-capa\');editCapa('+c.id+')">Open to edit</button>':'')+
    '<button class="btn-ghost" onclick="closeRecordModal()">Close</button>';

  openRecordModal('Incident &amp; CAPA · <span class="mono">'+esc(c.reportNumber||'')+'</span>', body, actions);
}

function productPanel(p, q){
  if(!p){
    return '<div class="panel res-panel"><div class="res-head"><span class="res-title">No catalog product matches “'+esc(q)+'”</span></div>'+
      '<div class="cd-empty" style="padding:18px">The records below matched the LOT or the product number written on them.</div></div>';
  }
  var target = (p.target && p.target.min!=null) ? p.target.min.toFixed(2)+' – '+p.target.max.toFixed(2)+' lbs' : 'not set';
  var f = function(label, value, strong){
    return '<div class="res-field"><div class="res-lbl">'+label+'</div>'+
           '<div class="res-val'+(strong?' strong':'')+'">'+value+'</div></div>';
  };
  return '<div class="panel res-panel">'+
    '<div class="res-head">'+
      '<span class="res-ico" data-icon="box"></span>'+
      '<span class="res-title">'+esc((p.name || 'Product '+p.number))+'</span>'+
      '<span class="res-sub">Product '+esc(p.number)+'</span>'+
    '</div>'+
    '<div class="res-grid">'+
      f('Product number', esc(p.number), true)+
      f('Description', esc(p.name||'—'))+
      f('Package size', esc(p.pkgLabel||'—'), true)+
      f('Target range', target)+
      f('Bags per case', esc(p.bagsPerCase||'—'))+
      f('Barcode', (p.barcodes||[]).length ? '<span class="tag ok">Linked</span>' : '<span class="tag">Not linked</span>')+
      f('Created by', p.createdBy||'—')+
      f('Added', fmtDate(p.createdAt))+
    '</div>'+
  '</div>';
}

function summaryStrip(r, avg, dates, openHolds){
  var s = function(value, label, cls){
    return '<div class="res-stat"><div class="rs-val'+(cls?' '+cls:'')+'">'+value+'</div><div class="rs-lbl">'+label+'</div></div>';
  };
  return '<div class="res-stats">'+
    s(r.weights.length, 'Weight checks')+
    s(avg==null ? '—' : avg+'<small>%</small>', 'Avg compliance', avg==null?'':avg>=80?'ok':'bad')+
    s(r.seals.length, 'Bag seal checks')+
    s(openHolds, 'Open holds', openHolds?'bad':'')+
    s(dates.length ? fmtDate(dates[0])+' — '+fmtDate(dates[dates.length-1]) : '—', 'Date range', 'sm')+
  '</div>';
}

// Tope de filas por tabla: con filtros amplios hay cientos de registros y
// pintarlos todos deja la pantalla lenta.
var SEARCH_LIMIT = 100;

function tablePanel(title, count, headers, rows, shown){
  var extra = (shown!=null && count>shown)
    ? '<div class="table-note">Showing the '+shown+' most recent of <b>'+count+'</b>. Narrow the dates or the line to see the rest.</div>'
    : '';
  return '<div class="panel res-panel">'+
    '<div class="res-head"><span class="res-title">'+title+'</span>'+
      '<span class="res-count">'+count+' record'+(count===1?'':'s')+'</span></div>'+
    (count
      ? '<div class="table-scroll"><table class="cat-table"><thead><tr>'+
          headers.map(function(h){ return '<th'+(h.num?' class="num"':'')+'>'+h.t+'</th>'; }).join('')+
        '</tr></thead><tbody>'+rows+'</tbody></table></div>'+extra
      : '<div class="cd-empty" style="padding:18px">No records</div>')+
  '</div>';
}

function weightPanel(list){
  var page = list.slice(0, SEARCH_LIMIT);
  var rows = page.map(function(w){
    var t = recTarget(w);
    var samples = (w.vals||[]).map(function(v){
      var n = parseFloat(v);
      if(isNaN(n)) return '';
      var cls = !t ? '' : (n>=t.min && n<=t.max) ? 'in' : 'out';
      return '<span class="samp '+cls+'">'+n.toFixed(3)+'</span>';
    }).join('');
    var cls = w.compliance==null ? '' : w.compliance>=80 ? 'ok' : 'bad';
    return '<tr>'+
      '<td class="mono">'+fmtDate(w.date)+'</td>'+
      '<td class="mono">'+(w.time||'—')+'</td>'+
      '<td>Line '+w.line+'</td>'+
      '<td>'+(w.shift===1?'1st':'2nd')+'</td>'+
      '<td class="mono code">'+esc((w.lot||'—'))+'</td>'+
      '<td class="mono">'+esc((w.product||'—'))+'</td>'+
      '<td class="mono">'+esc((w.pkgLabel||'—'))+'</td>'+
      '<td class="samples">'+(samples||'—')+'</td>'+
      '<td class="mono num">'+(w.avg!=null?parseFloat(w.avg).toFixed(3):'—')+'</td>'+
      '<td class="num"><span class="pill '+cls+'">'+compLabel(w.compliance)+'</span></td>'+
      '<td class="soft">'+esc((w.initials||'—'))+'</td>'+
    '</tr>';
  }).join('');
  return tablePanel('Weight history', list.length, [
    {t:'Date'},{t:'Time'},{t:'Line'},{t:'Shift'},{t:'LOT'},{t:'Product'},{t:'Size'},
    {t:'Samples (lbs)'},{t:'Avg',num:true},{t:'Compliance',num:true},{t:'By'}
  ], rows, page.length);
}

function sealPanel(list){
  var page = list.slice(0, SEARCH_LIMIT);
  var mark = function(v){
    if(v==='pass') return '<span class="pill ok">PASS</span>';
    if(v==='fail') return '<span class="pill bad">FAIL</span>';
    return '<span class="pill">—</span>';
  };
  var rows = page.map(function(s){
    var c = s.checks||{};
    return '<tr>'+
      '<td class="mono">'+fmtDate(s.date)+'</td>'+
      '<td class="mono">'+(s.time||'—')+'</td>'+
      '<td>Line '+s.line+'</td>'+
      '<td>'+(s.shift===1?'1st':'2nd')+'</td>'+
      '<td class="mono code">'+esc((s.lot||'—'))+'</td>'+
      '<td class="mono">'+esc((s.product||'—'))+'</td>'+
      '<td>'+mark(c['Visual'])+'</td>'+
      '<td>'+mark(c['Dunk Tank'])+'</td>'+
      '<td>'+mark(c['Printing'])+'</td>'+
      '<td class="soft">'+esc((s.initials||'—'))+'</td>'+
    '</tr>';
  }).join('');
  return tablePanel('Bag seal history', list.length, [
    {t:'Date'},{t:'Time'},{t:'Line'},{t:'Shift'},{t:'LOT'},{t:'Product'},
    {t:'Visual'},{t:'Dunk Tank'},{t:'Printing'},{t:'By'}
  ], rows, page.length);
}

function holdPanel(list){
  if(!list.length) return '';
  var rows = list.map(function(h){
    var open = h.status!=='released' && h.status!=='destroyed';
    return '<tr class="view-row" onclick="viewHoldCase(\''+String(h.id)+'\')">'+
      '<td class="mono code">'+esc(h.caseNumber)+'</td>'+
      '<td><span class="pill '+(open?'bad':'ok')+'">'+String(h.status||'').toUpperCase()+'</span></td>'+
      '<td class="desc">'+esc((h.product||'—'))+'</td>'+
      '<td class="mono">'+esc((h.lot||'—'))+'</td>'+
      '<td class="mono num">'+esc(h.quantity||'—')+'</td>'+
      '<td class="mono">'+fmtDate(h.createdAt)+'</td>'+
      '<td class="soft">'+esc((h.initiatedBy||'—'))+'</td>'+
      '<td class="view-cell"><span class="view-btn" title="View case" data-icon="search"></span></td>'+
    '</tr>';
  }).join('');
  return tablePanel('Hold cases', list.length, [
    {t:'Case'},{t:'Status'},{t:'Product'},{t:'LOT'},{t:'Qty',num:true},{t:'Opened'},{t:'By'},{t:''}
  ], rows);
}

function viewHoldCase(id){
  var h = (getDB().holds||[]).filter(function(x){ return String(x.id)===String(id); })[0];
  if(!h){ toast('Case not found'); return; }
  var open = h.status!=='released' && h.status!=='destroyed';
  var body =
    '<div class="rec-grid">'+
      recRow('Case number', '<span class="mono">'+esc(h.caseNumber||'—')+'</span>')+
      recRow('Status', '<span class="pill '+(open?'bad':'ok')+'">'+String(h.status||'').toUpperCase()+'</span>')+
      recRow('Product', esc(h.product||'—'))+
      recRow('Lot number', '<span class="mono">'+esc(h.lot||'—')+'</span>')+
      recRow('Quantity', esc(h.quantity||'—'))+
      recRow('Line', h.line?('Line '+esc(h.line)):'—')+
      recRow('Opened', fmtDate(h.createdAt))+
      recRow('Initiated by', esc(h.initiatedBy||'—'))+
    '</div>'+
    recBlock('Reason for hold', h.reason)+
    ((h.history&&h.history.length)
      ? '<div class="rec-block"><div class="rec-lbl">History</div>'+
          h.history.slice().reverse().map(function(e){
            return '<div class="rec-hist"><div class="rec-hist-top">'+
              '<span class="pill '+((e.status!=='released'&&e.status!=='destroyed')?'bad':'ok')+'">'+String(e.status||'').toUpperCase()+'</span>'+
              '<span class="rec-hint">'+fmtDate(e.date)+' · '+esc(e.by||'—')+'</span></div>'+
              '<div class="rec-text">'+esc(e.comment||'')+'</div></div>';
          }).join('')+'</div>'
      : '');
  var actions = '<button class="btn-ghost" onclick="closeRecordModal()">Close</button>';
  openRecordModal('Hold case · <span class="mono">'+esc(h.caseNumber||'')+'</span>', body, actions);
}
