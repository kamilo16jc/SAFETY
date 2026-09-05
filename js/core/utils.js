// ===== SEGURIDAD: escape de HTML =====
// Todo texto que venga de un usuario (nombres de producto, comentarios, LOT,
// razones de hold, etc.) debe pasar por esc() antes de ir a innerHTML. Sin
// esto, un operador podía guardar <img onerror=...> en un campo y ejecutar
// código en la sesión de quien abriera esa pantalla (XSS almacenado).
function esc(v){
  if(v==null) return '';
  return String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Igual que esc pero conservando un guion largo cuando el valor está vacío
function escDash(v){ return (v==null || v==='') ? '—' : esc(v); }

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
// Combina una fecha (YYYY-MM-DD) y una hora (HH:MM) en un ISO local.
// Si la fecha es hoy, conserva los segundos actuales; si no, usa 00.
// Permite ingresar registros retroactivos (datos que estaban en papel).
function isoFromDateTime(dateStr, timeStr) {
  if(!dateStr) return localISOStr();
  var t = (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) ? timeStr : '12:00';
  var parts = t.split(':');
  var hh = String(parts[0]).padStart(2,'0');
  var mm = String(parts[1]).padStart(2,'0');
  var ss = (dateStr === localDateStr())
    ? String(new Date().getSeconds()).padStart(2,'0') : '00';
  return dateStr + 'T' + hh + ':' + mm + ':' + ss;
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



