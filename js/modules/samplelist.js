// ===== LIST SAMPLES =====
// La lista de recolección del inspector de QA, en formato de hoja: para un día
// y turno, qué muestras hay que sacar de la línea y cuántas de cada producto.
//
// La cantidad la define el PRODUCTO (Products → "Lab samples per run"), no el
// cliente: dentro de un mismo cliente hay productos que no se muestrean. Los
// que van en cero también salen en la hoja, marcados "no sample", para que QA
// pueda verificar que no se toman en vez de quedarse con la duda.
var slDate = null, slShift = null, slView = 'all';   // all | todo | done | none

function initSampleList(){
  var d = document.getElementById('sl-date');
  if(d && !d.value) d.value = localDateStr();
  var s = document.getElementById('sl-shift');
  if(s && !s.value) s.value = String(expectedShift());
  renderSampleList();
}

function slFilters(){
  var d = document.getElementById('sl-date'), s = document.getElementById('sl-shift');
  slDate  = (d && d.value) ? d.value : localDateStr();
  slShift = String((s && s.value) ? s.value : expectedShift());
}
function setSlView(v){ slView = v; renderSampleList(); }

// Una corrida en la hoja: cuántas muestras pide y en qué estado va
function slRow(r){
  var n = runSampleCount(r);
  return {
    run: r,
    n: n,
    cust: runCustomer(r),
    known: (typeof findProduct==='function') ? !!findProduct(r.product) : true,
    kind: n===0 ? 'none' : (r.collected ? 'done' : 'todo')
  };
}

function renderSampleList(){
  slFilters();
  var host = document.getElementById('sl-sheet');
  if(!host) return;
  var rows = runsFor(slDate, slShift).map(slRow);

  var by  = function(k){ return rows.filter(function(x){ return x.kind===k; }); };
  var sum = function(list){ return list.reduce(function(a,x){ return a+x.n; }, 0); };
  var todo = by('todo'), done = by('done'), none = by('none');

  var kp = document.getElementById('sl-kpis');
  if(kp){
    kp.innerHTML = [
      ['all',  rows.length, 'runs scheduled',      '',    'calendar'],
      ['todo', sum(todo),   'samples to collect',  'bad', 'alert'],
      ['done', sum(done),   'collected',           'ok',  'check'],
      ['none', none.length, 'runs without sample', '',    'close']
    ].map(function(k){
      return kpiCard(k[1], k[2], {tono:k[3], icono:k[4], on:slView===k[0],
                                  click:"setSlView('"+k[0]+"')"});
    }).join('');
    renderIcons(kp);
  }

  if(!rows.length){
    host.innerHTML = '<div class="sheet-empty">Nothing scheduled for '+esc(fmtSheetDate(slDate))+
      ', '+(slShift==='1'?'1st':'2nd')+' shift. The list comes from the Production Schedule — '+
      'add the runs there and they show up here.</div>';
    return;
  }

  // El orden de trabajo: primero lo que falta, luego lo hecho, al final lo que no lleva
  var order = {todo:0, done:1, none:2};
  var view = rows.filter(function(x){ return slView==='all' || x.kind===slView; })
                 .sort(function(a,b){
                   return (order[a.kind]-order[b.kind]) ||
                          String(a.run.time||'zz').localeCompare(String(b.run.time||'zz'));
                 });

  if(!view.length){
    host.innerHTML = '<div class="sheet-empty">Nothing in this view for the day.</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Line</th><th>Time</th><th>Product</th><th class="wide">Description</th>'+
      '<th>Customer</th><th>LOT</th><th class="num">Samples</th><th>Sample #s</th>'+
      '<th>Status</th><th>Collect</th>'+
    '</tr></thead><tbody>'+
    view.map(function(x, i){ return slRowHTML(x, i+1); }).join('')+
    '</tbody></table></div>';
}

function slRowHTML(x, i){
  var r = x.run;
  var st = x.kind==='none' ? '<span class="pill">No sample</span>'
         : x.kind==='done' ? '<span class="pill ok">Collected'+
             (r.collectedAt ? ' · '+esc(fmtTime12(String(r.collectedAt).slice(11,16))) : '')+'</span>'
         : '<span class="pill bad">Pending</span>';
  var act = x.kind==='none' ? '<span class="soft">—</span>'
          : '<button class="sheet-btn'+(r.collected?' done':'')+'" '+
            'onclick="toggleRunCheck('+r.id+",'collected')"+'">'+
            (r.collected ? '✓ Collected' : 'Mark collected')+'</button>';
  return '<tr>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="mid">'+esc(String(r.line||'—'))+'</td>'+
    '<td class="soft">'+esc(r.time||'—')+'</td>'+
    '<td class="code">'+esc(r.product||'—')+'</td>'+
    '<td class="wide">'+esc(r.productName||'—')+
      (x.known ? '' : ' <span class="pill bad">not in catalog</span>')+'</td>'+
    '<td class="soft">'+esc(x.cust ? x.cust.company : '—')+'</td>'+
    '<td class="code">'+esc(r.lot||'—')+'</td>'+
    '<td class="num">'+(x.n||'—')+'</td>'+
    '<td class="code soft">'+(r.sampleFrom ? r.sampleFrom+'–'+r.sampleTo : '—')+'</td>'+
    '<td>'+st+'</td>'+
    '<td>'+act+'</td>'+
  '</tr>';
}

function fmtSheetDate(iso){
  var d = new Date(String(iso||'').slice(0,10)+'T12:00:00');
  return isNaN(d) ? String(iso||'—')
    : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

// La hoja se baja tal cual se ve, para pasarla a Excel o imprimirla
function exportSampleListCSV(){
  slFilters();
  var rows = runsFor(slDate, slShift).map(slRow);
  if(!rows.length){ toast('Nothing scheduled for that day and shift'); return; }
  var cell = function(v){
    v = String(v==null?'':v);
    return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
  };
  var out = [['Line','Time','Product','Description','Customer','LOT','Samples','Sample #s','Status']];
  rows.forEach(function(x){
    out.push([x.run.line||'', x.run.time||'', x.run.product||'', x.run.productName||'',
      x.cust ? x.cust.company : '', x.run.lot||'', x.n,
      x.run.sampleFrom ? x.run.sampleFrom+'-'+x.run.sampleTo : '',
      x.kind==='none' ? 'No sample' : (x.run.collected ? 'Collected' : 'Pending')]);
  });
  var csv = out.map(function(r){ return r.map(cell).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'sample-list-'+slDate+'-shift'+slShift+'.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
