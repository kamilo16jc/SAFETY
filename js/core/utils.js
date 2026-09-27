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





// ===== FECHAS DE LOS FILTROS =====
// El campo <input type="date"> se pinta con el formato del NAVEGADOR (aqui
// es dd/mm/aaaa) aunque el resto del sistema muestre las fechas en ingles.
// Ponerle lang="en-US" no sirve: el navegador manda. Asi que se hacen dos
// cosas: se dice en la etiqueta en que orden va, y debajo se repite la fecha
// elegida en letras, para que nadie confunda 09/10 con el 10 de septiembre.
function dateFieldOrder(){
  try{
    return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(new Date())
      .filter(function(p){ return p.type!=='literal'; })
      .map(function(p){ return {day:'dd', month:'mm', year:'yyyy'}[p.type] || ''; })
      .join('/');
  }catch(e){ return 'mm/dd/yyyy'; }
}
function fmtLongDate(iso){
  if(!iso) return '';
  var d = new Date(String(iso).slice(0,10)+'T12:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
// Repite en letras lo que quedo escrito en los campos de fecha
function echoDateRange(outId, fromId, toId){
  var el = document.getElementById(outId);
  if(!el) return;
  var a = fmtLongDate((document.getElementById(fromId)||{}).value);
  var b = toId ? fmtLongDate((document.getElementById(toId)||{}).value) : '';
  var txt = '';
  if(!toId)        txt = a;                       // un solo dia: se repite y ya
  else if(a && b)  txt = a + '  →  ' + b;
  else if(a)       txt = 'From ' + a;
  else if(b)       txt = 'Up to ' + b;
  el.textContent = txt;
  el.style.display = txt ? 'block' : 'none';
}
// Escribe el orden real del navegador en las etiquetas marcadas
function showDateOrder(root){
  var o = dateFieldOrder();
  (root||document).querySelectorAll('[data-dateorder]').forEach(function(el){ el.textContent = o; });
}
