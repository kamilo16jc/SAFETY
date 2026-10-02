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


// ===== MAS OPCIONES =====
// Un solo boton redondo por hoja. Dentro va lo de segunda fila —exportar,
// generar la forma, copiar otro dia—, que antes ocupaba su sitio en la barra
// aunque casi nunca se use. Con raton se abre al pasar por encima (lo hace el
// CSS); con el dedo, al tocarlo, que es lo que hace esto.
function moreHTML(items, etiqueta, opts){
  opts = opts || {};
  var rotulo = etiqueta || 'More options';
  // Cuando ademas de abrir hay que enseñar lo elegido, el boton se alarga y
  // lleva el rotulo delante de los tres puntos.
  var cara = (opts.label != null)
    ? '<span class="more-face"'+(opts.faceId ? ' id="'+opts.faceId+'"' : '')+'>'+opts.label+'</span>'+
      '<span data-icon="more"></span>'
    : '<span data-icon="more"></span>';
  return '<div class="more-box'+(opts.wrapId ? '" id="'+opts.wrapId : '')+'" data-open="false">'+
    '<button class="more-btn'+(opts.label != null ? ' more-btn-wide' : '')+'" type="button" '+
      'aria-haspopup="true" aria-expanded="false" title="'+rotulo+'" aria-label="'+rotulo+'" '+
      'onclick="moreToggle(this)">'+cara+'</button>'+
    '<div class="more-menu" role="menu"'+(opts.menuId ? ' id="'+opts.menuId+'"' : '')+'>'+
      items.map(function(i){
        return '<button class="more-item'+(i.on ? ' selected' : '')+'" type="button" role="menuitem"'+
          (i.attrs ? ' '+i.attrs : '')+' onclick="moreRun(this,'+i.fn+')">'+
          '<span data-icon="'+i.icon+'"></span>'+i.text+'</button>';
      }).join('')+
    '</div></div>';
}
function moreCloseAll(){
  var abiertos = document.querySelectorAll('.more-box[data-open="true"]');
  Array.prototype.forEach.call(abiertos, function(b){
    b.setAttribute('data-open','false');
    var t = b.querySelector('.more-btn');
    if(t) t.setAttribute('aria-expanded','false');
  });
}
function moreToggle(btn){
  var caja = btn.parentNode;
  var abierto = caja.getAttribute('data-open') === 'true';
  moreCloseAll();
  if(!abierto){
    caja.setAttribute('data-open','true');
    btn.setAttribute('aria-expanded','true');
  }
}
function moreRun(el, fn){
  moreCloseAll();
  if(typeof fn === 'function') fn();
}
document.addEventListener('click', function(e){
  var d = e.target;
  while(d && d !== document){
    if(d.classList && d.classList.contains('more-box')) return;
    d = d.parentNode;
  }
  moreCloseAll();
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') moreCloseAll(); });

// ===== TARJETA DE CONTEO =====
// La misma en todas las pantallas: el rotulo arriba, la cifra abajo, el dibujo
// de fondo y el color solo cuando hay algo que contar — una tarjeta roja con un
// cero no avisa de nada. Si lleva accion sale como boton; si no, como bloque.
//   kpiCard(3, 'pending', {tono:'bad', icono:'alert', click:"setRawView('pending')"})
function kpiCard(n, rotulo, o){
  o = o || {};
  var hay  = !!(typeof n === 'number' ? n : parseFloat(n));
  var tono = (o.tono && hay) ? o.tono : '';
  // El dibujo vive en su propio cuadro a la izquierda; al lado, el rotulo
  // pequeño y la cifra debajo. El color sigue diciendo estado y sigue sin ir
  // solo: tiñe la cifra, que es lo que se lee.
  var ico = o.icono
    ? '<span class="kpi-box"><span class="kpi-ico" data-icon="' + o.icono + '"></span></span>'
    : '';
  var delta = o.delta
    ? '<span class="kpi-delta kpi-d-' + (o.deltaTono || 'ok') + '">' + o.delta + '</span>'
    : '';
  var dentro = ico +
    '<span class="kpi-txt">' +
      '<span class="kpi-lbl">' + rotulo + '</span>' +
      '<span class="kpi-val"><b>' + n + '</b>' + delta + '</span>' +
      (o.note ? '<span class="kpi-note">' + o.note + '</span>' : '') +
    '</span>';
  var cls = 'class="kpi' + (tono ? ' kpi-' + tono : '') + (o.on ? ' on' : '') + '"';
  return o.click
    ? '<button type="button" ' + cls + ' onclick="' + o.click + '">' + dentro + '</button>'
    : '<div ' + cls + '>' + dentro + '</div>';
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
// ===== BOTON DE GUARDAR =====
// Dos caras apiladas dentro del mismo boton: la azul dice "Save" y, cuando ya
// quedo guardado, sube la verde con "Saved". El movimiento lo dispara el
// codigo —no el raton—, que es lo que hace que signifique algo.
//   saveBtn("saveAnRow("+a.id+",this)")           -> en una fila de hoja
//   saveBtn("saveCatalogEdits(this)", {texto:'Save changes', grande:true})
function saveBtn(onclick, o){
  o = o || {};
  return '<button type="button" class="btn-save'+(o.grande?' lg':'')+'" '+
    'onclick="'+onclick+'">'+
    '<div><span><p>'+(o.texto || 'Save')+'</p></span></div>'+
    '<div><span><p>'+(o.hecho || 'Saved')+'</p></span></div>'+
  '</button>';
}

function flashSaved(btn, label){
  if(!btn) return;
  // El boton de dos caras no cambia de texto: sube la verde y vuelve sola
  var caja = btn.classList && btn.classList.contains('btn-save') ? btn
           : (btn.closest ? btn.closest('.btn-save') : null);
  if(caja){
    caja.classList.add('done');
    clearTimeout(caja._flash);
    caja._flash = setTimeout(function(){ caja.classList.remove('done'); }, 1800);
    return;
  }
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
