// ===== SEARCH =====
// Búsqueda única por LOT, número de producto, código de barras o descripción.
// Devuelve la ficha del producto y todo su historial: pesos, bag seal y holds.
var searchQuery = '', searchDone = false;

function initSearch(){
  var i = document.getElementById('search-input');
  if(i) i.value = searchQuery;
  renderSearch();
}

function runSearch(){
  var i = document.getElementById('search-input');
  searchQuery = (i ? i.value : '').trim();
  searchDone = true;
  if(!searchQuery){ toast('Enter a LOT, product number or description'); searchDone=false; }
  renderSearch();
}

function clearSearch(){
  searchQuery = ''; searchDone = false;
  var i = document.getElementById('search-input');
  if(i){ i.value=''; i.focus(); }
  renderSearch();
}

function searchOnKey(e){ if(e.key==='Enter') runSearch(); }

// Producto que coincide por número, código de barras o descripción
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
  var prod = searchProduct(q);
  var nums = prod ? [String(prod.number).toLowerCase()] : [];

  var hit = function(r){
    var lot  = String(r.lot||'').toLowerCase();
    var pnum = String(r.product||'').toLowerCase();
    var pname= String(r.productName||'').toLowerCase();
    return lot.indexOf(l)>-1 || pnum.indexOf(l)>-1 || pname.indexOf(l)>-1 ||
           (nums.length && nums.indexOf(pnum)>-1);
  };
  var byDate = function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); };

  var db = getDB();
  return {
    product: prod,
    weights: (db.weights||[]).filter(hit).sort(byDate),
    seals:   (db.seals||[]).filter(hit).sort(byDate),
    holds:   (db.holds||[]).filter(function(h){
               return String(h.lot||'').toLowerCase().indexOf(l)>-1 ||
                      String(h.product||'').toLowerCase().indexOf(l)>-1;
             }).sort(function(a,b){ return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); })
  };
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
      'Search by LOT number, product number, barcode or description to pull up the product and its full history.'+
      '</div></div>';
    return;
  }

  var r = searchResults();
  var total = r.weights.length + r.seals.length + r.holds.length;
  if(!total && !r.product){
    el.innerHTML = '<div class="panel"><div class="cd-empty">No records found for “'+searchQuery+'”.</div></div>';
    return;
  }

  var scored = r.weights.filter(function(w){ return w.compliance!=null; });
  var avg = scored.length
    ? Math.round(scored.reduce(function(a,w){ return a+w.compliance; },0)/scored.length)
    : null;
  var dates = r.weights.concat(r.seals).map(function(x){ return String(x.date||'').slice(0,10); })
              .filter(Boolean).sort();
  var openHolds = r.holds.filter(function(h){ return h.status!=='released' && h.status!=='destroyed'; }).length;

  el.innerHTML =
    productPanel(r.product, searchQuery) +
    summaryStrip(r, avg, dates, openHolds) +
    weightPanel(r.weights) +
    sealPanel(r.seals) +
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

function tablePanel(title, count, headers, rows){
  return '<div class="panel res-panel">'+
    '<div class="res-head"><span class="res-title">'+title+'</span>'+
      '<span class="res-count">'+count+' record'+(count===1?'':'s')+'</span></div>'+
    (count
      ? '<div class="table-scroll"><table class="cat-table"><thead><tr>'+
          headers.map(function(h){ return '<th'+(h.num?' class="num"':'')+'>'+h.t+'</th>'; }).join('')+
        '</tr></thead><tbody>'+rows+'</tbody></table></div>'
      : '<div class="cd-empty" style="padding:18px">No records</div>')+
  '</div>';
}

function weightPanel(list){
  var rows = list.map(function(w){
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
  ], rows);
}

function sealPanel(list){
  var mark = function(v){
    if(v==='pass') return '<span class="pill ok">PASS</span>';
    if(v==='fail') return '<span class="pill bad">FAIL</span>';
    return '<span class="pill">—</span>';
  };
  var rows = list.map(function(s){
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
  ], rows);
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
