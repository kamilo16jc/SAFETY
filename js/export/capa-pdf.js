// ===== PDF del INCIDENT & CAPA REPORT (SQF #2.5.C.2) =====
// Réplica limpia de la forma oficial, con las tres severidades y sus casillas.
function exportCapaPDF(id){
  var rec = getCapa().filter(function(c){ return c.id===id; })[0];
  if(!rec){ toast('Report not found'); return; }

  var ink='#141a17', body='#2f3833', soft='#6b756f', line='#c9cfc9', head='#eceee9';
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); };
  var nl  = function(s){ return esc(s).replace(/\n/g,'<br>'); };
  var d   = function(iso){ if(!iso) return '__________'; var x=new Date(String(iso).length<=10?iso+'T12:00:00':iso);
             return isNaN(x)?esc(iso):x.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}); };

  var box = function(on){ return on
    ? '<span style="font-family:monospace;font-size:12px">&#9746;</span>'
    : '<span style="font-family:monospace;font-size:12px">&#9744;</span>'; };

  var field = function(label, value){
    return '<div style="margin-bottom:8px"><span style="font-weight:700;color:'+ink+'">'+label+'</span> '+
      '<span style="border-bottom:1px solid '+line+';display:inline-block;min-width:120px">'+(value?esc(value):'&nbsp;')+'</span></div>';
  };
  var block = function(label, value){
    return '<div style="margin-bottom:12px">'+
      '<div style="font-weight:700;color:'+ink+';font-size:10px;margin-bottom:4px">'+label+'</div>'+
      '<div style="border:1px solid '+line+';border-radius:4px;padding:8px 10px;min-height:38px;font-size:10px;white-space:pre-wrap">'+
        (value?nl(value):'&nbsp;')+'</div></div>';
  };

  var sevRows = CAPA_SEVERITY.map(function(s){
    var on = rec.severity===s.key;
    return '<div style="display:flex;gap:8px;margin-bottom:6px;'+(on?'background:'+head+';padding:4px 6px;border-radius:4px':'padding:4px 6px')+'">'+
      '<div style="flex-shrink:0">'+box(on)+'</div>'+
      '<div style="font-size:9px;line-height:1.4"><b>'+s.label+'</b> ('+s.desc+') &mdash; requires the start of an investigation '+s.deadline+' after observation/documentation of incident or faster if possible.</div>'+
    '</div>';
  }).join('');

  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});

  var doc =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(rec.reportNumber||'CAPA')+'</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+body+';font-size:10px;margin:0;padding:24px 28px}'+
    '@page{size:portrait;margin:14mm}'+
    'h1{font-size:15px;color:'+ink+';margin:0;font-weight:800}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
    '@media print{body{padding:0}.savebtn{display:none}}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+

  '<div style="text-align:center;border-bottom:2px solid '+ink+';padding-bottom:8px;margin-bottom:14px">'+
    '<h1>SQF Document #2.5.C.2: Incident &amp; CAPA Report</h1>'+
  '</div>'+

  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin-bottom:12px">'+
    field('Date of Discrepancy / Report Number:', rec.reportNumber)+
    field('Customer Complaint # (if applicable):', rec.complaint)+
    field('Date of CAPA:', d(rec.capaDate))+
    field('Building Number / Item #:', rec.product + (rec.productName?' — '+rec.productName:''))+
    field('Lot Number:', rec.lot)+
    field('Status:', (CAPA_SEVERITY && rec.status) ? (rec.status.charAt(0).toUpperCase()+rec.status.slice(1)) : '')+
  '</div>'+

  '<div style="font-weight:700;color:'+ink+';font-size:11px;margin:10px 0 6px">Corrective Action Severity:</div>'+
  sevRows+

  '<div style="font-weight:700;color:'+ink+';font-size:11px;margin:14px 0 8px">Description of Incident / Root Cause Analysis Investigation / Description of Affected Product/Area and Outcome(s):</div>'+
  block('Problem / Deviation:', rec.problem)+
  block('Investigation, affected product/area and outcomes:', rec.description)+
  block('Initial Short-Term Corrective Action(s) Taken'+(rec.shortDate?' — '+d(rec.shortDate):'')+':', rec.shortTerm)+
  block('Long-Term Corrective Action / Preventative Action(s) Taken'+(rec.longDate?' — '+d(rec.longDate):'')+':', rec.longTerm)+

  '<div style="margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:24px">'+
    '<div><div style="border-bottom:1px solid '+ink+';padding-bottom:2px;font-size:11px">'+esc(rec.completedBy||'')+'&nbsp;</div>'+
      '<div style="font-size:9px;color:'+soft+';margin-top:3px">Completed By (Print Name) &nbsp;&nbsp; Date: '+d(rec.shortDate||rec.capaDate)+'</div></div>'+
    '<div><div style="border-bottom:1px solid '+ink+';padding-bottom:2px;font-size:11px">'+esc(rec.verifiedBy||'')+'&nbsp;</div>'+
      '<div style="font-size:9px;color:'+soft+';margin-top:3px">Verified By (Signature) &nbsp;&nbsp; Date: '+d(rec.longDate||'')+'</div></div>'+
  '</div>'+

  '<div style="border-top:1px solid '+line+';margin-top:22px;padding-top:6px;font-size:8px;color:'+soft+';display:flex;justify-content:space-between">'+
    '<span>SQF #2.5.C.2 · '+esc(rec.reportNumber||'')+'</span><span>Generated '+generated+'</span></div>'+
  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.target = '_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast('Report opened — use Save as PDF');
}
