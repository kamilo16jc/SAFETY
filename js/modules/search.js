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

  return {
    product: prod,
    weights: wantW ? (db.weights||[]).filter(keep).sort(byDate) : [],
    seals:   wantS ? (db.seals||[]).filter(keep).sort(byDate)   : [],
    holds:   wantH ? (db.holds||[]).filter(function(h){
               var hitTxt = !l || String(h.lot||'').toLowerCase().indexOf(l)>-1 ||
                            String(h.product||'').toLowerCase().indexOf(l)>-1;
               var hitLine = sf.line==='all' || String(h.line||'')===sf.line;
               return hitTxt && hitLine && inDateRange(h.createdAt);
             }).sort(function(a,b){ return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); }) : []
  };
}

// Resumen de lo que se está filtrando
function activeFilterChips(){
  var chips = [];
  if(searchQuery){
    var where = {lot:'LOT', product:'Product', name:'Description'}[sf.field] || 'Any field';
    chips.push(where+': '+searchQuery);
  }
  if(sf.from && sf.to)      chips.push(fmtDate(sf.from)+' — '+fmtDate(sf.to));
  else if(sf.from)          chips.push('From '+fmtDate(sf.from));
  else if(sf.to)            chips.push('Up to '+fmtDate(sf.to));
  if(sf.line!=='all')       chips.push('Line '+sf.line);
  if(sf.shift!=='all')      chips.push((sf.shift==='1'?'1st':'2nd')+' shift');
  if(sf.type!=='all')       chips.push({weight:'Weight only',seal:'Bag seal only',hold:'Holds only'}[sf.type]);
  if(!chips.length) return '';
  return '<div class="filter-chips">'+chips.map(function(c){
    return '<span class="fchip">'+c+'</span>';
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
  var total = r.weights.length + r.seals.length + r.holds.length;
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
    holdPanel(r.holds);
  renderIcons(el);
}

function productPanel(p, q){
  if(!p){
    return '<div class="panel res-panel"><div class="res-head"><span class="res-title">No catalog product matches “'+q+'”</span></div>'+
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
      '<span class="res-title">'+(p.name || 'Product '+p.number)+'</span>'+
      '<span class="res-sub">Product '+p.number+'</span>'+
    '</div>'+
    '<div class="res-grid">'+
      f('Product number', p.number, true)+
      f('Description', p.name||'—')+
      f('Package size', p.pkgLabel||'—', true)+
      f('Target range', target)+
      f('Bags per case', p.bagsPerCase||'—')+
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
      '<td class="mono code">'+(w.lot||'—')+'</td>'+
      '<td class="mono">'+(w.product||'—')+'</td>'+
      '<td class="mono">'+(w.pkgLabel||'—')+'</td>'+
      '<td class="samples">'+(samples||'—')+'</td>'+
      '<td class="mono num">'+(w.avg!=null?parseFloat(w.avg).toFixed(3):'—')+'</td>'+
      '<td class="num"><span class="pill '+cls+'">'+compLabel(w.compliance)+'</span></td>'+
      '<td class="soft">'+(w.initials||'—')+'</td>'+
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
      '<td class="mono code">'+(s.lot||'—')+'</td>'+
      '<td class="mono">'+(s.product||'—')+'</td>'+
      '<td>'+mark(c['Visual'])+'</td>'+
      '<td>'+mark(c['Dunk Tank'])+'</td>'+
      '<td>'+mark(c['Printing'])+'</td>'+
      '<td class="soft">'+(s.initials||'—')+'</td>'+
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
    return '<tr onclick="goTo(\'screen-hold\')">'+
      '<td class="mono code">'+h.caseNumber+'</td>'+
      '<td><span class="pill '+(open?'bad':'ok')+'">'+String(h.status||'').toUpperCase()+'</span></td>'+
      '<td class="desc">'+(h.product||'—')+'</td>'+
      '<td class="mono">'+(h.lot||'—')+'</td>'+
      '<td class="mono num">'+(h.quantity||'—')+'</td>'+
      '<td class="mono">'+fmtDate(h.createdAt)+'</td>'+
      '<td class="soft">'+(h.initiatedBy||'—')+'</td>'+
    '</tr>';
  }).join('');
  return tablePanel('Hold cases', list.length, [
    {t:'Case'},{t:'Status'},{t:'Product'},{t:'LOT'},{t:'Qty',num:true},{t:'Opened'},{t:'By'}
  ], rows);
}
