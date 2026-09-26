// ===== LIST SAMPLES =====
// La lista de recolección del inspector de QA: para un día y turno, qué
// muestras hay que sacar de la línea y cuántas de cada producto.
//
// La cantidad la define el PRODUCTO (Products → "Lab samples per run"), no el
// cliente: dentro de un mismo cliente hay productos que no se muestrean. Los
// que van en cero salen aparte, para que QA pueda verificar que no se toman
// en vez de quedarse con la duda.
var slDate = null, slShift = null;

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

// Una corrida en la lista: cuántas muestras pide y qué se sabe de ella
function slRow(r){
  var n = runSampleCount(r);
  var c = runCustomer(r);
  var known = (typeof findProduct==='function') ? !!findProduct(r.product) : true;
  return {run:r, n:n, cust:c, known:known};
}

function renderSampleList(){
  slFilters();
  var left  = document.getElementById('sl-left');
  var right = document.getElementById('sl-right');
  if(!left || !right) return;
  var rows = runsFor(slDate, slShift).map(slRow);

  var todo = rows.filter(function(x){ return x.n>0 && !x.run.collected; });
  var done = rows.filter(function(x){ return x.n>0 &&  x.run.collected; });
  var none = rows.filter(function(x){ return x.n===0; });
  var sum  = function(list){ return list.reduce(function(a,x){ return a+x.n; }, 0); };

  var el = document.getElementById('sl-summary');
  if(el){
    el.innerHTML = rows.length
      ? '<div class="pr-sum">'+
          '<div class="pr-stat"><b class="'+(sum(todo)?'warn':'ok')+'">'+sum(todo)+'</b><span>to collect</span></div>'+
          '<div class="pr-stat"><b class="ok">'+sum(done)+'</b><span>collected</span></div>'+
          '<div class="pr-stat"><b>'+(sum(todo)+sum(done))+'</b><span>samples today</span></div>'+
          '<div class="pr-stat"><b>'+none.length+'</b><span>runs without sample</span></div>'+
        '</div>'
      : '';
  }

  if(!rows.length){
    left.innerHTML = '<div class="panel"><div class="cd-empty">'+
      'Nothing scheduled for this day and shift. The list comes from the '+
      'Production Schedule — add the runs there and they show up here.</div></div>';
    right.innerHTML = '';
    return;
  }

  // Izquierda lo que falta por recoger, derecha lo ya hecho y lo que no lleva
  left.innerHTML  = slBlock('To collect', todo, 'todo');
  right.innerHTML = slBlock('Collected', done, 'done') +
                    slBlock('No sample required', none, 'none');
}

function slBlock(title, rows, kind){
  if(!rows.length && kind==='none') return '';
  var body = rows.length
    ? rows.map(function(x){ return slCard(x, kind); }).join('')
    : '<div class="panel"><div class="cd-empty">'+
        (kind==='todo' ? 'Every sample for this shift is collected.' : 'Nothing here yet.')+
      '</div></div>';
  return '<div class="sec-label">'+title+' <span class="sl-count">'+rows.length+'</span></div>'+body;
}

function slCard(x, kind){
  var r = x.run;
  var label = x.n + ' sample' + (x.n===1 ? '' : 's');
  var numbered = x.cust && x.cust.numbered;
  return '<div class="run-card'+(kind==='done'?' done':'')+(kind==='none'?' sl-skip':'')+'">'+
    '<div class="run-head"><div>'+
      '<div class="run-title">Line '+esc(String(r.line||'—'))+' · '+esc(r.product||'—')+
        (kind==='none'
          ? ' <span class="tag">no sample</span>'
          : ' <span class="tag '+(kind==='done'?'ok':'warn')+'">'+label+'</span>')+
        (numbered && kind!=='none' ? ' <span class="tag">numbered</span>' : '')+
      '</div>'+
      '<div class="run-meta">'+esc(r.productName||'—')+
        (x.cust ? ' · '+esc(x.cust.company) : '')+
        (r.time ? ' · '+esc(r.time) : '')+
        (r.lot ? ' · LOT '+esc(r.lot) : '')+
      '</div>'+
      (!x.known
        ? '<div class="run-warn">This product is not in the catalog yet — add it in Products to set how many samples it needs.</div>'
        : '')+
      (r.sampleFrom ? '<div class="run-meta"><b>Samples '+r.sampleFrom+'–'+r.sampleTo+'</b></div>' : '')+
      (kind==='done' && r.collectedAt
        ? '<div class="run-meta">Collected '+esc(fmtTime12(String(r.collectedAt).slice(11,16)))+'</div>' : '')+
    '</div></div>'+
    (kind==='none' ? '' :
      '<div class="run-checks"><button class="run-chk'+(r.collected?' on':'')+'" '+
        'onclick="toggleRunCheck('+r.id+",'collected')"+'">'+
        '<span class="run-box">'+(r.collected?'✓':'')+'</span>'+
        (r.collected ? 'Collected from line' : 'Mark collected')+
      '</button></div>')+
  '</div>';
}
