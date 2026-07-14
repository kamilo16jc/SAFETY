// ===== PDF WEIGHT =====
function exportWeightPDF(){
  var db=getDB();
  if(!db.weights.length){toast('No records to export');return}
  var now=new Date();
  var dateStr=now.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
  var records=db.weights.slice().reverse();
  var lineVal=st.line?'Line '+st.line:'___';
  var shiftVal=st.shift?(st.shift===1?'1st':'2nd'):'___';
  var tBags=db.weights.reduce(function(a,r){return a+r.total},0);
  var tPass=db.weights.reduce(function(a,r){return a+r.pass},0);
  var tFail=tBags-tPass;
  var comp=tBags?Math.round((tPass/tBags)*100):0;
  var compColor=comp>=80?'#16a34a':'#dc2626';
  var th='style="border:1px solid #999;padding:4px 6px;background:#333;color:white;font-size:9px;text-align:center"';
  var thr='style="border:1px solid #999;padding:4px 6px;background:#c8102e;color:white;font-size:9px;text-align:center"';
  function sRow(label,idx){
    return '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px;white-space:nowrap">'+label+'</td>'+
      records.map(function(r){var v=r.vals[idx];if(v===undefined||v===null||v==='')return '<td style="border:1px solid #ccc"></td>';var num=parseFloat(v);var p=PKGS[r.pkg];var col=(p&&!isNaN(num)&&num>=p.min&&num<=p.max)?'#16a34a':'#dc2626';return '<td style="border:1px solid #ccc;text-align:center;font-weight:600;color:'+col+'">'+num.toFixed(3)+'</td>'}).join('')+'</tr>';
  }
  var compCells=records.map(function(r){var col=r.compliance>=80?'#16a34a':'#dc2626';return '<td style="border:1px solid #ccc;text-align:center;font-weight:700;color:'+col+';padding:4px">'+r.compliance+'%</td>'}).join('');
  var h='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:16px}table{font-size:9px}</style></head><body>'+
  '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c8102e;padding-bottom:10px;margin-bottom:12px">'+
    '<div><img src="'+LOGO+'" style="height:48px;object-fit:contain"><br><span style="font-size:8px;color:#777">1931/1935/1945 N 15th Ave, Melrose Park, IL 60160</span></div>'+
    '<div style="text-align:right;font-size:9px;color:#555">SQF # 2.4.D.1.1 LeakPointer H2O Quality Check Log<br>Revision: 01/20/25 | Supersedes: 08/21/24</div>'+
  '</div>'+
  '<div style="font-weight:900;font-size:12px;text-align:center;border:2px solid #111;padding:5px;background:#f0f0f0;margin-bottom:10px">SQF # 2.4.D.1.1: 1945 Weight Monitoring &amp; Leak Pointer H2O Quality Check Log</div>'+
  '<div style="display:flex;gap:20px;margin-bottom:8px;font-size:10px"><span><b>LOT:</b> ___________</span><span><b>DATE:</b> '+dateStr+'</span><span><b>SHIFT:</b> '+shiftVal+'</span><span><b>LINE:</b> '+lineVal+'</span></div>'+
  '<div style="font-size:9px;color:#555;margin-bottom:8px;font-style:italic">FREQUENCY: Beginning and Every hour (+/-5 minutes)</div>'+
  '<div style="font-weight:900;font-size:11px;background:#c8102e;color:white;padding:4px 8px;margin-bottom:4px">WEIGHT LOG</div>'+
  '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead>'+
  '<tr><th '+thr+'>PACKAGE WEIGHT</th>'+records.map(function(r){return '<th '+th+'>'+r.pkgLabel+'</th>'}).join('')+'</tr>'+
  '<tr><th '+thr+'>TIME</th>'+records.map(function(r){return '<th '+th+'>'+(r.time||'—')+'</th>'}).join('')+'</tr>'+
  '</thead><tbody>'+
  sRow('Sample 1',0)+sRow('Sample 2',1)+sRow('Sample 3',2)+sRow('Sample 4',3)+sRow('Sample 5',4)+
  '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px">TOTAL</td>'+records.map(function(r){return '<td style="border:1px solid #ccc;text-align:center;font-weight:600;background:#fafff8">'+r.total+'</td>'}).join('')+'</tr>'+
  '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px">AVERAGE</td>'+records.map(function(r){return '<td style="border:1px solid #ccc;text-align:center;font-weight:600;background:#fafff8">'+parseFloat(r.avg).toFixed(3)+'</td>'}).join('')+'</tr>'+
  '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px">COMPLIANCE</td>'+compCells+'</tr>'+
  '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px">LOT</td>'+records.map(function(r){return '<td style="border:1px solid #ccc;text-align:center">'+(r.lot||'')+'</td>'}).join('')+'</tr>'+
  '<tr><td style="border:1px solid #ccc;font-weight:700;background:#f5f5f5;padding:4px 8px">INITIALS</td>'+records.map(function(r){return '<td style="border:1px solid #ccc;text-align:center">'+(r.initials||'')+'</td>'}).join('')+'</tr>'+
  '</tbody></table>'+
  '<div style="display:flex;gap:10px;margin-bottom:12px">'+
    '<div style="flex:1;border:2px solid #ddd;border-radius:6px;padding:8px;text-align:center"><div style="font-size:22px;font-weight:900">'+tBags+'</div><div style="font-size:8px;color:#888;text-transform:uppercase">Total Bags</div></div>'+
    '<div style="flex:1;border:2px solid #16a34a;border-radius:6px;padding:8px;text-align:center"><div style="font-size:22px;font-weight:900;color:#16a34a">'+tPass+'</div><div style="font-size:8px;color:#888;text-transform:uppercase">In Target</div></div>'+
    '<div style="flex:1;border:2px solid #dc2626;border-radius:6px;padding:8px;text-align:center"><div style="font-size:22px;font-weight:900;color:#dc2626">'+tFail+'</div><div style="font-size:8px;color:#888;text-transform:uppercase">Out of Target</div></div>'+
    '<div style="flex:1;border:2px solid '+compColor+';border-radius:6px;padding:8px;text-align:center"><div style="font-size:22px;font-weight:900;color:'+compColor+'">'+comp+'%</div><div style="font-size:8px;color:#888;text-transform:uppercase">Compliance</div></div>'+
  '</div>'+
  '<div style="font-size:8px;color:#999;border-top:1px solid #ddd;padding-top:8px;display:flex;justify-content:space-between"><span>Caputo Quality Control System</span><span>SQF # 2.4.D.1.1 | Building 1945 | '+dateStr+'</span></div>'+
  '</body></html>';
  var blob=new Blob([h],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},3000);
}

// ===== PDF GMP =====
function exportGmpPDF(){
  var dateVal=gv('gmp-date');
  var location=gv('gmp-loc')||'___';
  var shiftLabel=gmpShift?(gmpShift===1?'1st':'2nd'):'___';
  var dateStr=dateVal?new Date(dateVal+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}):new Date().toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
  var checkRows=GMP_ITEMS.map(function(item,i){
    var val=gmpAnswers[i];
    var yBox=val==='yes'?'&#9745;':'&#9744;';
    var nBox=val==='no'?'&#9745;':'&#9744;';
    var bg=val==='no'?'#fff5f5':val==='yes'?'#f0fff4':'white';
    return '<tr style="background:'+bg+'"><td style="border:1px solid #ccc;padding:5px 8px;font-size:10px">'+item+'</td>'+
      '<td style="border:1px solid #ccc;padding:5px;text-align:center;font-size:14px;width:60px">'+yBox+' Yes</td>'+
      '<td style="border:1px solid #ccc;padding:5px;text-align:center;font-size:14px;width:60px">'+nBox+' No</td></tr>';
  }).join('');
  var h='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:20px}table{width:100%;border-collapse:collapse}th{border:1px solid #999;padding:5px 8px;background:#f0f0f0;font-size:10px;text-align:center}td{border:1px solid #ccc;padding:4px 8px;font-size:10px}</style></head><body>'+
  '<div style="display:flex;justify-content:space-between;font-size:9px;color:#555;margin-bottom:10px"><span>SQF # 2.5.D Internal Audits and Inspections</span><span style="text-decoration:underline">Document: 2.5.D.A Daily GMP Facility Audit</span></div>'+
  '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
    '<div style="display:flex;align-items:center;gap:14px"><img src="'+LOGO+'" style="height:52px;object-fit:contain"><div style="font-size:9px;color:#555;line-height:1.7">1931 N 15th Ave<br>1935 N 15th Ave<br>1945 N 15th Ave<br>Melrose Park, IL.</div></div>'+
    '<div style="font-size:22px;font-weight:900">SQF # 2.5.D.A Daily GMP Facility Audit</div>'+
  '</div>'+
  '<p style="font-size:10px;margin-bottom:10px"><strong><u>Instructions:</u></strong> Evaluate while auditing whether or not the following are acceptable (check yes or no).</p>'+
  '<div style="display:flex;gap:30px;margin:10px 0;font-size:10px;border-bottom:1px solid #ddd;padding-bottom:8px">'+
    '<span><b>Location:</b> <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:100px">&nbsp;'+location+'&nbsp;</span></span>'+
    '<span><b>Date:</b> <span style="border-bottom:1px solid #aaa">&nbsp;'+dateStr+'&nbsp;</span></span>'+
    '<span><b>Shift:</b> <span style="border-bottom:1px solid #aaa">&nbsp;'+shiftLabel+'&nbsp;</span></span>'+
  '</div>'+
  '<table style="margin-bottom:12px"><thead><tr>'+
    '<th style="text-align:left;background:#222;color:white"><i>Check/Inspect</i></th>'+
    '<th style="background:#222;color:white;width:120px" colspan="2"><i>Acceptable</i></th>'+
  '</tr></thead><tbody>'+checkRows+'</tbody></table>'+
  '<div style="background:#222;color:white;font-weight:700;font-size:10px;text-align:center;padding:5px;letter-spacing:1px">1945 TEMPERATURE &amp; % RELATIVE HUMIDITY MONITORING (FREQUENCY: BEGINNING-MIDDLE-END OF THE SHIFT)</div>'+
  '<table style="margin-bottom:12px"><thead><tr>'+
    '<th style="text-align:left;width:35%"></th><th>BEGINNING</th><th>MIDDLE</th><th>END</th>'+
  '</tr></thead><tbody>'+
    '<tr><td style="font-weight:700">TIME</td><td style="text-align:center">'+gv('t-begin-time')+'</td><td style="text-align:center">'+gv('t-mid-time')+'</td><td style="text-align:center">'+gv('t-end-time')+'</td></tr>'+
    '<tr><td style="font-weight:700">TEMPERATURE</td><td style="text-align:center">'+gv('t-begin-temp')+'</td><td style="text-align:center">'+gv('t-mid-temp')+'</td><td style="text-align:center">'+gv('t-end-temp')+'</td></tr>'+
    '<tr><td style="font-weight:700">CHOPPING AREA HUMIDITY</td><td style="text-align:center">'+gv('t-begin-chop')+'</td><td style="text-align:center">'+gv('t-mid-chop')+'</td><td style="text-align:center">'+gv('t-end-chop')+'</td></tr>'+
    '<tr><td style="font-weight:700">UNDER PLATFORM HUMIDITY</td><td style="text-align:center">'+gv('t-begin-plat')+'</td><td style="text-align:center">'+gv('t-mid-plat')+'</td><td style="text-align:center">'+gv('t-end-plat')+'</td></tr>'+
    '<tr><td style="font-weight:700">LINE 6 &amp; GRILLING C. HUMIDITY</td><td style="text-align:center">'+gv('t-begin-line6')+'</td><td style="text-align:center">'+gv('t-mid-line6')+'</td><td style="text-align:center">'+gv('t-end-line6')+'</td></tr>'+
    '<tr><td style="font-weight:700">INITIALS</td><td style="text-align:center">'+gv('t-begin-init')+'</td><td style="text-align:center">'+gv('t-mid-init')+'</td><td style="text-align:center">'+gv('t-end-init')+'</td></tr>'+
  '</tbody></table>'+
  '<div style="border:1px solid #222;padding:5px;text-align:center;font-weight:700;background:#f5f5f5;margin-bottom:4px">Additional Comments/ Notes on Corrections and Corrective Actions</div>'+
  '<div style="border:1px solid #ccc;min-height:50px;padding:8px;margin-bottom:16px">'+gv('gmp-comments')+'</div>'+
  '<div style="margin-top:10px"><div style="border-bottom:1px solid #aaa;padding-bottom:4px;font-size:10px">'+gv('gmp-completed')+'</div>'+
  '<div style="font-style:italic;font-size:10px;color:#555">Completed By: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (print name)</div></div>'+
  '<div style="margin-top:10px"><div style="border-bottom:1px solid #aaa;padding-bottom:4px;font-size:10px">'+gv('gmp-verified')+'</div>'+
  '<div style="font-style:italic;font-size:10px;color:#555">Verified By: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (signature)</div></div>'+
  '<div style="margin-top:14px;display:flex;justify-content:space-between;font-size:9px;color:#555;border-top:1px solid #ddd;padding-top:8px">'+
    '<span><b>Document Approved By:</b> _____________ &nbsp;&nbsp; <b>Date:</b> _____________</span>'+
    '<span>Revision: 10/02/25 &nbsp;&nbsp; Supersedes: 01/03/25</span>'+
  '</div>'+
  '</body></html>';
  var blob=new Blob([h],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},3000);
}



