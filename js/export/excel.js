// Rango objetivo legible para los export ('not set' si el producto no lo tiene)
function targetLabel(r){ var t=recTarget(r); return t ? t.min+' - '+t.max : 'not set'; }

// ===== EXCEL EXPORTS =====

function exportDashExcel() {
  var db   = getDB();
  var w    = filterByDays(db.weights).filter(function(r){ return !r.issue; });  // issues fuera del Dashboard
  var gmps = filterByDays(db.gmps);
  var seals = filterByDays(db.seals);
  var periodLabel = dashDays ? 'Last '+dashDays+' days' : 'All Time';

  var wb = XLSX.utils.book_new();

  // ---- SHEET 1: All Weight Records ----
  var wHeaders = ['Date','Time','Line','Shift','Package','Target Range','Product #','Description','Bags/Case','LOT',
                  'Sample 1','Sample 2','Sample 3','Sample 4','Sample 5',
                  'Average','Total','In Target','Compliance %','Initials','Comments'];
  var wRows = w.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.pkgLabel, targetLabel(r), r.product||'',
      (r.issue && WEIGHT_ISSUES[r.issue] ? WEIGHT_ISSUES[r.issue].label : (r.productName||'')),
      r.bagsPerCase||'', r.lot||'',
      r.vals[0]||'', r.vals[1]||'', r.vals[2]||'', r.vals[3]||'', r.vals[4]||'',
      (r.avg!=null?parseFloat(r.avg).toFixed(3):''), (r.issue?'':r.total), (r.pass==null?'—':r.pass), compLabel(r.compliance),
      r.initials||'', r.comments||''
    ];
  });
  var wsW = XLSX.utils.aoa_to_sheet([wHeaders].concat(wRows));
  wsW['!cols'] = wHeaders.map(function(h,i){ return {wch: i===7?22:i<10?12:i<16?10:14}; });
  XLSX.utils.book_append_sheet(wb, wsW, 'Weight Records');

  // ---- SHEET 2: All Bag Seal Records ----
  var sHeaders = ['Date','Time','Line','Shift','Product #','Description','Bags/Case','LOT','Visual','Dunk Tank','Printing','Initials','Comments'];
  var sRows = seals.map(function(r){
    var dt = r.date ? new Date(r.date).toLocaleDateString('en-US') : '';
    return [
      dt, r.time||'', 'Line '+r.line, (r.shift===1?'1st':'2nd')+' Shift',
      r.product||'', r.productName||'', r.bagsPerCase||'', r.lot||'',
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
    ['NEXORA QUALITY CONTROL - DASHBOARD SUMMARY'],['Client: Caputo Foods'],
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

  var dateLabel = localDateStr();
  XLSX.writeFile(wb, 'Caputo_Dashboard_'+periodLabel.replace(' ','_')+'_'+dateLabel+'.xlsx');
  toast('Dashboard Excel exported');
}

