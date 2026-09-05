// ===== PDF del SHIFT REPORT =====
function exportShiftPDF(id){
  var rec = getShifts().filter(function(s){ return s.id===id; })[0];
  if(!rec){ toast('Report not found'); return; }

  var ink='#141a17', body='#2f3833', soft='#6b756f', line='#c9cfc9', head='#eceee9';
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
  var nl  = function(s){ return esc(s).replace(/\n/g,'<br>'); };
  var d   = function(iso){ if(!iso) return '__________'; var x=new Date(String(iso).length<=10?iso+'T12:00:00':iso);
             return isNaN(x)?esc(iso):x.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}); };
  var cap1 = function(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : '—'; };

  var field = function(label, value){
    return '<div style="margin-bottom:8px"><span style="font-weight:700;color:'+ink+'">'+label+'</span> '+
      '<span style="border-bottom:1px solid '+line+';display:inline-block;min-width:120px">'+(value?esc(value):'&nbsp;')+'</span></div>';
  };
  var block = function(label, value){
    return '<div style="margin-bottom:12px">'+
      '<div style="font-weight:700;color:'+ink+';font-size:10px;margin-bottom:4px">'+label+'</div>'+
      '<div style="border:1px solid '+line+';border-radius:4px;padding:8px 10px;min-height:44px;font-size:10px;white-space:pre-wrap">'+
        (value?nl(value):'&nbsp;')+'</div></div>';
  };

  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});

  var doc =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(rec.reportNumber||'Shift Report')+'</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+body+';font-size:10px;margin:0;padding:24px 28px}'+
    '@page{size:portrait;margin:14mm}'+
    'h1{font-size:15px;color:'+ink+';margin:0;font-weight:800}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
    '@media print{body{padding:0}.savebtn{display:none}}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+

  '<div style="text-align:center;border-bottom:2px solid '+ink+';padding-bottom:8px;margin-bottom:14px">'+
    '<h1>Shift Report</h1>'+
    '<div style="font-size:9px;color:'+soft+';margin-top:3px">Notes of shift events not requiring a CAPA</div>'+
  '</div>'+

  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin-bottom:12px">'+
    field('Report Number:', rec.reportNumber)+
    field('Date:', d(rec.date))+
    field('Shift:', rec.shift?(rec.shift===1?'1st':'2nd')+' shift':'')+
    field('Area:', rec.area)+
    field('Category:', rec.category)+
    field('Line:', rec.line)+
    field('Product / Item #:', rec.product + (rec.productName?' — '+rec.productName:''))+
    field('Lot Number:', rec.lot)+
    field('Status:', cap1(rec.status))+
    field('Follow-up required:', rec.followUp?'Yes':'No')+
  '</div>'+

  block('What happened:', rec.notes)+
  block('Action taken:', rec.action)+

  '<div style="margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:24px">'+
    '<div><div style="border-bottom:1px solid '+ink+';padding-bottom:2px;font-size:11px">'+esc(rec.reportedBy||'')+'&nbsp;</div>'+
      '<div style="font-size:9px;color:'+soft+';margin-top:3px">Reported By &nbsp;&nbsp; Date: '+d(rec.date)+'</div></div>'+
    '<div><div style="border-bottom:1px solid '+ink+';padding-bottom:2px;font-size:11px">'+esc(rec.supervisor||'')+'&nbsp;</div>'+
      '<div style="font-size:9px;color:'+soft+';margin-top:3px">Shift Supervisor</div></div>'+
  '</div>'+

  '<div style="border-top:1px solid '+line+';margin-top:22px;padding-top:6px;font-size:8px;color:'+soft+';display:flex;justify-content:space-between">'+
    '<span>Shift Report · '+esc(rec.reportNumber||'')+'</span><span>Generated '+generated+'</span></div>'+
  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.target = '_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast('Report opened — use Save as PDF');
}
