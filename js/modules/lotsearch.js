// ===== LOT SEARCH =====
function runLotSearch() {
  var lot = (document.getElementById('lot-search-input').value || '').trim().toUpperCase();
  if(!lot) { toast('Enter a LOT number'); return; }
  var db = getDB();
  var results = [];

  // Search weights
  var weights = (db.weights||[]).filter(function(w){ return (w.lot||'').toUpperCase().includes(lot); });
  if(weights.length) {
    results.push('<div style="font-size:12px;font-weight:900;color:var(--text);margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.05em">⚖️ Weight Records ('+weights.length+')</div>');
    weights.forEach(function(w) {
      var dt = w.date ? new Date(w.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      var ok = w.compliance === 'PASS' || w.compliance === 'pass';
      results.push('<div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid '+(ok?'#16a34a':'#dc2626')+';border-radius:10px;padding:10px 14px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:700">'+w.product+' — '+w.packageSize+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">LOT: '+w.lot+' · Line '+(w.line||'?')+' · '+w.shift+' shift · '+dt+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">Avg: '+(w.avg||'—')+' · By: '+(w.initials||'—')+'</div>'+
        '<div style="font-size:10px;font-weight:700;color:'+(ok?'#16a34a':'#dc2626')+'">'+(ok?'✅ PASS':'❌ FAIL')+'</div>'+
      '</div>');
    });
  }

  // Search seals
  var seals = (db.seals||[]).filter(function(s){ return (s.lot||'').toUpperCase().includes(lot); });
  if(seals.length) {
    results.push('<div style="font-size:12px;font-weight:900;color:var(--text);margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.05em">🧪 Bag Seal Records ('+seals.length+')</div>');
    seals.forEach(function(s) {
      var dt = s.date ? new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      results.push('<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:700">'+s.product+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">LOT: '+s.lot+' · Line '+(s.line||'?')+' · '+s.shift+' · '+dt+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">Visual: '+(s.visual||'—')+' · Dunk: '+(s.dunk||'—')+' · Print: '+(s.printing||'—')+'</div>'+
      '</div>');
    });
  }

  // Search holds
  var holds = (db.holds||[]).filter(function(h){ return (h.lot||'').toUpperCase().includes(lot); });
  if(holds.length) {
    results.push('<div style="font-size:12px;font-weight:900;color:var(--text);margin:12px 0 6px;text-transform:uppercase;letter-spacing:0.05em">🔒 Hold Cases ('+holds.length+')</div>');
    holds.forEach(function(h) {
      var s = {hold:'#c1121f',review:'#b45309',released:'#2d6a4f',destroyed:'#6b7280'}[h.status]||'#c1121f';
      var dt = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      results.push('<div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid '+s+';border-radius:10px;padding:10px 14px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:700">'+h.caseNumber+' — '+h.product+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">LOT: '+h.lot+' · Qty: '+h.quantity+' · '+dt+'</div>'+
        '<div style="font-size:10px;font-weight:700;color:'+s+'">'+h.status.toUpperCase()+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">'+h.reason+'</div>'+
      '</div>');
    });
  }

  var el = document.getElementById('lot-search-results');
  if(!results.length) {
    el.innerHTML = '<div class="empty">No records found for LOT: '+lot+'</div>';
  } else {
    var total = weights.length + seals.length + holds.length;
    el.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'+
      '<div style="font-size:13px;font-weight:800">LOT: '+lot+'</div>'+
      '<div style="font-size:11px;color:var(--muted)">'+total+' records found</div>'+
    '</div>' + results.join('');
  }
}

