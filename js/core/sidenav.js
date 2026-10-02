// ===== LA BARRA LATERAL (solo escritorio) =====
// La cinta ponia las 36 funciones a la vista de una vez. Para una herramienta
// de oficina eso es ruido: a la izquierda solo van los MODULOS, y el que se
// abre despliega sus funciones debajo. Un nivel a la vista, el resto plegado.
//
// No inventa nada: los modulos y sus funciones salen de la misma tabla de
// siempre, y los grupos de RIBBON_GROUPS siguen sirviendo de subtitulo. Por eso
// respeta los roles sin una linea extra: lo que moduleItemsFor no devuelve, no
// se dibuja.
//
// En el telefono no existe. Ahi manda la pantalla, no el raton.

var SNAV_MIN = 1024;
var snavOpen = null;          // modulo desplegado

function snavActivo(){
  return document.body.classList.contains('ui-fluent') &&
         window.innerWidth >= SNAV_MIN;
}

function renderSideNav(){
  var host = document.getElementById('snav');
  if(!host) return;
  if(!snavActivo() || !currentUser){ host.innerHTML = ''; return; }

  var mods = (typeof myModules === 'function') ? myModules() : [];
  if(!mods.length){ host.innerHTML = ''; return; }

  // Se abre en el modulo de la pantalla en la que ya estas, no en el primero.
  // Cadena vacia = el usuario lo plego a proposito, y eso se respeta: solo se
  // elige uno cuando todavia no se ha decidido nada (null).
  if(snavOpen == null || (snavOpen && !mods.some(function(m){ return m.id === snavOpen; }))){
    var actual = (typeof moduleOfScreen === 'function')
      ? moduleOfScreen((document.querySelector('.screen.active')||{}).id) : null;
    snavOpen = (actual && mods.some(function(m){ return m.id === actual; }))
      ? actual
      : (activeModule && mods.some(function(m){ return m.id === activeModule; })
          ? activeModule : mods[0].id);
  }

  host.innerHTML =
    '<div class="snav-list">'+
      mods.map(snavModHTML).join('')+
    '</div>'+
    '<div class="snav-foot">'+
      '<span class="snav-cap">Hoy</span>'+
      '<strong>'+esc(snavFecha())+'</strong>'+
      '<span class="snav-cap">'+esc(snavPie())+'</span>'+
    '</div>';
  renderIcons(host);
  snavHighlight((document.querySelector('.screen.active')||{}).id);
}

function snavModHTML(m){
  var abierto = (m.id === snavOpen);
  return '<div class="snav-mod'+(abierto ? ' open' : '')+'" data-mod="'+m.id+'">'+
    '<button class="snav-head" type="button" aria-expanded="'+abierto+'" '+
      'onclick="snavToggle(\''+m.id+'\')">'+
      '<span class="snav-ico" data-icon="'+m.icon+'"></span>'+
      '<span class="snav-name">'+esc(m.name)+'</span>'+
      '<span class="snav-chev" aria-hidden="true"></span>'+
    '</button>'+
    (abierto ? '<div class="snav-sub">'+snavSubHTML(m)+'</div>' : '')+
  '</div>';
}

// Las funciones del modulo, con los mismos grupos que usaba la cinta. Lo que no
// este en ningun grupo cae al final: añadir una pantalla nunca la deja fuera.
function snavSubHTML(m){
  var permitidas = (typeof moduleItemsFor === 'function') ? moduleItemsFor(m) : m.items;
  var porPantalla = {};
  permitidas.forEach(function(i){ porPantalla[i.screen] = i; });

  var grupos = (typeof RIBBON_GROUPS !== 'undefined' && RIBBON_GROUPS[m.id])
    ? RIBBON_GROUPS[m.id]
    : [{n:'', s:permitidas.map(function(i){ return i.screen; })}];

  var usadas = {};
  var html = grupos.map(function(g){
    var items = g.s.filter(function(s){ return porPantalla[s]; }).map(function(s){
      usadas[s] = 1;
      return snavItemHTML(porPantalla[s], m);
    }).join('');
    if(!items) return '';
    return (g.n ? '<div class="snav-gname">'+esc(g.n)+'</div>' : '') + items;
  }).join('');

  var sueltas = permitidas.filter(function(i){ return !usadas[i.screen]; });
  if(sueltas.length){
    html += '<div class="snav-gname">Más</div>'+
      sueltas.map(function(i){ return snavItemHTML(i, m); }).join('');
  }
  return html;
}

function snavItemHTML(item, m){
  if(item.soon){
    return '<span class="snav-item soon" title="En preparación">'+esc(item.name)+'</span>';
  }
  return '<button class="snav-item" type="button" data-screen="'+item.screen+'" '+
    'onclick="snavGo(\''+m.id+'\',\''+item.screen+'\')">'+esc(item.name)+'</button>';
}

// Abrir un modulo NO navega: solo despliega sus funciones, como la cinta
// cambiaba de pestaña sin moverte de pantalla. Volver a pulsarlo lo pliega.
function snavToggle(modId){
  snavOpen = (snavOpen === modId) ? '' : modId;
  renderSideNav();
}

// Pulsar una funcion si navega — y deja el modulo activo, que es lo que decide
// el alcance de Search, Reports y Shift Report
function snavGo(modId, screen){
  activeModule = modId;
  // Si la funcion vive en otro modulo —o en uno plegado— hay que redibujar:
  // snavMark no lo hara, porque para entonces ya coinciden.
  var cambia = (snavOpen !== modId);
  snavOpen = modId;
  if(typeof ribbonRemember === 'function') ribbonRemember(screen, modId);
  if(cambia) renderSideNav();
  goTo(screen);
}

// Al abrir una pantalla la barra salta a su modulo. Desplegar y marcar son dos
// cosas distintas a proposito: si marcar volviera a dibujar la barra entera,
// las dos se llamarian sin parar.
function snavMark(screenId){
  var host = document.getElementById('snav');
  if(!host || !host.firstChild) return;
  var m = (typeof moduleOfScreen === 'function') ? moduleOfScreen(screenId) : null;
  var mios = (typeof myModules === 'function')
    ? myModules().map(function(x){ return x.id; }) : [];
  if(m && m !== snavOpen && mios.indexOf(m) >= 0){
    snavOpen = m;
    renderSideNav();
    return;
  }
  snavHighlight(screenId);
}

function snavHighlight(screenId){
  var host = document.getElementById('snav');
  if(!host) return;
  host.querySelectorAll('.snav-item').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-screen') === screenId);
  });
  var m = (typeof moduleOfScreen === 'function') ? moduleOfScreen(screenId) : null;
  host.querySelectorAll('.snav-mod').forEach(function(d){
    d.classList.toggle('here', d.getAttribute('data-mod') === m);
  });
}

// ---- El pie de la barra ----
function snavFecha(){
  var d = new Date();
  try {
    return d.toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'});
  } catch(e){ return d.toDateString(); }
}
function snavPie(){
  var m = (typeof moduleById === 'function' && snavOpen) ? moduleById(snavOpen) : null;
  return m ? m.name : '';
}
