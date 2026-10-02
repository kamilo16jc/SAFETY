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
  if(!snavActivo() || !currentUser){
    host.innerHTML = '';
    document.body.classList.remove('snav-open');
    return;
  }

  var mods = (typeof myModules === 'function') ? myModules() : [];
  if(!mods.length){
    host.innerHTML = '';
    document.body.classList.remove('snav-open');
    return;
  }

  // Se abre en el modulo de la pantalla en la que ya estas, no en el primero.
  // Cadena vacia = el usuario lo plego a proposito, y eso se respeta.
  if(snavOpen == null || (snavOpen && !mods.some(function(m){ return m.id === snavOpen; }))){
    var actual = (typeof moduleOfScreen === 'function')
      ? moduleOfScreen((document.querySelector('.screen.active')||{}).id) : null;
    snavOpen = (actual && mods.some(function(m){ return m.id === actual; }))
      ? actual
      : (activeModule && mods.some(function(m){ return m.id === activeModule; })
          ? activeModule : mods[0].id);
  }

  var abierto = snavOpen ? moduleById(snavOpen) : null;

  host.innerHTML =
    '<div class="snav-rail">'+ mods.map(snavTileHTML).join('') +'</div>'+
    (abierto
      ? '<div class="snav-panel">'+
          '<div class="snav-ptitle">'+esc(abierto.name)+'</div>'+
          '<div class="snav-list">'+ snavSubHTML(abierto) +'</div>'+
          '<div class="snav-foot">'+
            '<span class="snav-cap">Hoy</span>'+
            '<strong>'+esc(snavFecha())+'</strong>'+
            '<span class="snav-cap">'+esc(abierto.name)+'</span>'+
          '</div>'+
        '</div>'
      : '');

  document.body.classList.toggle('snav-open', !!abierto);
  renderIcons(host);
  snavHighlight((document.querySelector('.screen.active')||{}).id);
}

// El modulo es el dibujo y nada mas: sin caja detras. El color es el tono de
// tinta de la tabla de modulos, no el claro: el marco de escritorio va siempre
// sobre blanco. Asi cada modulo conserva el suyo y nadie inventa paletas.
function snavTileHTML(m){
  var abierto = (m.id === snavOpen);
  return '<button class="snav-tile'+(abierto ? ' open' : '')+'" type="button" '+
    'data-mod="'+m.id+'" style="--mcol:'+m.ink+'" '+
    'title="'+esc(m.name)+'" aria-label="'+esc(m.name)+'" '+
    'aria-expanded="'+abierto+'" onclick="snavToggle(\''+m.id+'\')">'+
    '<span class="snav-glyph" data-icon="'+m.icon+'"></span>'+
  '</button>';
}

// Las funciones del modulo. Se conserva el orden de los grupos —es el que
// tiene sentido en planta— pero sin sus rotulos: el nombre de cada funcion ya
// dice lo que es.
function snavSubHTML(m){
  var permitidas = (typeof moduleItemsFor === 'function') ? moduleItemsFor(m) : m.items;
  var porPantalla = {};
  permitidas.forEach(function(i){ porPantalla[i.screen] = i; });

  var grupos = (typeof RIBBON_GROUPS !== 'undefined' && RIBBON_GROUPS[m.id])
    ? RIBBON_GROUPS[m.id]
    : [{n:'', s:permitidas.map(function(i){ return i.screen; })}];

  var usadas = {}, html = '';
  grupos.forEach(function(g){
    g.s.forEach(function(sc){
      if(!porPantalla[sc]) return;
      usadas[sc] = 1;
      html += snavItemHTML(porPantalla[sc], m);
    });
  });
  permitidas.forEach(function(i){
    if(!usadas[i.screen]) html += snavItemHTML(i, m);
  });
  return html;
}

function snavItemHTML(item, m){
  if(item.soon){
    return '<span class="snav-item soon">'+
      '<span class="snav-iico" data-icon="'+item.icon+'"></span>'+
      '<span class="snav-ilbl">'+esc(item.name)+'</span></span>';
  }
  return '<button class="snav-item" type="button" data-screen="'+item.screen+'" '+
    'onclick="snavGo(\''+m.id+'\',\''+item.screen+'\')">'+
    '<span class="snav-iico" data-icon="'+item.icon+'"></span>'+
    '<span class="snav-ilbl">'+esc(item.name)+'</span></button>';
}

// Abrir un modulo NO navega: solo despliega sus funciones, como la cinta
// cambiaba de pestaña sin moverte de pantalla. Volver a pulsarlo lo pliega.
function snavToggle(modId){
  snavOpen = (snavOpen === modId) ? '' : modId;
  renderSideNav();
  // Plegar la barra ensancha el contenido, y las graficas del inicio se miden
  // en pixeles al dibujarse: sin esto quedan estiradas hasta el siguiente
  // cambio de tamano de ventana.
  var home = document.getElementById('screen-home');
  if(home && home.classList.contains('active') && typeof renderHomeKPI === 'function')
    renderHomeKPI();
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
  host.querySelectorAll('.snav-tile').forEach(function(t){
    t.classList.toggle('here', t.getAttribute('data-mod') === m);
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
