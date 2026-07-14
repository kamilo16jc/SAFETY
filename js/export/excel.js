// ===== EXCEL EXPORTS =====

function exportRptExcel() {
  if(!rptWeightResults.length && !rptSealResults.length){ toast('No records to export'); return; }

  var wb = XLSX.utils.book_new();

  // ---- SHEET 1: Weight Records ----
  var wHeaders = ['Date','Time','Line','Shift','Package','Product #','LOT',
                  'Sample 1','Sample 2','Sample 3','Sample 4','Sample 5',
                  'Average','Total Samples','In Target','Compliance %','Initials','Comments'];
  var wRows = rptWeightResults.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.pkgLabel, r.product||'', r.lot||'',
      r.vals[0]||'', r.vals[1]||'', r.vals[2]||'', r.vals[3]||'', r.vals[4]||'',
      parseFloat(r.avg).toFixed(3), r.total, r.pass, r.compliance+'%',
      r.initials||'', r.comments||''
    ];
  });
  var wsW = XLSX.utils.aoa_to_sheet([wHeaders].concat(wRows));

  // Style header row width
  wsW['!cols'] = [
    {wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:12},
    {wch:10},{wch:10},{wch:10},{wch:10},{wch:10},
    {wch:10},{wch:12},{wch:10},{wch:12},{wch:10},{wch:20}
  ];
  XLSX.utils.book_append_sheet(wb, wsW, 'Weight Records');

  // ---- SHEET 2: Bag Seal Records ----
  var sHeaders = ['Date','Time','Line','Shift','Product #','LOT','Visual','Dunk Tank','Printing','Initials','Comments'];
  var sRows = rptSealResults.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.product||'', r.lot||'',
      (r.checks['Visual']||'—').toUpperCase(),
      (r.checks['Dunk Tank']||'—').toUpperCase(),
      (r.checks['Printing']||'—').toUpperCase(),
      r.initials||'', r.comments||''
    ];
  });
  var wsS = XLSX.utils.aoa_to_sheet([sHeaders].concat(sRows));
  wsS['!cols'] = [{wch:12},{wch:8},{wch:8},{wch:10},{wch:12},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsS, 'Bag Seal Records');

  // ---- SHEET 3: Summary ----
  var tBags = rptWeightResults.reduce(function(a,r){return a+r.total},0);
  var tPass = rptWeightResults.reduce(function(a,r){return a+r.pass},0);
  var tFail = tBags - tPass;
  var comp  = tBags ? Math.round((tPass/tBags)*100) : 0;

  var summaryData = [
    ['SAFETY QUALITY CONTROL - REPORT SUMMARY'],['Client: Caputo Foods'],
    ['Generated:', new Date().toLocaleDateString('en-US')],
    ['Filter Date:', rptFilters.date || 'All'],
    ['Line:', rptFilters.line === 'all' ? 'All Lines' : 'Line '+rptFilters.line],
    ['Shift:', rptFilters.shift === 'all' ? 'All Shifts' : (rptFilters.shift==='1'?'1st':'2nd')+' Shift'],
    [],
    ['WEIGHT MONITORING'],
    ['Total Bags Checked:', tBags],
    ['Bags In Target:', tPass],
    ['Bags Out of Target:', tFail],
    ['Overall Compliance:', comp+'%'],
    [],
    ['BAG SEAL MONITORING'],
    ['Total Seal Checks:', rptSealResults.length],
    ['Visual Pass:', rptSealResults.filter(function(r){return r.checks['Visual']==='pass'}).length],
    ['Dunk Tank Pass:', rptSealResults.filter(function(r){return r.checks['Dunk Tank']==='pass'}).length],
    ['Printing Pass:', rptSealResults.filter(function(r){return r.checks['Printing']==='pass'}).length],
  ];
  var wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{wch:25},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Download
  var dateLabel = rptFilters.date || new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, 'Caputo_Weight_Seal_'+dateLabel+'.xlsx');
  toast('Excel exported! ✓');
}

function exportGmpExcel() {
  if(!rptGmpResults.length){ toast('No GMP records to export'); return; }

  var wb = XLSX.utils.book_new();

  // ---- SHEET 1: GMP Checklist ----
  var gmpHeaders = ['Date','Location','Shift','Completed By','Verified By'].concat(GMP_ITEMS).concat(['Comments']);
  var gmpRows = rptGmpResults.map(function(r){
    var dt = r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-US') : '';
    var base = [dt, r.location||'', (r.shift?(r.shift===1?'1st':'2nd')+' Shift':''), r.completedBy||'', r.verifiedBy||''];
    var items = GMP_ITEMS.map(function(item,i){ return (r.answers[i]||'—').toUpperCase(); });
    return base.concat(items).concat([r.comments||'']);
  });
  var wsG = XLSX.utils.aoa_to_sheet([gmpHeaders].concat(gmpRows));
  wsG['!cols'] = [{wch:12},{wch:15},{wch:10},{wch:15},{wch:15}].concat(GMP_ITEMS.map(function(){return {wch:8}})).concat([{wch:20}]);
  XLSX.utils.book_append_sheet(wb, wsG, 'GMP Checklist');

  // ---- SHEET 2: Temperature & Humidity ----
  var tHeaders = ['Date','Location','Shift',
    'Begin Time','Begin Temp (°F)','Begin Chop Hum','Begin Platform Hum','Begin Line6 Hum','Begin Initials',
    'Mid Time','Mid Temp (°F)','Mid Chop Hum','Mid Platform Hum','Mid Line6 Hum','Mid Initials',
    'End Time','End Temp (°F)','End Chop Hum','End Platform Hum','End Line6 Hum','End Initials'];
  var tRows = rptGmpResults.map(function(r){
    var dt = r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-US') : '';
    var t = r.temp || {begin:{},mid:{},end:{}};
    return [
      dt, r.location||'', (r.shift?(r.shift===1?'1st':'2nd')+' Shift':''),
      t.begin.time||'', t.begin.temp||'', t.begin.chop||'', t.begin.plat||'', t.begin.line6||'', t.begin.init||'',
      t.mid.time||'',   t.mid.temp||'',   t.mid.chop||'',   t.mid.plat||'',   t.mid.line6||'',   t.mid.init||'',
      t.end.time||'',   t.end.temp||'',   t.end.chop||'',   t.end.plat||'',   t.end.line6||'',   t.end.init||''
    ];
  });
  var wsT = XLSX.utils.aoa_to_sheet([tHeaders].concat(tRows));
  wsT['!cols'] = tHeaders.map(function(){return {wch:14}});
  XLSX.utils.book_append_sheet(wb, wsT, 'Temperature & Humidity');

  var dateLabel = rptFilters.date || new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, 'Caputo_GMP_'+dateLabel+'.xlsx');
  toast('GMP Excel exported! ✓');
}

function exportDashExcel() {
  var db   = getDB();
  var w    = filterByDays(db.weights);
  var gmps = filterByDays(db.gmps);
  var seals = filterByDays(db.seals);
  var periodLabel = dashDays ? 'Last '+dashDays+' days' : 'All Time';

  var wb = XLSX.utils.book_new();

  // ---- SHEET 1: All Weight Records ----
  var wHeaders = ['Date','Time','Line','Shift','Package','Product #','LOT',
                  'Sample 1','Sample 2','Sample 3','Sample 4','Sample 5',
                  'Average','Total','In Target','Compliance %','Initials','Comments'];
  var wRows = w.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.pkgLabel, r.product||'', r.lot||'',
      r.vals[0]||'', r.vals[1]||'', r.vals[2]||'', r.vals[3]||'', r.vals[4]||'',
      parseFloat(r.avg).toFixed(3), r.total, r.pass, r.compliance+'%',
      r.initials||'', r.comments||''
    ];
  });
  var wsW = XLSX.utils.aoa_to_sheet([wHeaders].concat(wRows));
  wsW['!cols'] = wHeaders.map(function(h,i){ return {wch: i<7?12:i<13?10:14}; });
  XLSX.utils.book_append_sheet(wb, wsW, 'Weight Records');

  // ---- SHEET 2: All Bag Seal Records ----
  var sHeaders = ['Date','Time','Line','Shift','Product #','LOT','Visual','Dunk Tank','Printing','Initials','Comments'];
  var sRows = seals.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.product||'', r.lot||'',
      (r.checks['Visual']||'—').toUpperCase(),
      (r.checks['Dunk Tank']||'—').toUpperCase(),
      (r.checks['Printing']||'—').toUpperCase(),
      r.initials||'', r.comments||''
    ];
  });
  var wsS = XLSX.utils.aoa_to_sheet([sHeaders].concat(sRows));
  wsS['!cols'] = sHeaders.map(function(){return {wch:12}});
  XLSX.utils.book_append_sheet(wb, wsS, 'Bag Seal Records');

  // ---- SHEET 3: All GMP Records ----
  var gHeaders = ['Date','Location','Shift','GMP Compliance %','Items Failed','Completed By','Comments'];
  var gRows = gmps.map(function(r){
    var dt = r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-US') : '';
    var failed = Object.values(r.answers).filter(function(v){return v==='no'}).length;
    var total  = Object.keys(r.answers).length;
    var gcomp  = total ? Math.round(((total-failed)/total)*100) : 0;
    return [dt, r.location||'', (r.shift?(r.shift===1?'1st':'2nd')+' Shift':''), gcomp+'%', failed, r.completedBy||'', r.comments||''];
  });
  var wsG = XLSX.utils.aoa_to_sheet([gHeaders].concat(gRows));
  wsG['!cols'] = [{wch:12},{wch:15},{wch:10},{wch:16},{wch:12},{wch:15},{wch:25}];
  XLSX.utils.book_append_sheet(wb, wsG, 'GMP Records');

  // ---- SHEET 4: Dashboard Summary ----
  var tBags = w.reduce(function(a,r){return a+r.total},0);
  var tPass = w.reduce(function(a,r){return a+r.pass},0);
  var tFail = tBags - tPass;
  var comp  = tBags ? Math.round((tPass/tBags)*100) : 0;

  // Line breakdown
  var lineData = {};
  w.forEach(function(r){
    var k='Line '+r.line;
    if(!lineData[k]) lineData[k]={pass:0,total:0};
    lineData[k].pass+=r.pass; lineData[k].total+=r.total;
  });

  // Package breakdown
  var pkgData = {};
  w.forEach(function(r){
    var k=r.pkgLabel;
    if(!pkgData[k]) pkgData[k]={fail:0,total:0};
    pkgData[k].fail+=(r.total-r.pass); pkgData[k].total+=r.total;
  });

  // GMP failures
  var itemFails={};
  gmps.forEach(function(r){
    Object.keys(r.answers).forEach(function(i){
      if(r.answers[i]==='no'){
        var label=GMP_ITEMS[parseInt(i)]||('Item '+i);
        itemFails[label]=(itemFails[label]||0)+1;
      }
    });
  });

  var summaryData = [
    ['SAFETY QUALITY CONTROL - DASHBOARD SUMMARY'],['Client: Caputo Foods'],
    ['Generated:', new Date().toLocaleDateString('en-US')],
    ['Period:', periodLabel],
    [],
    ['=== WEIGHT MONITORING ==='],
    ['Total Bags Checked', tBags],
    ['Bags In Target', tPass],
    ['Bags Out of Target', tFail],
    ['Overall Compliance', comp+'%'],
    ['Total Weight Records', w.length],
    [],
    ['=== COMPLIANCE BY LINE ==='],
    ['Line','In Target','Out of Target','Compliance %']
  ];

  Object.keys(lineData).sort().forEach(function(k){
    var d = lineData[k];
    var pct = d.total ? Math.round((d.pass/d.total)*100) : 0;
    summaryData.push([k, d.pass, d.total-d.pass, pct+'%']);
  });

  summaryData.push([]);
  summaryData.push(['=== FAILURES BY PACKAGE ===']);
  summaryData.push(['Package','Failures','Fail Rate %']);
  Object.keys(pkgData).sort(function(a,b){return pkgData[b].fail-pkgData[a].fail}).forEach(function(k){
    var d = pkgData[k];
    var pct = d.total ? Math.round((d.fail/d.total)*100) : 0;
    summaryData.push([k, d.fail, pct+'%']);
  });

  summaryData.push([]);
  summaryData.push(['=== GMP SUMMARY ===']);
  summaryData.push(['Total Audits', gmps.length]);
  summaryData.push(['Items Failed', Object.values(itemFails).reduce(function(a,b){return a+b},0)]);

  summaryData.push([]);
  summaryData.push(['=== TOP GMP FAILURES ===']);
  summaryData.push(['GMP Item','Times Failed']);
  Object.keys(itemFails).sort(function(a,b){return itemFails[b]-itemFails[a]}).slice(0,10).forEach(function(item){
    summaryData.push([item, itemFails[item]]);
  });

  var wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{wch:35},{wch:20},{wch:20},{wch:15}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Dashboard Summary');

  var dateLabel = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, 'Caputo_Dashboard_'+periodLabel.replace(' ','_')+'_'+dateLabel+'.xlsx');
  toast('Dashboard Excel exported! ✓');
}

