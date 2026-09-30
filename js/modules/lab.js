// ===== LAB SAMPLES =====
// Las muestras de laboratorio salen del Production Schedule: toda corrida de un
// producto marcado "Lab sample" aparece aquí. Esta lista es la que después
// alimentará el llenado automático de la forma del laboratorio.
var labFrom = '', labTo = '', labStatus = 'pending';

function initLab(){
  labDirty = false; renderLabDirty();
  renderLab();
}

// Las fechas esperan al boton: pueden tener que pedir historial
var labDirty = false;
function markLabDirty(){
  if(labDirty) return;
  labDirty = true; renderLabDirty();
}
function renderLabDirty(){
  var el = document.getElementById('lab-dirty');
  if(el) el.style.display = labDirty ? 'block' : 'none';
  var b = document.getElementById('lab-go');
  if(b) b.classList.toggle('pending', labDirty);
}
function applyLabFilters(){
  labDirty = false; renderLabDirty();
  var f = document.getElementById('lab-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderLab); return; }
  renderLab();
}

function labFilters(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  labFrom = g('lab-from'); labTo = g('lab-to');
  labStatus = g('lab-status') || 'pending';
}

// Corridas que requieren muestra de laboratorio dentro del rango.
// statusOverride permite pedir "all" sin tocar el filtro de la pantalla.
function labSamples(statusOverride){
  labFilters();
  var status = statusOverride || labStatus;
  return getRuns().filter(function(r){
    if(runSampleCount(r)<=0) return false;
    if(!inScope(r.date, labFrom, labTo, !r.labSent)) return false;
    if(status==='pending' && r.labSent) return false;
    if(status==='sent'    && !r.labSent) return false;
    return true;
  }).sort(function(a,b){
    return String(b.date).localeCompare(String(a.date)) ||
           String(a.time||'').localeCompare(String(b.time||''));
  });
}

// Una muestra está lista para enviar cuando tiene LOT y ya se recogió
function labReady(r){ return !!r.lot && !!r.collected; }

function markLabSent(id){
  var run = findRun(id);
  if(!run) return;
  if(!run.labSent && !run.lot){ toast('Enter the LOT first — the lab form needs it'); return; }
  if(!run.labSent && !run.collected){ toast('Mark the sample as collected first'); return; }
  toggleRunCheck(id, 'labSent');
  logActivity('lab', run.labSent ? 'Lab sample sent' : 'Lab sample un-sent',
    'Line '+run.line+' · '+(run.product||'—')+' · LOT '+(run.lot||'—'),
    currentUser?currentUser.name:'—');
}

// Cliente del producto, su codigo de forma y los tests que exige
function labCustomerOf(r){
  var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
  return (typeof productCustomer==='function') ? productCustomer(p || {number:r.product}) : null;
}
function labFormCode(r, c){
  c = c || labCustomerOf(r);
  if(!c) return '';
  return (c.prefix || c.customerId || '') + String(r.product||'').trim().toUpperCase();
}

// Cliente del producto y los tests que exige (viene de Firestore, config/customers)
function labCustomerLine(r){
  var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
  var c = (typeof productCustomer==='function') ? productCustomer(p || {number:r.product}) : null;
  if(!c) return '';
  var code = (c.prefix || c.customerId || '') + String(r.product||'').trim().toUpperCase();
  return '<div class="cust-hint">'+
    '<div class="cust-name">'+esc(c.company)+' <span class="tag">'+esc(c.customerId)+'</span></div>'+
    '<div class="cust-tests">'+((typeof testsLegendHTML==='function')
      ? testsLegendHTML([c.tests])
      : (c.tests||[]).map(function(t){ return '<span class="tag">'+esc(t)+'</span>'; }).join(' '))+'</div>'+
    '<div class="lab-code">Lab form code: <b class="mono">'+esc(code)+'</b></div></div>';
}

// Los clientes numerados llevan un rango; los demás, 1 sample sin numerar
function labSampleCell(r){
  if(r.sampleFrom) return r.sampleFrom+'–'+r.sampleTo;
  var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
  var c = (typeof productCustomer==='function') ? productCustomer(p || {number:r.product}) : null;
  return (c && !c.numbered) ? '1' : '—';
}

function hhmm(iso){
  var s = String(iso||'');
  var i = s.indexOf('T');
  return i>0 ? s.slice(i+1, i+6) : '—';
}

function renderLab(){
  if(typeof renderLabForms==='function') renderLabForms();
  var host = document.getElementById('lab-sheet');
  if(!host) return;
  var list = labSamples();

  // Resumen sobre TODO el rango (no solo el estado filtrado)
  var all = labSamples('all');
  var pend = all.filter(function(r){ return !r.labSent; });
  var notReady = pend.filter(function(r){ return !labReady(r); }).length;

  var sum = document.getElementById('lab-summary');
  if(sum){
    var k = function(n, label, color){
      return '<div class="kpi"><b>'+n+'</b><span>'+
        (color ? '<i class="dot" style="background:'+color+'"></i>' : '')+label+'</span></div>';
    };
    sum.innerHTML = all.length
      ? k(all.length, 'samples', '') +
        k(pend.length, 'pending', pend.length?'var(--fail)':'var(--pass)') +
        k(all.length-pend.length, 'sent', 'var(--pass)') +
        k(notReady, 'missing data', notReady?'var(--fail)':'var(--dim)')
      : '';
  }

  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (labStatus==='pending'
        ? 'No lab samples pending in this range. A product asks for a sample when its '+
          '"Lab samples per run" is above zero in the catalog.'
        : 'No lab samples in this range.')+'</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Date</th><th>Shift</th><th>Line</th><th>Product</th>'+
      '<th class="wide">Description</th><th>Customer</th><th>Lab code</th><th>Tests</th>'+
      '<th>LOT</th><th class="num">Samples</th><th>Collected</th><th>Sent</th><th>Status</th><th></th>'+
    '</tr></thead><tbody>'+
    list.map(function(r,i){ return labRowHTML(r,i+1); }).join('')+
    '</tbody></table></div>'+
    // La leyenda va pegada a la hoja: sin ella los puntos no dicen nada en el
    // telefono, donde no se puede pasar el raton por encima.
    (typeof testsLegendHTML==='function'
      ? testsLegendHTML(list.map(function(r){
          var c = labCustomerOf(r);
          var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
          return (typeof labTestsOf==='function') ? labTestsOf(p, c) : (c?c.tests:[]);
        }))
      : '');
  renderIcons(host);
}

function labRowHTML(r, i){
  var c = labCustomerOf(r);
  var ready = labReady(r);
  var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
  var suyos = (typeof labTestsOf==='function') ? labTestsOf(p, c) : ((c && c.tests) || []);
  // Sin tests no hay nada que mandar, y el operador tiene que saber por que
  // esa fila no le saca forma
  var status = !suyos.length ? '<span class="soft">No lab tests</span>'
             : r.labSent ? '<span class="pill ok">Sent</span>'
             : !r.lot ? '<span class="pill bad">Pending · LOT missing</span>'
             : !r.collected ? '<span class="pill bad">Pending · not collected</span>'
             : '<span class="pill warn">Pending</span>';
  var tests = (typeof testDotsHTML==='function')
    ? testDotsHTML(suyos)
    : (suyos.length ? esc(suyos.join(', ')) : '\u2014');
  return '<tr'+(r.labSent?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="soft">'+esc(fmtDate(r.date))+'</td>'+
    '<td class="mid soft">'+(r.shift===1?'1st':'2nd')+'</td>'+
    '<td class="mid">'+esc(String(r.line||'\u2014'))+'</td>'+
    '<td class="code">'+esc(r.product||'\u2014')+'</td>'+
    '<td class="wide">'+esc(r.productName||'\u2014')+'</td>'+
    '<td class="soft">'+esc(c ? c.company : '\u2014')+'</td>'+
    '<td class="code">'+esc(labFormCode(r,c)||'\u2014')+'</td>'+
    '<td class="wide">'+tests+'</td>'+
    '<td><input class="cell" placeholder="LOT" value="'+esc(r.lot||'')+'" '+
      'onchange="setRunLot('+r.id+', this.value); renderLab()"></td>'+
    '<td class="num">'+labSampleCell(r)+'</td>'+
    '<td class="soft">'+(r.collected?esc(hhmm(r.collectedAt)):'\u2014')+'</td>'+
    '<td class="soft">'+(r.labSent?esc(hhmm(r.labSentAt)):'\u2014')+'</td>'+
    '<td>'+status+'</td>'+
    '<td><button class="cell-tog'+(r.labSent?' on':'')+'" onclick="markLabSent('+r.id+')"'+
      (!ready && !r.labSent ? ' style="opacity:.6"' : '')+'>'+
      (r.labSent ? '\u2713 Sent' : 'Send')+'</button></td>'+
  '</tr>';
}

// La lista tal como se ve, para Excel
function exportLabCSV(){
  var list = labSamples();
  if(!list.length){ toast('No lab samples for these filters'); return; }
  var out = [['Date','Shift','Line','Product','Description','Customer','Lab code','Tests',
              'LOT','Samples','Collected','Sent']];
  list.forEach(function(r){
    var c = labCustomerOf(r);
    out.push([String(r.date||'').slice(0,10), r.shift===1?'1st':'2nd', r.line||'',
      r.product||'', r.productName||'', c?c.company:'', labFormCode(r,c),
      (typeof labTestsOf==='function'
        ? labTestsOf((typeof findProduct==='function')?findProduct(r.product):null, c).join(' / ')
        : (c?(c.tests||[]).join(' / '):'')), r.lot||'', labSampleCell(r),
      r.collected?hhmm(r.collectedAt):'', r.labSent?hhmm(r.labSentAt):'']);
  });
  downloadCSV('lab-samples-'+localDateStr()+'.csv', out);
}

// ---- PDF: lista de muestras para llevar al laboratorio ----
function exportLabPDF(){
  var list = labSamples();
  if(!list.length){ toast('No lab samples for these filters'); return; }
  var ink='#141a17', body='#2f3833', soft='#6b756f', line='#c9cfc9', head='#eceee9';
  var e = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
  var th='style="border:1px solid '+line+';padding:5px 7px;background:'+head+';font-size:9px;text-align:left;font-weight:800"';
  var td='style="border:1px solid '+line+';padding:5px 7px;font-size:9.5px"';

  var rows = list.map(function(r){
    return '<tr>'+
      '<td '+td+'>'+fmtDate(r.date)+'</td>'+
      '<td '+td+'>'+(r.shift===1?'1st':'2nd')+'</td>'+
      '<td '+td+'>Line '+e(r.line)+'</td>'+
      '<td '+td+'>'+e(r.product||'—')+'</td>'+
      '<td '+td+'>'+e(r.productName||'—')+'</td>'+
      '<td '+td+' class="mono">'+e(r.lot||'—')+'</td>'+
      '<td '+td+' align="center">'+(r.collected?hhmm(r.collectedAt):'—')+'</td>'+
      '<td '+td+' align="center">'+(r.labSent?hhmm(r.labSentAt):'—')+'</td>'+
    '</tr>';
  }).join('');

  var doc='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lab Samples</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+body+';font-size:10px;margin:0;padding:24px 28px}'+
    '@page{size:portrait;margin:0}'+
    '@media print{body{padding:14mm}.savebtn{display:none}}'+
    'h1{font-size:16px;color:'+ink+';margin:0;font-weight:800}'+
    'table{width:100%;border-collapse:collapse}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
  '<header style="border-bottom:2px solid '+ink+';padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px">'+
    '<div><h1>Lab Samples</h1>'+
      '<div style="font-size:10px;color:'+soft+';margin-top:3px">'+
        (labFrom?fmtDate(labFrom):'—')+' – '+(labTo?fmtDate(labTo):'—')+
        ' · '+(labStatus==='pending'?'Pending':labStatus==='sent'?'Sent':'All')+'</div></div>'+
    '<div style="text-align:right;font-size:9px;color:'+soft+';line-height:1.7">'+
      '<div><b style="color:'+ink+'">Samples:</b> '+list.length+'</div>'+
      '<div>Generated '+generated+'</div></div>'+
  '</header>'+
  '<table><tr><th '+th+'>Date</th><th '+th+'>Shift</th><th '+th+'>Line</th><th '+th+'>Product #</th>'+
    '<th '+th+'>Description</th><th '+th+'>LOT</th><th '+th+' align="center">Collected</th>'+
    '<th '+th+' align="center">Sent</th></tr>'+rows+'</table>'+
  '<div style="border-top:1px solid '+line+';margin-top:18px;padding-top:8px;font-size:9px;color:'+soft+'">'+
    'Received by: ____________________________　　Date: ______________</div>'+
  '</body></html>';

  var blob=new Blob([doc],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); },4000);
  toast('Lab sample list opened — use Save as PDF');
}
