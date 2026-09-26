// ===== LAB SAMPLES =====
// Las muestras de laboratorio salen del Production Schedule: toda corrida de un
// producto marcado "Lab sample" aparece aquí. Esta lista es la que después
// alimentará el llenado automático de la forma del laboratorio.
var labFrom = '', labTo = '', labStatus = 'pending';

function initLab(){
  var f=document.getElementById('lab-from'), t=document.getElementById('lab-to');
  if(f && !f.value){
    var d=new Date(); d.setDate(d.getDate()-7);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  if(t && !t.value) t.value = localDateStr();
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
    if(!r.labSample) return false;
    var d = String(r.date).slice(0,10);
    if(labFrom && d < labFrom) return false;
    if(labTo   && d > labTo)   return false;
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

// Cliente del producto y los tests que exige (viene de Firestore, config/customers)
function labCustomerLine(r){
  var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
  var c = (typeof productCustomer==='function') ? productCustomer(p || {number:r.product}) : null;
  if(!c) return '';
  var code = (c.prefix || c.customerId || '') + String(r.product||'').trim().toUpperCase();
  return '<div class="cust-hint">'+
    '<div class="cust-name">'+esc(c.company)+' <span class="tag">'+esc(c.customerId)+'</span></div>'+
    '<div class="cust-tests">'+(c.tests||[]).map(function(t){
      return '<span class="tag warn">'+esc(t)+'</span>'; }).join(' ')+'</div>'+
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
  var el = document.getElementById('lab-list');
  if(!el) return;
  var list = labSamples();

  // Resumen sobre TODO el rango (no sólo el estado filtrado)
  var all = labSamples('all');
  var pend = all.filter(function(r){ return !r.labSent; });
  var notReady = pend.filter(function(r){ return !labReady(r); }).length;

  var sum = document.getElementById('lab-summary');
  if(sum){
    sum.innerHTML = all.length
      ? '<div class="pr-sum">'+
          '<div class="pr-stat"><b>'+all.length+'</b><span>samples</span></div>'+
          '<div class="pr-stat"><b class="'+(pend.length?'warn':'ok')+'">'+pend.length+'</b><span>pending</span></div>'+
          '<div class="pr-stat"><b class="ok">'+(all.length-pend.length)+'</b><span>sent</span></div>'+
          '<div class="pr-stat"><b class="'+(notReady?'bad':'')+'">'+notReady+'</b><span>missing data</span></div>'+
        '</div>'
      : '';
  }

  if(!list.length){
    el.innerHTML = '<div class="panel"><div class="cd-empty">'+
      (labStatus==='pending'
        ? 'No lab samples pending in this range. Products are flagged with <b>Lab sample</b> in the product catalog.'
        : 'No lab samples in this range.')+'</div></div>';
    return;
  }

  el.innerHTML = list.map(function(r){
    var ready = labReady(r);
    var warn = !r.lot ? 'LOT missing' : (!r.collected ? 'Not collected yet' : '');
    return '<div class="run-card'+(r.labSent?' done':'')+'">'+
      '<div class="run-head">'+
        '<div>'+
          '<div class="run-title">'+esc(r.product||'—')+
            (r.labSent?' <span class="tag ok">Sent</span>':' <span class="tag warn">Pending</span>')+'</div>'+
          '<div class="run-meta">'+esc(r.productName||'—')+' · Line '+r.line+' · '+
            fmtDate(r.date)+' · '+(r.shift===1?'1st':'2nd')+' shift</div>'+
        '</div>'+
      '</div>'+
      labCustomerLine(r)+
      '<div class="lab-grid">'+
        '<div><span>LOT</span><b class="mono">'+esc(r.lot||'—')+'</b></div>'+
        '<div><span>Samples</span><b>'+labSampleCell(r)+'</b></div>'+
        '<div><span>Collected</span><b>'+(r.collected?hhmm(r.collectedAt):'—')+'</b></div>'+
        '<div><span>Sent</span><b>'+(r.labSent?hhmm(r.labSentAt):'—')+'</b></div>'+
      '</div>'+
      (warn && !r.labSent ? '<div class="lab-warn">'+warn+'</div>' : '')+
      '<button class="run-chk'+(r.labSent?' on':'')+'" onclick="markLabSent('+r.id+')" '+
        (!ready && !r.labSent ? 'style="opacity:.6"' : '')+'>'+
        '<span class="run-box">'+(r.labSent?'✓':'')+'</span>'+
        (r.labSent?'Sent to lab — tap to undo':'Mark as sent to lab')+'</button>'+
    '</div>';
  }).join('');
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
