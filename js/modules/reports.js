// ===== REPORTS =====
var rptFilters = {date: '', line: 'all', shift: 'all'};
var rptWeightResults = [];
var rptSealResults = [];
var rptGmpResults = [];

function initReports() {
  // Set today as default date
  var today = localDateStr();
  document.getElementById('rpt-date').value = today;
  rptFilters.date = today;
  rptFilters.line = 'all';
  rptFilters.shift = 'all';
  rptFilters.product = '';
  document.getElementById('rpt-product').value = '';

  document.getElementById('rpt-line').value = 'all';
  document.getElementById('rpt-shift').value = 'all';

  applyRptFilters();
}

function setRptFilter(btn) {
  var group = btn.getAttribute('data-group');
  var val   = btn.getAttribute('data-val');
  rptFilters[group] = val;
  // Update active state for group
  document.querySelectorAll('[data-group="'+group+'"]').forEach(function(b) {
    b.classList.toggle('active', b === btn);
  });
}

function applyRptFilters() {
  rptFilters.date    = document.getElementById('rpt-date').value;
  rptFilters.product = (document.getElementById('rpt-product').value || '').trim().toLowerCase();
  var db = getDB();

  // Filter weights
  rptWeightResults = db.weights.filter(function(r) {
    var matchDate    = !rptFilters.date    || r.date.startsWith(rptFilters.date);
    var matchLine    = rptFilters.line    === 'all' || String(r.line) === rptFilters.line;
    var matchShift   = rptFilters.shift   === 'all' || String(r.shift) === rptFilters.shift;
    var matchProduct = !rptFilters.product || (r.product||'').toLowerCase().includes(rptFilters.product);
    return matchDate && matchLine && matchShift && matchProduct;
  });

  // Filter seals by same criteria
  rptSealResults = db.seals.filter(function(r) {
    var matchDate    = !rptFilters.date    || r.date.startsWith(rptFilters.date);
    var matchLine    = rptFilters.line    === 'all' || String(r.line) === rptFilters.line;
    var matchShift   = rptFilters.shift   === 'all' || String(r.shift) === rptFilters.shift;
    var matchProduct = !rptFilters.product || (r.product||'').toLowerCase().includes(rptFilters.product);
    return matchDate && matchLine && matchShift && matchProduct;
  });

  // Filter gmps
  rptGmpResults = db.gmps.filter(function(r) {
    var matchDate  = !rptFilters.date  || r.date === rptFilters.date;
    var matchShift = rptFilters.shift === 'all' || String(r.shift) === rptFilters.shift;
    return matchDate && matchShift;
  });

  renderRptWeights();
  renderRptSeals();
  renderRptGmps();
}

function renderRptWeights() {
  var el = document.getElementById('rpt-weight-list');
  if(!rptWeightResults.length) {
    el.innerHTML = '<div class="empty">No weight records for this filter</div>';
    return;
  }
  el.innerHTML = rptWeightResults.map(function(r) {
    var cls = r.compliance >= 80 ? 'hi' : r.compliance >= 60 ? 'mi' : 'lo';
    var dt  = new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    var samples = r.vals.map(function(v){return parseFloat(v).toFixed(3)}).join(' · ');
    return '<div class="rpt-record-card">' +
      '<span class="rc-comp '+cls+'">'+r.compliance+'%</span>' +
      '<div class="rc-title">Line '+r.line+' · '+r.pkgLabel+'</div>' +
      '<div class="rc-meta">'+dt+' · '+(r.shift===1?'1st':'2nd')+' Shift · '+r.time+(r.lot?' · LOT: '+r.lot:'')+(r.product?' · Prod: '+r.product:'')+(r.initials?' · '+r.initials:'')+'</div>' +
      '<div class="rc-samples">'+samples+'</div>' +
      (r.comments ? '<div style="font-size:10px;color:var(--muted);margin-top:4px">📝 '+r.comments+'</div>' : '') +
    '</div>';
  }).join('');
}

function renderRptSeals() {
  var el = document.getElementById('rpt-seal-list');
  if(!el) return;
  if(!rptSealResults.length) {
    el.innerHTML = '<div class="empty">No bag seal records for this filter</div>';
    return;
  }
  el.innerHTML = rptSealResults.map(function(r) {
    var vis   = r.checks['Visual']    || '—';
    var dunk  = r.checks['Dunk Tank'] || '—';
    var print = r.checks['Printing']  || '—';
    var dt = new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    return '<div class="rpt-record-card">' +
      '<div class="rc-title">Bag Seal · Line '+r.line+'</div>' +
      '<div class="rc-meta">'+dt+' · '+(r.shift===1?'1st':'2nd')+' Shift · '+r.time+(r.lot?' · LOT: '+r.lot:'')+(r.product?' · Prod: '+r.product:'')+'</div>' +
      '<div class="rc-samples">' +
        '<span style="color:'+(vis==='pass'?'var(--pass)':'var(--fail)')+'">Visual: '+vis.toUpperCase()+'</span> &nbsp;·&nbsp; ' +
        '<span style="color:'+(dunk==='pass'?'var(--pass)':'var(--fail)')+'">Dunk Tank: '+dunk.toUpperCase()+'</span> &nbsp;·&nbsp; ' +
        '<span style="color:'+(print==='pass'?'var(--pass)':'var(--fail)')+'">Printing: '+print.toUpperCase()+'</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderRptGmps() {
  var el = document.getElementById('rpt-gmp-list');
  if(!rptGmpResults.length) {
    el.innerHTML = '<div class="empty">No GMP records for this filter</div>';
    return;
  }
  el.innerHTML = rptGmpResults.map(function(r) {
    var total = Object.keys(r.answers).length;
    var passed = Object.values(r.answers).filter(function(v){return v==='yes'}).length;
    var failed = Object.values(r.answers).filter(function(v){return v==='no'}).length;
    var dt = r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    return '<div class="rpt-record-card">' +
      '<div class="rc-title">GMP Audit · '+(r.location||'—')+'</div>' +
      '<div class="rc-meta">'+dt+' · '+(r.shift?(r.shift===1?'1st':'2nd')+' Shift':'—')+(r.completedBy?' · '+r.completedBy:'')+'</div>' +
      '<div class="rc-samples" style="color:var(--pass)">✓ '+passed+' passed &nbsp;&nbsp;<span style="color:var(--fail)">✗ '+failed+' failed</span> &nbsp;&nbsp;<span style="color:var(--muted)">'+total+' checked</span></div>' +
      (r.comments ? '<div style="font-size:10px;color:var(--muted);margin-top:4px">📝 '+r.comments+'</div>' : '') +
    '</div>';
  }).join('');
}

function exportRptWeightPDF() {
  if(!rptWeightResults.length && !rptSealResults.length){ toast('No records to export'); return; }

  var dateVal    = rptFilters.date;
  var dateStr    = dateVal ? new Date(dateVal+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : localDateStr();
  var lineLabel  = rptFilters.line  === 'all' ? 'All Lines' : 'Line '+rptFilters.line;
  var shiftLabel = rptFilters.shift === 'all' ? 'All Shifts' : (rptFilters.shift==='1'?'1st':'2nd')+' Shift';
  var productLabel = rptFilters.product || (rptWeightResults[0] && rptWeightResults[0].product) || '—';

  // Summary stats
  var tBags = rptWeightResults.reduce(function(a,r){return a+r.total},0);
  var tPass = rptWeightResults.reduce(function(a,r){return a+r.pass},0);
  var tFail = tBags - tPass;
  var comp  = tBags ? Math.round((tPass/tBags)*100) : 0;
  var compColor = comp >= 80 ? '#2d6a4f' : '#c1121f';
  var compBg    = comp >= 80 ? '#d8f3dc' : '#ffe0e0';

  // ---- PASTEL COLORS ----
  var C = {
    red:    '#c8102e',
    redPastel:  '#fde8ec',
    bluePastel: '#e8f0fe',
    greenPastel:'#d8f3dc',
    yellowPastel:'#fff9e6',
    grayPastel: '#f5f5f7',
    border:     '#dcdce4',
    headerBg:   '#2b2d42',
    passGreen:  '#2d6a4f',
    failRed:    '#c1121f',
    passBg:     '#d8f3dc',
    failBg:     '#ffe0e0',
  };

  // ---- SUMMARY CARDS ----
  var summaryCards =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">' +
      '<div style="background:'+C.grayPastel+';border:1px solid '+C.border+';border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:900;color:'+C.headerBg+'">'+tBags+'</div><div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Total Bags</div></div>' +
      '<div style="background:'+C.greenPastel+';border:1px solid #95d5b2;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:900;color:'+C.passGreen+'">'+tPass+'</div><div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px">In Target</div></div>' +
      '<div style="background:'+C.failBg+';border:1px solid #ffb3b3;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:900;color:'+C.failRed+'">'+tFail+'</div><div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Out of Target</div></div>' +
      '<div style="background:'+compBg+';border:1px solid '+(comp>=80?'#95d5b2':'#ffb3b3')+';border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:900;color:'+compColor+'">'+comp+'%</div><div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Compliance</div></div>' +
    '</div>';

  // ---- WEIGHT RECORDS (vertical cards) ----
  var weightCards = rptWeightResults.map(function(r) {
    var p = PKGS[r.pkg];
    var sampleRows = r.vals.map(function(v,i){
      if(v===undefined||v===null||v==='') return '';
      var num = parseFloat(v);
      var inRange = p && !isNaN(num) && num>=p.min && num<=p.max;
      var col = inRange ? C.passGreen : C.failRed;
      var bg  = inRange ? C.passBg   : C.failBg;
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 10px;background:'+bg+';border-radius:6px;margin-bottom:4px">' +
        '<span style="font-size:10px;color:#555;font-weight:600">Sample '+(i+1)+'</span>' +
        '<span style="font-size:12px;font-weight:800;color:'+col+'">'+num.toFixed(3)+' lbs</span>' +
        '<span style="font-size:10px;font-weight:700;color:'+col+'">'+(inRange?'✓ IN':'✗ OUT')+'</span>' +
      '</div>';
    }).filter(Boolean).join('');

    var rc    = r.compliance>=80 ? C.passGreen : C.failRed;
    var rcBg  = r.compliance>=80 ? C.passBg   : C.failBg;

    return '<div style="background:white;border:1px solid '+C.border+';border-radius:12px;padding:14px;margin-bottom:12px;page-break-inside:avoid">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div>' +
          '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+'">'+r.pkgLabel+' · Line '+r.line+'</div>' +
          '<div style="font-size:10px;color:#888;margin-top:2px">'+r.time+' · '+(r.shift===1?'1st':'2nd')+' Shift'+(r.lot?' · LOT: '+r.lot:'')+(r.product?' · #'+r.product:'')+'</div>' +
          '<div style="font-size:9px;color:#aaa;margin-top:1px">Target: '+p.min+' – '+p.max+' lbs · Avg: '+parseFloat(r.avg).toFixed(3)+' lbs'+(r.initials?' · '+r.initials:'')+'</div>' +
        '</div>' +
        '<div style="background:'+rcBg+';border:1px solid '+(r.compliance>=80?'#95d5b2':'#ffb3b3')+';border-radius:8px;padding:6px 12px;text-align:center">' +
          '<div style="font-size:18px;font-weight:900;color:'+rc+'">'+r.compliance+'%</div>' +
          '<div style="font-size:8px;color:#888">compliance</div>' +
        '</div>' +
      '</div>' +
      sampleRows +
      (r.comments ? '<div style="margin-top:8px;font-size:9px;color:#888;background:'+C.yellowPastel+';border-radius:6px;padding:5px 8px">📝 '+r.comments+'</div>' : '') +
    '</div>';
  }).join('');

  // ---- BAG SEAL RECORDS ----
  var sealCards = rptSealResults.length ? rptSealResults.map(function(r){
    var checks = [
      {label:'Visual',    val:r.checks['Visual']},
      {label:'Dunk Tank', val:r.checks['Dunk Tank']},
      {label:'Printing',  val:r.checks['Printing']}
    ];
    return '<div style="background:white;border:1px solid '+C.border+';border-radius:12px;padding:14px;margin-bottom:12px;page-break-inside:avoid">' +
      '<div style="margin-bottom:10px">' +
        '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+'">Bag Seal · Line '+r.line+'</div>' +
        '<div style="font-size:10px;color:#888;margin-top:2px">'+r.time+' · '+(r.shift===1?'1st':'2nd')+' Shift'+(r.lot?' · LOT: '+r.lot:'')+(r.product?' · #'+r.product:'')+(r.initials?' · '+r.initials:'')+'</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
        checks.map(function(c){
          var pass = c.val === 'pass';
          var fail = c.val === 'fail';
          var bg   = pass ? C.passBg : fail ? C.failBg : C.grayPastel;
          var col  = pass ? C.passGreen : fail ? C.failRed : '#888';
          var icon = pass ? '✓' : fail ? '✗' : '—';
          return '<div style="background:'+bg+';border-radius:8px;padding:10px;text-align:center">' +
            '<div style="font-size:16px;font-weight:900;color:'+col+'">'+icon+'</div>' +
            '<div style="font-size:10px;font-weight:700;color:'+col+'">'+((c.val||'—').toUpperCase())+'</div>' +
            '<div style="font-size:9px;color:#888;margin-top:2px">'+c.label+'</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      (r.comments ? '<div style="margin-top:8px;font-size:9px;color:#888;background:'+C.yellowPastel+';border-radius:6px;padding:5px 8px">📝 '+r.comments+'</div>' : '') +
    '</div>';
  }).join('') : '<div style="background:'+C.grayPastel+';border-radius:10px;padding:14px;text-align:center;color:#aaa;font-size:10px;margin-bottom:12px">No bag seal records for this filter</div>';

  // ---- FULL HTML ----
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<style>' +
    'body{font-family:-apple-system,Arial,sans-serif;font-size:10px;color:#111;padding:20px;margin:0;background:#fafafa}' +
    '@page{size:portrait;margin:12mm}' +
    '@media print{body{background:white}}' +
  '</style></head><body>' +

  // Header
  '<div style="display:flex;justify-content:space-between;align-items:center;background:'+C.headerBg+';color:white;border-radius:12px;padding:14px 18px;margin-bottom:16px">' +
    '<div style="display:flex;align-items:center;gap:14px">' +
      '<img src="data:image/png;base64,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" style="height:44px;object-fit:contain;border-radius:6px;background:white;padding:3px">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:900;letter-spacing:0.02em">Quality Control Report</div>' +
        '<div style="font-size:9px;opacity:0.7;margin-top:2px">SQF # 2.4.D.1.1 · Building 1945</div>' +
      '</div>' +
    '</div>' +
    '<div style="text-align:right;font-size:9px;opacity:0.8;line-height:1.8">' +
      '<div>'+dateStr+'</div>' +
      '<div>'+lineLabel+' · '+shiftLabel+'</div>' +
      (productLabel !== '—' ? '<div>Product #'+productLabel+'</div>' : '') +
    '</div>' +
  '</div>' +

  // Meta info row
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
    '<div style="background:'+C.bluePastel+';border-radius:10px;padding:10px 14px">' +
      '<div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700">Line & Shift</div>' +
      '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+';margin-top:3px">'+lineLabel+' · '+shiftLabel+'</div>' +
    '</div>' +
    '<div style="background:'+C.redPastel+';border-radius:10px;padding:10px 14px">' +
      '<div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700">Date</div>' +
      '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+';margin-top:3px">'+dateStr+'</div>' +
    '</div>' +
    '<div style="background:'+C.yellowPastel+';border-radius:10px;padding:10px 14px">' +
      '<div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700">Product #</div>' +
      '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+';margin-top:3px">'+productLabel+'</div>' +
    '</div>' +
  '</div>' +

  // Summary cards
  summaryCards +

  // Weight section title
  '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
    '<div style="width:4px;height:20px;background:'+C.red+';border-radius:2px"></div>' +
    '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+'">⚖️ Weight Monitoring</div>' +
    '<div style="flex:1;height:1px;background:'+C.border+'"></div>' +
    '<div style="font-size:9px;color:#888">'+rptWeightResults.length+' records</div>' +
  '</div>' +
  (weightCards || '<div style="background:'+C.grayPastel+';border-radius:10px;padding:14px;text-align:center;color:#aaa;font-size:10px;margin-bottom:12px">No weight records for this filter</div>') +

  // Bag seal section title
  '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;margin-top:6px">' +
    '<div style="width:4px;height:20px;background:#0070C0;border-radius:2px"></div>' +
    '<div style="font-size:13px;font-weight:800;color:'+C.headerBg+'">🔍 Bag Seal Monitoring</div>' +
    '<div style="flex:1;height:1px;background:'+C.border+'"></div>' +
    '<div style="font-size:9px;color:#888">'+rptSealResults.length+' records</div>' +
  '</div>' +
  sealCards +

  // Corrective actions
  '<div style="margin-top:10px">' +
    '<div style="font-size:11px;font-weight:800;color:'+C.headerBg+';margin-bottom:6px">📋 Corrective Actions / Notes</div>' +
    '<div style="border:1px solid '+C.border+';border-radius:10px;min-height:60px;padding:10px;background:white;font-size:9px;color:#aaa">Write corrective actions here...</div>' +
  '</div>' +

  // Footer
  '<div style="margin-top:16px;padding-top:10px;border-top:1px solid '+C.border+';display:flex;justify-content:space-between;font-size:8px;color:#aaa">' +
    '<span>SAFETY Quality Control System · Client: Caputo Foods · Building 1945</span>' +
    '<span>SQF # 2.4.D.1.1 · '+dateStr+'</span>' +
  '</div>' +

  '</body></html>';

  var blob = new Blob([h], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.target = '_blank';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}

function exportRptGmpPDF() {
  if(!rptGmpResults.length){ toast('No GMP records to export'); return; }

  var dateStr = rptFilters.date ? new Date(rptFilters.date+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}) : new Date().toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
  var shiftLabel = rptFilters.shift === 'all' ? 'All Shifts' : (rptFilters.shift==='1'?'1st':'2nd')+' Shift';

  var sections = rptGmpResults.map(function(r) {
    var dt = r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    var checkRows = GMP_ITEMS.map(function(item,i){
      var val = r.answers[i];
      var yBox = val==='yes' ? '&#9745;' : '&#9744;';
      var nBox = val==='no'  ? '&#9745;' : '&#9744;';
      var bg   = val==='no' ? '#fff5f5' : val==='yes' ? '#f0fff4' : 'white';
      return '<tr style="background:'+bg+'"><td style="border:1px solid #ccc;padding:4px 8px;font-size:9px">'+item+'</td>'+
        '<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:13px;width:55px">'+yBox+' Yes</td>'+
        '<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:13px;width:55px">'+nBox+' No</td></tr>';
    }).join('');

    var tempSection = '';
    if(r.temp) {
      var t = r.temp;
      tempSection = '<div style="margin-top:10px;font-weight:900;font-size:10px;background:#1a5276;color:white;padding:4px 8px;letter-spacing:1px">1945 TEMPERATURE & % RELATIVE HUMIDITY (BEGINNING · MIDDLE · END)</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr>' +
        '<th style="border:1px solid #999;padding:4px;background:#333;color:white;font-size:9px;text-align:left;width:35%"></th>' +
        '<th style="border:1px solid #999;padding:4px;background:#333;color:white;font-size:9px">BEGINNING</th>' +
        '<th style="border:1px solid #999;padding:4px;background:#333;color:white;font-size:9px">MIDDLE</th>' +
        '<th style="border:1px solid #999;padding:4px;background:#333;color:white;font-size:9px">END</th>' +
      '</tr></thead><tbody>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">TIME</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.time||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.time||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.time||'')+'</td></tr>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">TEMPERATURE</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.temp||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.temp||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.temp||'')+'</td></tr>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">CHOPPING AREA HUM.</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.chop||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.chop||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.chop||'')+'</td></tr>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">UNDER PLATFORM HUM.</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.plat||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.plat||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.plat||'')+'</td></tr>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">LINE 6 & GRILLING HUM.</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.line6||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.line6||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.line6||'')+'</td></tr>' +
        '<tr><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;font-size:9px">INITIALS</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.begin.init||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.mid.init||'')+'</td><td style="border:1px solid #ccc;text-align:center;font-size:9px">'+(t.end.init||'')+'</td></tr>' +
      '</tbody></table>';
    }

    return '<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #ddd;border-radius:6px;padding:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div><strong>GMP Audit</strong> · '+(r.location||'—')+'</div>' +
        '<div style="font-size:9px;color:#555">'+dt+' · '+(r.shift?(r.shift===1?'1st':'2nd')+' Shift':'—')+'</div>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr>' +
        '<th style="text-align:left;background:#222;color:white;padding:4px 8px;font-size:9px"><i>Check/Inspect</i></th>' +
        '<th style="background:#222;color:white;padding:4px;font-size:9px;width:120px" colspan="2"><i>Acceptable</i></th>' +
      '</tr></thead><tbody>'+checkRows+'</tbody></table>' +
      tempSection +
      (r.comments ? '<div style="border:1px solid #ccc;padding:6px;font-size:9px"><b>Comments:</b> '+r.comments+'</div>' : '') +
      '<div style="display:flex;gap:30px;margin-top:8px;font-size:9px">' +
        '<span><b>Completed By:</b> '+(r.completedBy||'_______________')+'</span>' +
        '<span><b>Verified By:</b> '+(r.verifiedBy||'_______________')+'</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // ---- TEMPERATURE & HUMIDITY ----
  var dbLocal = getDB();
  var allTemps = dbLocal.temps || [];
  var matchedTemps = allTemps.filter(function(t){
    return t.date === rptFilters.date && (rptFilters.shift==='all' || String(t.shift)===String(rptFilters.shift));
  });

  var tGet = function(cp, field) {
    var r = matchedTemps.find(function(t){ return t.checkpoint===cp; });
    return r ? (r[field]||'—') : '—';
  };

  var hasSomeTemp = matchedTemps.length > 0;
  var tempRows = '';
  if(hasSomeTemp) {
    var tRow = function(label, b, m, e) {
      return '<tr>' +
        '<td style="border:1px solid #ddd;padding:4px 7px;font-weight:700;font-size:8px">'+label+'</td>' +
        '<td style="border:1px solid #ddd;padding:4px 7px;text-align:center;font-size:8px">'+b+'</td>' +
        '<td style="border:1px solid #ddd;padding:4px 7px;text-align:center;font-size:8px">'+m+'</td>' +
        '<td style="border:1px solid #ddd;padding:4px 7px;text-align:center;font-size:8px">'+e+'</td>' +
      '</tr>';
    };
    var cpLabel = function(cp) {
      var r = matchedTemps.find(function(t){ return t.checkpoint===cp; });
      var base = cp==='begin' ? 'BEGINNING' : cp==='mid' ? 'MIDDLE' : 'END';
      return base + (r&&r.time ? '<br><span style="font-weight:400;font-size:7px">'+r.time+'</span>' : '');
    };
    tempRows =
      '<div style="margin-bottom:12px;page-break-inside:avoid">' +
        '<div style="background:#1a5276;color:white;padding:8px 12px;border-radius:8px 8px 0 0;font-size:10px;font-weight:800;text-transform:uppercase">' +
          '🌡️ Temperature & % Relative Humidity Monitoring — Building 1945' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr>' +
            '<th style="border:1px solid #ddd;padding:5px 8px;background:#2b2d42;color:white;font-size:8px;width:36%">MEASUREMENT</th>' +
            '<th style="border:1px solid #ddd;padding:5px 8px;background:#2b2d42;color:white;font-size:8px;text-align:center">'+cpLabel('begin')+'</th>' +
            '<th style="border:1px solid #ddd;padding:5px 8px;background:#2b2d42;color:white;font-size:8px;text-align:center">'+cpLabel('mid')+'</th>' +
            '<th style="border:1px solid #ddd;padding:5px 8px;background:#2b2d42;color:white;font-size:8px;text-align:center">'+cpLabel('end')+'</th>' +
          '</tr></thead><tbody>' +
            tRow('Temperature (°F)', tGet('begin','temp'), tGet('mid','temp'), tGet('end','temp')) +
            tRow('Chopping Area Humidity (%)', tGet('begin','chop'), tGet('mid','chop'), tGet('end','chop')) +
            tRow('Under Platform Humidity (%)', tGet('begin','plat'), tGet('mid','plat'), tGet('end','plat')) +
            tRow('Line 6 & Grilling Humidity (%)', tGet('begin','line6'), tGet('mid','line6'), tGet('end','line6')) +
            tRow('Completed By', tGet('begin','completedBy'), tGet('mid','completedBy'), tGet('end','completedBy')) +
          '</tbody></table>' +
        (matchedTemps.some(function(t){return t.comments;}) ?
          '<div style="margin-top:5px;font-size:8px;background:#f0f4f8;border-radius:4px;padding:5px 8px">📝 ' +
            matchedTemps.filter(function(t){return t.comments;}).map(function(t){
              return (t.checkpoint==='begin'?'Beginning':t.checkpoint==='mid'?'Middle':'End')+': '+t.comments;
            }).join(' · ') +
          '</div>' : '') +
      '</div>';
  } else {
    tempRows = '<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:10px;margin-bottom:12px;text-align:center;font-size:9px;color:#aaa">No Temperature & Humidity records found for this date/shift</div>';
  }

  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:16px}</style></head><body>' +
  '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c8102e;padding-bottom:10px;margin-bottom:12px">' +
    '<div><img src="data:image/png;base64,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" style="height:48px;object-fit:contain"><br><span style="font-size:8px;color:#777">1931/1935/1945 N 15th Ave, Melrose Park, IL 60160</span></div>' +
    '<div style="text-align:right"><div style="font-size:20px;font-weight:900">GMP Facility Audit Report</div><div style="font-size:9px;color:#555">SQF # 2.5.D.A | Building 1945</div></div>' +
  '</div>' +
  '<div style="display:flex;gap:20px;margin-bottom:14px;font-size:10px;padding-bottom:8px;border-bottom:1px solid #eee">' +
    '<span><b>Date:</b> '+dateStr+'</span>' +
    '<span><b>Filter:</b> '+shiftLabel+'</span>' +
    '<span><b>Records:</b> '+rptGmpResults.length+'</span>' +
  '</div>' +
  sections +
  tempRows +
  '<div style="margin-top:14px;border-top:1px solid #ddd;padding-top:8px;font-size:8px;color:#999;display:flex;justify-content:space-between">' +
    '<span>SAFETY Quality Control System · Client: Caputo Foods</span><span>SQF # 2.5.D.A | Building 1945 | '+dateStr+'</span>' +
  '</div>' +
  '</body></html>';

  var blob = new Blob([h], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.target = '_blank';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}

