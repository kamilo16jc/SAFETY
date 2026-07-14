// ===== HOLD MANAGEMENT =====
var holdActiveFilter = 'all';
var holdClosedFilter = 'all';
var currentHoldCase  = null;
var newHoldStatus    = null;

function getHolds() {
  var db = getDB();
  if(!db.holds) db.holds = [];
  return db.holds;
}

function saveHoldsDB(holds) {
  var db = getDB();
  db.holds = holds;
  saveDB(db);
  if(window.saveHoldsToFirebase) window.saveHoldsToFirebase(holds);
}

function getNextHoldNumber() {
  var holds = getHolds();
  if(!holds.length) return 'HLD-001';
  var nums = holds.map(function(h){
    var n = parseInt((h.caseNumber||'HLD-000').split('-')[1]);
    return isNaN(n) ? 0 : n;
  });
  return 'HLD-' + String(Math.max.apply(null,nums)+1).padStart(3,'0');
}

var HSC = {
  hold:     {bg:'#ffe0e0',border:'#ffb3b3',text:'#c1121f',icon:'🔒'},
  review:   {bg:'#fff9e6',border:'#fde68a',text:'#b45309',icon:'🔍'},
  released: {bg:'#d8f3dc',border:'#95d5b2',text:'#2d6a4f',icon:'✅'},
  destroyed:{bg:'#f3f4f6',border:'#d1d5db',text:'#6b7280',icon:'🗑️'}
};

function statusBadge(status) {
  var s = HSC[status] || HSC.hold;
  return '<span style="background:'+s.bg+';border:1px solid '+s.border+';color:'+s.text+';border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">'+s.icon+' '+status+'</span>';
}

function initHold() {
  holdActiveFilter = 'all';
  holdClosedFilter = 'all';
  switchHoldTab('active', document.getElementById('hold-tab-active'));
  if(currentUser) document.getElementById('hold-initby').value = currentUser.name;
}

function switchHoldTab(tab, btn) {
  document.querySelectorAll('[id^="hold-tab-"]').forEach(function(b){ b.classList.remove('selected'); });
  if(btn) btn.classList.add('selected');
  document.getElementById('hold-view-active').style.display  = tab==='active'  ? 'block' : 'none';
  document.getElementById('hold-view-closed').style.display  = tab==='closed'  ? 'block' : 'none';
  document.getElementById('hold-view-new').style.display     = tab==='new'     ? 'block' : 'none';
  document.getElementById('hold-view-all').style.display     = tab==='all'     ? 'block' : 'none';
  if(tab==='active')  renderHoldActive();
  if(tab==='closed')  renderHoldClosed();
  if(tab==='all')     renderHoldAll();
}

function selectHoldLine(btn) {
  // Toggle selection
  var isActive = btn.classList.contains('active');
  document.querySelectorAll('[data-group="hline"]').forEach(function(b){ b.classList.remove('active'); });
  if(!isActive) btn.classList.add('active');
}

function setHoldActiveFilter(btn) {
  holdActiveFilter = btn.getAttribute('data-val');
  document.querySelectorAll('[data-group="hactive"]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  renderHoldActive();
}

function setHoldClosedFilter(btn) {
  holdClosedFilter = btn.getAttribute('data-val');
  document.querySelectorAll('[data-group="hclosed"]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  renderHoldClosed();
}

function holdCard(h, showReleaseCert) {
  var s = HSC[h.status] || HSC.hold;
  var dt = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  var certBtn = '';
  if(showReleaseCert && h.status==='released') {
    certBtn = '<button data-certid="'+h.id+'" data-certtype="release" style="background:#d8f3dc;border:1px solid #95d5b2;color:#2d6a4f;border-radius:8px;padding:5px 10px;font-family:Raleway,sans-serif;font-size:10px;font-weight:700;cursor:pointer;margin-top:6px">📜 Release Certificate</button>';
  } else if(showReleaseCert && h.status==='destroyed') {
    certBtn = '<button data-certid="'+h.id+'" data-certtype="destroy" style="background:#ffe0e0;border:1px solid #ffb3b3;color:#c1121f;border-radius:8px;padding:5px 10px;font-family:Raleway,sans-serif;font-size:10px;font-weight:700;cursor:pointer;margin-top:6px">🗑️ Destruction Certificate</button>';
  }
  return '<div data-holdid="'+h.id+'" style="background:var(--surface);border:1px solid '+s.border+';border-left:4px solid '+s.text+';border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div style="font-size:13px;font-weight:800">'+h.caseNumber+'</div>' +
      statusBadge(h.status) +
    '</div>' +
    '<div style="font-size:14px;font-weight:700;margin-bottom:3px">'+h.product+'</div>' +
    '<div style="font-size:11px;color:var(--muted)">LOT: '+(h.lot||'—')+' · Qty: '+h.quantity+(h.line?' · Line '+h.line:'')+'</div>' +
    '<div style="font-size:10px;color:var(--muted);margin-top:3px">'+dt+' · '+h.initiatedBy+'</div>' +
    certBtn +
  '</div>';
}

function attachHoldEvents(containerId) {
  var el = document.getElementById(containerId);
  if(!el) return;
  el.onclick = function(e) {
    // Release / Destroy cert button
    var certBtn = e.target.closest('[data-certid]');
    if(certBtn) {
      e.stopPropagation();
      if(certBtn.getAttribute('data-certtype')==='destroy') exportDestroyCert(certBtn.getAttribute('data-certid'));
      else exportReleaseCert(certBtn.getAttribute('data-certid'));
      return;
    }
    // Card click
    var card = e.target.closest('[data-holdid]');
    if(card) openHoldModal(card.getAttribute('data-holdid'));
  };
}

function renderHoldActive() {
  var holds = getHolds().filter(function(h){
    var isActive = h.status==='hold' || h.status==='review';
    var matchFilter = holdActiveFilter==='all' || h.status===holdActiveFilter;
    return isActive && matchFilter;
  }).sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });

  var el = document.getElementById('hold-active-list');
  el.innerHTML = holds.length ? holds.map(function(h){return holdCard(h,false);}).join('') :
    '<div class="empty">No active cases 🎉</div>';
  attachHoldEvents('hold-active-list');
}

function renderHoldClosed() {
  var holds = getHolds().filter(function(h){
    var isClosed = h.status==='released' || h.status==='destroyed';
    var matchFilter = holdClosedFilter==='all' || h.status===holdClosedFilter;
    return isClosed && matchFilter;
  }).sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });

  var el = document.getElementById('hold-closed-list');
  el.innerHTML = holds.length ? holds.map(function(h){return holdCard(h,true);}).join('') :
    '<div class="empty">No closed cases yet</div>';
  attachHoldEvents('hold-closed-list');
}

function renderHoldAll() {
  var holds = getHolds().sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
  var el = document.getElementById('hold-all-list');
  el.innerHTML = holds.length ? holds.map(function(h){return holdCard(h,true);}).join('') :
    '<div class="empty">No cases yet</div>';
  attachHoldEvents('hold-all-list');
}

function saveHoldCase() {
  var product = document.getElementById('hold-product').value.trim();
  var lot     = document.getElementById('hold-lot').value.trim();
  var qty     = document.getElementById('hold-qty').value.trim();
  var reason  = document.getElementById('hold-reason').value.trim();
  var initby  = document.getElementById('hold-initby').value.trim();
  var line    = '';
  var activeLineBtn = document.querySelector('[data-group="hline"].active');
  if(activeLineBtn) line = activeLineBtn.getAttribute('data-val');

  if(!product){ toast('Enter product name'); return; }
  if(!qty)    { toast('Enter quantity'); return; }
  if(!reason) { toast('Enter reason for hold'); return; }

  var now = localISOStr();
  var newCase = {
    id:          Date.now(),
    caseNumber:  getNextHoldNumber(),
    product:     product,
    lot:         lot,
    quantity:    qty,
    line:        line,
    reason:      reason,
    initiatedBy: initby || (currentUser ? currentUser.name : '—'),
    status:      'hold',
    createdAt:   now,
    history:     [{date:now, status:'hold', comment:'Product placed on hold. Reason: '+reason, by: initby||(currentUser?currentUser.name:'—')}]
  };

  var holds = getHolds();
  holds.push(newCase);
  saveHoldsDB(holds);
  if(window.saveToFirebase) window.saveToFirebase('holds', newCase);

  document.getElementById('hold-product').value = '';
  document.getElementById('hold-lot').value     = '';
  document.getElementById('hold-qty').value     = '';
  document.getElementById('hold-reason').value  = '';
  document.querySelectorAll('[data-group="hline"]').forEach(function(b){b.classList.remove('active');});

  toast(newCase.caseNumber + ' created! 🔒');
  logActivity('hold','Hold case created',newCase.caseNumber+' — '+product+' · LOT: '+(lot||'—')+' · '+reason, newCase.initiatedBy);
  notifySupervisorOfHold(newCase.caseNumber, product, lot, reason);
  switchHoldTab('active', document.getElementById('hold-tab-active'));
}

function openHoldModal(id) {
  var holds = getHolds();
  currentHoldCase = holds.find(function(h){ return String(h.id)===String(id); });
  if(!currentHoldCase) return;
  newHoldStatus = currentHoldCase.status;
  document.getElementById('hold-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-case-number').textContent = currentHoldCase.caseNumber + ' — ' + currentHoldCase.product;
  document.getElementById('modal-comment').value = '';
  document.querySelectorAll('[data-newstatus]').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-newstatus')===currentHoldCase.status);
  });
  renderModalDetail();
  renderModalHistory();
}

function renderModalDetail() {
  var h = currentHoldCase;
  var s = HSC[h.status] || HSC.hold;
  var dt = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—';
  document.getElementById('modal-case-detail').innerHTML =
    '<div style="background:'+s.bg+';border:1px solid '+s.border+';border-radius:12px;padding:14px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<div style="font-size:16px;font-weight:800">'+h.product+'</div>'+
        statusBadge(h.status)+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">' +
        '<div><span style="color:var(--muted);font-weight:700">LOT: </span>'+(h.lot||'—')+'</div>' +
        '<div><span style="color:var(--muted);font-weight:700">QTY: </span>'+h.quantity+'</div>' +
        '<div><span style="color:var(--muted);font-weight:700">LINE: </span>'+(h.line?'Line '+h.line:'—')+'</div>' +
        '<div><span style="color:var(--muted);font-weight:700">DATE: </span>'+dt+'</div>' +
        '<div style="grid-column:span 2"><span style="color:var(--muted);font-weight:700">BY: </span>'+h.initiatedBy+'</div>' +
        '<div style="grid-column:span 2"><span style="color:var(--muted);font-weight:700">REASON: </span>'+h.reason+'</div>' +
      '</div>' +
    '</div>';
}

function renderModalHistory() {
  var history = (currentHoldCase.history||[]).slice().reverse();
  document.getElementById('modal-history').innerHTML = history.map(function(e){
    var s = HSC[e.status] || HSC.hold;
    var dt = e.date ? new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return '<div style="border-left:3px solid '+s.text+';padding:8px 12px;margin-bottom:8px;background:'+s.bg+';border-radius:0 8px 8px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'+
        statusBadge(e.status)+'<span style="font-size:9px;color:var(--muted)">'+dt+'</span>'+
      '</div>'+
      '<div style="font-size:11px;margin-top:4px">'+e.comment+'</div>'+
      '<div style="font-size:10px;color:var(--muted);margin-top:2px">By: '+e.by+'</div>'+
    '</div>';
  }).join('');
}

function setNewStatus(btn) {
  newHoldStatus = btn.getAttribute('data-newstatus');
  document.querySelectorAll('[data-newstatus]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function updateHoldStatus() {
  var comment = document.getElementById('modal-comment').value.trim();
  if(!comment){ toast('Comment is required'); return; }
  if(!newHoldStatus){ toast('Select a status'); return; }

  var holds = getHolds();
  var idx = holds.findIndex(function(h){ return String(h.id)===String(currentHoldCase.id); });
  if(idx<0) return;

  var now = localISOStr();
  holds[idx].status = newHoldStatus;
  holds[idx].history.push({date:now, status:newHoldStatus, comment:comment, by:currentUser?currentUser.name:'—'});
  saveHoldsDB(holds);
  currentHoldCase = holds[idx];

  document.getElementById('modal-comment').value = '';
  renderModalDetail();
  renderModalHistory();

  // If released or destroyed → auto move to closed tab after closing modal
  var wasClosed = (newHoldStatus==='released' || newHoldStatus==='destroyed');
  var savedCase = holds[idx]; // save reference BEFORE closing modal
  toast('Status → ' + newHoldStatus.toUpperCase() + ' ✓');
  logActivity('hold','Hold status updated',savedCase.caseNumber+' → '+newHoldStatus.toUpperCase()+' · '+comment, currentUser?currentUser.name:'—');

  if(wasClosed) {
    setTimeout(function(){
      closeHoldModal();
      if(newHoldStatus==='released') {
        if(confirm(savedCase.caseNumber+' has been RELEASED.\nGenerate Release Certificate?')) {
          exportReleaseCert(savedCase.id);
        }
      }
      switchHoldTab('closed', document.getElementById('hold-tab-closed'));
    }, 500);
  }
}

function closeHoldModal() {
  document.getElementById('hold-modal').style.display = 'none';
  document.body.style.overflow = '';
  currentHoldCase = null;
}

// ===== RELEASE CERTIFICATE =====
function exportReleaseCert(id) {
  var holds = getHolds();
  var h = holds.find(function(x){ return String(x.id)===String(id); });
  if(!h){ toast('Case not found'); return; }
  if(h.status !== 'released'){ toast('Product not released yet'); return; }

  var certDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  var openDate = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : '—';

  // Find release entry
  var releaseEntry = (h.history||[]).slice().reverse().find(function(e){return e.status==='released';});
  var releaseDate  = releaseEntry ? new Date(releaseEntry.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : certDate;
  var releaseBy    = releaseEntry ? releaseEntry.by : '—';
  var releaseComment = releaseEntry ? releaseEntry.comment : '—';

  // Build full history table
  var historyRows = (h.history||[]).map(function(e){
    var s = HSC[e.status] || HSC.hold;
    var dt = e.date ? new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return '<tr style="background:'+s.bg+'">'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px;font-weight:700;color:'+s.text+'">'+s.icon+' '+e.status.toUpperCase()+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+dt+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+e.comment+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+e.by+'</td>'+
    '</tr>';
  }).join('');

  var doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+
    'body{font-family:Arial,sans-serif;font-size:9px;color:#111;padding:14px;margin:0;background:white}'+
    '@page{size:portrait;margin:8mm}'+
    '@media print{body{padding:0}}'+
    'table{width:100%;border-collapse:collapse}'+
    'th{border:1px solid #ddd;padding:4px 7px;background:#2b2d42;color:white;font-size:8px;text-align:left}'+
    'td{border:1px solid #ddd;padding:4px 7px;font-size:8px}'+
  '</style></head><body>'+

  // Header with logo
  '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2d6a4f;padding-bottom:14px;margin-bottom:20px">'+
    '<div style="display:flex;align-items:center;gap:14px">'+
      '<img src="data:image/png;base64,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" style="height:50px;object-fit:contain">'+
      '<div>'+
        '<div style="font-size:9px;color:#888">1931/1935/1945 N 15th Ave, Melrose Park, IL 60160</div>'+
        '<div style="font-size:9px;color:#888">Building 1945</div>'+
      '</div>'+
    '</div>'+
    '<div style="text-align:right">'+
      '<div style="font-size:10px;color:#888">Certificate #: '+h.caseNumber+'-REL</div>'+
      '<div style="font-size:10px;color:#888">Date: '+certDate+'</div>'+
    '</div>'+
  '</div>'+

  // Certificate Title
  '<div style="text-align:center;margin-bottom:24px">'+
    '<div style="background:#d8f3dc;border:2px solid #2d6a4f;border-radius:12px;padding:16px;display:inline-block;min-width:300px">'+
      '<div style="font-size:22px;font-weight:900;color:#2d6a4f;letter-spacing:0.05em">✅ PRODUCT RELEASE CERTIFICATE</div>'+
      '<div style="font-size:11px;color:#2d6a4f;margin-top:4px;font-weight:700">CAPUTO CHEESE · QUALITY CONTROL DEPARTMENT</div>'+
    '</div>'+
  '</div>'+

  // Product details
  '<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#2b2d42;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">Product Information</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:10px">'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Product</div>'+
        '<div style="font-size:14px;font-weight:800;color:#2b2d42">'+h.product+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Case Number</div>'+
        '<div style="font-size:14px;font-weight:800;color:#c8102e">'+h.caseNumber+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">LOT Number</div>'+
        '<div style="font-size:13px;font-weight:700">'+( h.lot||'—')+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Quantity</div>'+
        '<div style="font-size:13px;font-weight:700">'+h.quantity+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Line</div>'+
        '<div style="font-size:13px;font-weight:700">'+(h.line?'Line '+h.line:'—')+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Hold Initiated By</div>'+
        '<div style="font-size:13px;font-weight:700">'+h.initiatedBy+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="background:white;border:1px solid #ffe0e0;border-radius:8px;padding:10px;margin-top:10px">'+
      '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Original Reason for Hold</div>'+
      '<div style="font-size:11px;color:#c1121f;font-weight:600">'+h.reason+'</div>'+
    '</div>'+
  '</div>'+

  // Release info
  '<div style="background:#d8f3dc;border:1px solid #95d5b2;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#2d6a4f;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">✅ Release Information</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:10px">'+
      '<div><div style="font-size:8px;color:#2d6a4f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Hold Date</div><div style="font-weight:700">'+openDate+'</div></div>'+
      '<div><div style="font-size:8px;color:#2d6a4f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Release Date</div><div style="font-weight:700">'+releaseDate+'</div></div>'+
      '<div><div style="font-size:8px;color:#2d6a4f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Released By</div><div style="font-weight:700">'+releaseBy+'</div></div>'+
      '<div><div style="font-size:8px;color:#2d6a4f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Certificate Date</div><div style="font-weight:700">'+certDate+'</div></div>'+
    '</div>'+
    '<div style="margin-top:10px"><div style="font-size:8px;color:#2d6a4f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Release Comments</div><div style="font-size:11px;font-weight:600">'+releaseComment+'</div></div>'+
  '</div>'+

  // Full history
  '<div style="margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#2b2d42;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">Complete Case History</div>'+
    '<table><thead><tr>'+
      '<th>Status</th><th>Date & Time</th><th>Comment</th><th>By</th>'+
    '</tr></thead><tbody>'+historyRows+'</tbody></table>'+
  '</div>'+

  // Signature area
  '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:11px;font-weight:900;color:#2b2d42;margin-bottom:16px">Authorization Signatures</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">'+
      '<div style="border-top:1px solid #2b2d42;padding-top:6px">'+
        '<div style="font-size:9px;color:#888">Quality Control Supervisor</div>'+
        '<div style="height:30px"></div>'+
        '<div style="font-size:9px;color:#888">Name &amp; Date</div>'+
      '</div>'+
      '<div style="border-top:1px solid #2b2d42;padding-top:6px">'+
        '<div style="font-size:9px;color:#888">Production Manager</div>'+
        '<div style="height:30px"></div>'+
        '<div style="font-size:9px;color:#888">Name &amp; Date</div>'+
      '</div>'+
    '</div>'+
  '</div>'+

  // Footer
  '<div style="border-top:2px solid #2d6a4f;padding-top:10px;display:flex;justify-content:space-between;font-size:8px;color:#888">'+
    '<span>SAFETY Quality Control System · Client: Caputo Foods · Building 1945 · SQF Certified</span>'+
    '<span>'+h.caseNumber+'-REL · Generated: '+certDate+'</span>'+
  '</div>'+

  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.target = '_blank';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}

function exportDestroyCert(id) {
  var holds = getHolds();
  var h = holds.find(function(x){ return String(x.id)===String(id); });
  if(!h){ toast('Case not found'); return; }
  if(h.status !== 'destroyed'){ toast('Product not destroyed yet'); return; }

  var certDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  var openDate = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : '—';

  // Find release entry
  var releaseEntry = (h.history||[]).slice().reverse().find(function(e){return e.status==='released';});
  var releaseDate  = releaseEntry ? new Date(releaseEntry.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : certDate;
  var releaseBy    = releaseEntry ? releaseEntry.by : '—';
  var releaseComment = releaseEntry ? releaseEntry.comment : '—';

  // Build full history table
  var historyRows = (h.history||[]).map(function(e){
    var s = HSC[e.status] || HSC.hold;
    var dt = e.date ? new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return '<tr style="background:'+s.bg+'">'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px;font-weight:700;color:'+s.text+'">'+s.icon+' '+e.status.toUpperCase()+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+dt+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+e.comment+'</td>'+
      '<td style="border:1px solid #ddd;padding:6px 10px;font-size:9px">'+e.by+'</td>'+
    '</tr>';
  }).join('');

  var doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+
    'body{font-family:Arial,sans-serif;font-size:9px;color:#111;padding:14px;margin:0;background:white}'+
    '@page{size:portrait;margin:8mm}'+
    '@media print{body{padding:0}}'+
    'table{width:100%;border-collapse:collapse}'+
    'th{border:1px solid #ddd;padding:4px 7px;background:#2b2d42;color:white;font-size:8px;text-align:left}'+
    'td{border:1px solid #ddd;padding:4px 7px;font-size:8px}'+
  '</style></head><body>'+

  // Header with logo
  '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c1121f;padding-bottom:14px;margin-bottom:20px">'+
    '<div style="display:flex;align-items:center;gap:14px">'+
      '<img src="data:image/png;base64,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" style="height:50px;object-fit:contain">'+
      '<div>'+
        '<div style="font-size:9px;color:#888">1931/1935/1945 N 15th Ave, Melrose Park, IL 60160</div>'+
        '<div style="font-size:9px;color:#888">Building 1945</div>'+
      '</div>'+
    '</div>'+
    '<div style="text-align:right">'+
      '<div style="font-size:10px;color:#888">Certificate #: '+h.caseNumber+'-REL</div>'+
      '<div style="font-size:10px;color:#888">Date: '+certDate+'</div>'+
    '</div>'+
  '</div>'+

  // Certificate Title
  '<div style="text-align:center;margin-bottom:24px">'+
    '<div style="background:#ffe0e0;border:2px solid #c1121f;border-radius:12px;padding:16px;display:inline-block;min-width:300px">'+
      '<div style="font-size:22px;font-weight:900;color:#c1121f;letter-spacing:0.05em">🗑️ PRODUCT DESTRUCTION CERTIFICATE</div>'+
      '<div style="font-size:11px;color:#c1121f;margin-top:4px;font-weight:700">CAPUTO CHEESE · QUALITY CONTROL DEPARTMENT</div>'+
    '</div>'+
  '</div>'+

  // Product details
  '<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#2b2d42;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">Product Information</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:10px">'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Product</div>'+
        '<div style="font-size:14px;font-weight:800;color:#2b2d42">'+h.product+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Case Number</div>'+
        '<div style="font-size:14px;font-weight:800;color:#c8102e">'+h.caseNumber+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">LOT Number</div>'+
        '<div style="font-size:13px;font-weight:700">'+( h.lot||'—')+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Quantity</div>'+
        '<div style="font-size:13px;font-weight:700">'+h.quantity+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Line</div>'+
        '<div style="font-size:13px;font-weight:700">'+(h.line?'Line '+h.line:'—')+'</div>'+
      '</div>'+
      '<div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:10px">'+
        '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Hold Initiated By</div>'+
        '<div style="font-size:13px;font-weight:700">'+h.initiatedBy+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="background:white;border:1px solid #ffe0e0;border-radius:8px;padding:10px;margin-top:10px">'+
      '<div style="font-size:8px;color:#888;text-transform:uppercase;font-weight:700;margin-bottom:3px">Original Reason for Hold</div>'+
      '<div style="font-size:11px;color:#c1121f;font-weight:600">'+h.reason+'</div>'+
    '</div>'+
  '</div>'+

  // Release info
  '<div style="background:#ffe0e0;border:1px solid #ffb3b3;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#c1121f;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">✅ Release Information</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:10px">'+
      '<div><div style="font-size:8px;color:#c1121f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Hold Date</div><div style="font-weight:700">'+openDate+'</div></div>'+
      '<div><div style="font-size:8px;color:#c1121f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Destruction Date</div><div style="font-weight:700">'+releaseDate+'</div></div>'+
      '<div><div style="font-size:8px;color:#c1121f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Destroyed By</div><div style="font-weight:700">'+releaseBy+'</div></div>'+
      '<div><div style="font-size:8px;color:#c1121f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Certificate Date</div><div style="font-weight:700">'+certDate+'</div></div>'+
    '</div>'+
    '<div style="margin-top:10px"><div style="font-size:8px;color:#c1121f;text-transform:uppercase;font-weight:700;margin-bottom:2px">Destruction Reasons</div><div style="font-size:11px;font-weight:600">'+releaseComment+'</div></div>'+
  '</div>'+

  // Full history
  '<div style="margin-bottom:18px">'+
    '<div style="font-size:12px;font-weight:900;color:#2b2d42;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">Complete Case History</div>'+
    '<table><thead><tr>'+
      '<th>Status</th><th>Date & Time</th><th>Comment</th><th>By</th>'+
    '</tr></thead><tbody>'+historyRows+'</tbody></table>'+
  '</div>'+

  // Signature area
  '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:18px">'+
    '<div style="font-size:11px;font-weight:900;color:#2b2d42;margin-bottom:16px">Authorization Signatures</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">'+
      '<div style="border-top:1px solid #2b2d42;padding-top:6px">'+
        '<div style="font-size:9px;color:#888">Quality Control Supervisor</div>'+
        '<div style="height:30px"></div>'+
        '<div style="font-size:9px;color:#888">Name &amp; Date</div>'+
      '</div>'+
      '<div style="border-top:1px solid #2b2d42;padding-top:6px">'+
        '<div style="font-size:9px;color:#888">Production Manager</div>'+
        '<div style="height:30px"></div>'+
        '<div style="font-size:9px;color:#888">Name &amp; Date</div>'+
      '</div>'+
    '</div>'+
  '</div>'+

  // Footer
  '<div style="border-top:2px solid #c1121f;padding-top:10px;display:flex;justify-content:space-between;font-size:8px;color:#888">'+
    '<span>SAFETY Quality Control System · Client: Caputo Foods · Building 1945 · SQF Certified</span>'+
    '<span>'+h.caseNumber+'-REL · Generated: '+certDate+'</span>'+
  '</div>'+

  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.target = '_blank';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}

// ===== HOLD EXPORTS (Excel & PDF list) =====
function exportHoldExcel() {
  var holds = getHolds();
  if(!holds.length){ toast('No hold cases to export'); return; }
  var wb = XLSX.utils.book_new();
  var headers = ['Case #','Product','LOT','Quantity','Line','Reason','Status','Initiated By','Created Date'];
  var rows = holds.map(function(h){
    return [h.caseNumber,h.product,h.lot||'',h.quantity,h.line?'Line '+h.line:'',h.reason,h.status.toUpperCase(),h.initiatedBy,
      h.createdAt?new Date(h.createdAt).toLocaleDateString('en-US'):''];
  });
  var ws1 = XLSX.utils.aoa_to_sheet([headers].concat(rows));
  ws1['!cols'] = [{wch:10},{wch:20},{wch:12},{wch:15},{wch:8},{wch:30},{wch:12},{wch:15},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Hold Cases');

  var hHeaders = ['Case #','Product','Date','Status','Comment','By'];
  var hRows = [];
  holds.forEach(function(h){
    (h.history||[]).forEach(function(e){
      hRows.push([h.caseNumber,h.product,e.date?new Date(e.date).toLocaleDateString('en-US'):'',e.status.toUpperCase(),e.comment,e.by]);
    });
  });
  var ws2 = XLSX.utils.aoa_to_sheet([hHeaders].concat(hRows));
  ws2['!cols'] = [{wch:10},{wch:20},{wch:14},{wch:12},{wch:40},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Status History');

  XLSX.writeFile(wb, 'Caputo_HoldLog_'+new Date().toISOString().split('T')[0]+'.xlsx');
  toast('Excel exported! ✓');
}

function exportHoldPDF() {
  var holds = getHolds();
  if(!holds.length){ toast('No hold cases to export'); return; }
  holds.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });

  var dateStr = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  var counts = {hold:0,review:0,released:0,destroyed:0};
  holds.forEach(function(h){ if(counts[h.status]!==undefined) counts[h.status]++; });

  var cards = holds.map(function(h){
    var s = HSC[h.status]||HSC.hold;
    var dt = h.createdAt?new Date(h.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
    var lastEntry = (h.history||[]).slice(-1)[0]||{};
    return '<div style="border:1px solid '+s.border+';border-left:5px solid '+s.text+';border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<div style="font-size:13px;font-weight:900;color:#2b2d42">'+h.caseNumber+' — '+h.product+'</div>'+
        '<div style="background:'+s.bg+';color:'+s.text+';border:1px solid '+s.border+';border-radius:16px;padding:3px 10px;font-size:9px;font-weight:700">'+s.icon+' '+h.status.toUpperCase()+'</div>'+
      '</div>'+
      '<div style="font-size:9px;color:#666">LOT: '+(h.lot||'—')+' · Qty: '+h.quantity+(h.line?' · Line '+h.line:'')+' · '+dt+' · By: '+h.initiatedBy+'</div>'+
      '<div style="font-size:9px;color:#444;margin-top:4px;font-style:italic">'+h.reason+'</div>'+
      (lastEntry.status&&lastEntry.status!=='hold'?'<div style="font-size:9px;color:'+s.text+';margin-top:4px;font-weight:600">Latest: '+lastEntry.comment+' ('+lastEntry.by+')</div>':'')+
    '</div>';
  }).join('');

  var doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:10px;padding:20px;background:white}@page{size:portrait;margin:12mm}</style></head><body>'+
  '<div style="background:#2b2d42;color:white;border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">'+
    '<div style="display:flex;align-items:center;gap:12px">'+
      '<img src="data:image/png;base64,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" style="height:42px;object-fit:contain;background:white;border-radius:5px;padding:3px">'+
      '<div><div style="font-size:14px;font-weight:900">Products on Hold Report</div><div style="font-size:9px;opacity:0.7">SAFETY Quality Control · Caputo Foods · Building 1945</div></div>'+
    '</div>'+
    '<div style="font-size:9px;opacity:0.8">'+dateStr+'</div>'+
  '</div>'+
  '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">'+
    '<div style="background:#ffe0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:#c1121f">'+counts.hold+'</div><div style="font-size:8px;color:#888">ON HOLD</div></div>'+
    '<div style="background:#fff9e6;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:#b45309">'+counts.review+'</div><div style="font-size:8px;color:#888">UNDER REVIEW</div></div>'+
    '<div style="background:#d8f3dc;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:#2d6a4f">'+counts.released+'</div><div style="font-size:8px;color:#888">RELEASED</div></div>'+
    '<div style="background:#f3f4f6;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:#6b7280">'+counts.destroyed+'</div><div style="font-size:8px;color:#888">DESTROYED</div></div>'+
  '</div>'+
  cards+
  '<div style="margin-top:12px;border-top:1px solid #ddd;padding-top:8px;font-size:8px;color:#aaa;display:flex;justify-content:space-between">'+
    '<span>SAFETY Quality Control System · Client: Caputo Foods · Building 1945</span><span>Generated: '+dateStr+'</span>'+
  '</div></body></html>';

  var blob=new Blob([doc],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.target='_blank'; a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},3000);
}

