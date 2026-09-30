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


// ===== LO QUE SE MIRA CUANDO NADIE HA FILTRADO =====
// Las casillas de fecha abren vacias, y vacio NO significa "traelo todo":
// significa HOY. Sacar semanas de historial que nadie pidio llena la pantalla
// de ruido y, si hay que ir a buscarlo, cuesta lecturas.
// Lo unico que se salva del corte es lo que sigue pendiente: una placa sin
// leer o una muestra sin enviar no pueden desaparecer por ser de antier.
function inScope(fecha, from, to, pendiente){
  var d = String(fecha||'').slice(0,10);
  if(!d) return false;
  if(!from && !to) return d === localDateStr() || !!pendiente;
  if(from && d < from) return false;
  if(to   && d > to)   return false;
  return true;
}

// ===== GUARDAR UNA FILA =====
// Las celdas de las hojas se guardan al salir del campo, pero eso no se ve.
// El boton de la fila hace lo mismo a la vista, y se queda un momento en
// "Saved" para que quede claro que ya esta.
function flashSaved(btn, label){
  if(!btn) return;
  var prev = btn.getAttribute('data-prev') || btn.textContent;
  btn.setAttribute('data-prev', prev);
  btn.classList.add('ok');
  btn.textContent = label || '\u2713 Saved';
  clearTimeout(btn._flash);
  btn._flash = setTimeout(function(){
    btn.classList.remove('ok');
    btn.textContent = btn.getAttribute('data-prev') || 'Save';
  }, 1800);
}

// Lee los campos marcados con data-f dentro de una fila
function readRowFields(btn){
  var tr = btn && btn.closest ? btn.closest('tr') : null;
  if(!tr) return null;
  var out = {};
  tr.querySelectorAll('[data-f]').forEach(function(el){
    out[el.getAttribute('data-f')] = el.value;
  });
  return out;
}
