// ===== PDF DIARIO — un reporte por turno (no mezcla los dos) =====
function exportDailyShiftPDF(){
  var dateInput = document.getElementById('sr-daily-date');
  var date  = dateInput && dateInput.value ? dateInput.value : localDateStr();
  var shift = (typeof dailyShiftSel!=='undefined') ? dailyShiftSel : 1;
  var shiftLabel = shift===1 ? '1st Shift' : '2nd Shift';

  var evs = (getShifts()||[]).filter(function(s){ return String(s.date).slice(0,10)===date && s.shift===shift; })
              .sort(function(a,b){ return String(a.reportNumber).localeCompare(String(b.reportNumber)); });
  if(!evs.length){ toast('No '+shiftLabel.toLowerCase()+' events for that date'); return; }

  var ink='#141a17', body='#2f3833', soft='#6b756f', line='#c9cfc9', head='#eceee9';
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
  var nl  = function(s){ return esc(s).replace(/\n/g,'<br>'); };
  var cap1= function(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : '—'; };
  var dateLong = new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
  var stt = {open:'#b3261e', monitoring:'#b07d1a', resolved:'#1a7f4f'};

  var eventCard = function(s, i){
    var meta = [];
    if(s.line)    meta.push('Line '+esc(s.line));
    if(s.product) meta.push('Product '+esc(s.product)+(s.productName?' — '+esc(s.productName):''));
    if(s.lot)     meta.push('LOT '+esc(s.lot));
    return '<div style="border:1px solid '+line+';border-radius:5px;padding:11px 13px;margin-bottom:9px;page-break-inside:avoid">'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:5px">'+
        '<span style="font-size:9px;color:'+soft+';font-weight:700">#'+(i+1)+'</span>'+
        '<span style="font-weight:800;font-family:monospace;font-size:10px">'+esc(s.reportNumber||'—')+'</span>'+
        (s.category?'<span style="font-size:8.5px;background:'+head+';border-radius:10px;padding:1px 8px;font-weight:700">'+esc(s.category)+'</span>':'')+
        '<span style="font-size:8.5px;font-weight:700;color:'+(stt[s.status]||soft)+'">'+cap1(s.status)+'</span>'+
        (s.followUp?'<span style="font-size:8.5px;font-weight:700;color:#b07d1a">· Follow-up required</span>':'')+
        '<span style="margin-left:auto;font-size:9px;color:'+soft+'">'+(s.area?esc(s.area):'')+'</span>'+
      '</div>'+
      '<div style="font-size:10px;white-space:pre-wrap;margin-bottom:'+(s.action?'6px':'4px')+'">'+nl(s.notes||'')+'</div>'+
      (s.action?'<div style="font-size:9.5px;color:'+body+'"><b>Action:</b> '+nl(s.action)+'</div>':'')+
      (meta.length?'<div style="font-size:8.5px;color:'+soft+';margin-top:4px">'+meta.join(' · ')+'</div>':'')+
      '<div style="font-size:8.5px;color:'+soft+';margin-top:3px">Reported by '+esc(s.reportedBy||'—')+
        (s.supervisor?' · Supervisor '+esc(s.supervisor):'')+'</div>'+
    '</div>';
  };

  var follow = evs.filter(function(s){ return s.followUp && s.status!=='resolved'; }).length;
  var cats = {};
  evs.forEach(function(s){ if(s.category) cats[s.category]=(cats[s.category]||0)+1; });
  var catLine = Object.keys(cats).map(function(k){ return k+' ('+cats[k]+')'; }).join(' · ');

  var doc =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+shiftLabel+' Report '+esc(date)+'</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+body+';font-size:10px;margin:0;padding:24px 28px}'+
    '@page{size:portrait;margin:14mm}'+
    'h1{font-size:16px;color:'+ink+';margin:0;font-weight:800}'+
    '.savebtn{position:fixed;top:14px;right:16px;background:'+ink+';color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'+
    '@media print{body{padding:0}.savebtn{display:none}}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+

  '<header style="border-bottom:2px solid '+ink+';padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px">'+
    '<div><h1>'+shiftLabel+' Report</h1>'+
      '<div style="font-size:10px;color:'+soft+';margin-top:3px">'+dateLong+'</div></div>'+
    '<div style="text-align:right;font-size:9px;color:'+soft+';line-height:1.7">'+
      '<div><b style="color:'+ink+'">Events:</b> '+evs.length+'</div>'+
      '<div>Follow-ups pending: '+follow+'</div>'+
      '<div>Generated '+generated+'</div>'+
    '</div>'+
  '</header>'+

  (catLine?'<div style="font-size:9px;color:'+soft+';margin-bottom:12px">By category: '+esc(catLine)+'</div>':'')+
  evs.map(eventCard).join('')+

  '<footer style="border-top:1px solid '+line+';padding-top:6px;margin-top:6px;font-size:8px;color:'+soft+';display:flex;justify-content:space-between">'+
    '<span>'+shiftLabel+' Report · '+esc(date)+'</span><span>Generated '+generated+'</span></footer>'+
  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.target = '_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast(shiftLabel+' report opened — use Save as PDF');
}

// ===== PDF del SHIFT REPORT (individual) =====
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
