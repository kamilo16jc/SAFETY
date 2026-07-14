// ===== DATE HELPERS =====
function localDateStr() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth()+1).padStart(2,'0');
  var d = String(now.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
}
function localISOStr() {
  // Returns ISO string but using LOCAL date (not UTC)
  var now = new Date();
  var y   = now.getFullYear();
  var mo  = String(now.getMonth()+1).padStart(2,'0');
  var d   = String(now.getDate()).padStart(2,'0');
  var h   = String(now.getHours()).padStart(2,'0');
  var mi  = String(now.getMinutes()).padStart(2,'0');
  var s   = String(now.getSeconds()).padStart(2,'0');
  return y+'-'+mo+'-'+d+'T'+h+':'+mi+':'+s;
}

// ===== SYNC UI =====
function showSyncStatus(msg) {
  var el = document.getElementById('sync-status');
  if(el){ el.textContent = msg; el.style.display = 'block'; }
}
function hideSyncStatus() {
  var el = document.getElementById('sync-status');
  if(el) el.style.display = 'none';
}



