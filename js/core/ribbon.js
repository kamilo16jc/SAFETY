// ===== LA CINTA (solo escritorio) =====
// En el PC el menu de tarjetas obligaba a tres pasos para llegar a cualquier
// sitio: inicio, modulo, tarjeta. La cinta pone las 36 funciones a un clic,
// como la de Excel, que es la herramienta que esta gente usa todo el dia.
//
// No inventa nada: las pestañas son los MODULOS y los botones sus funciones,
// leidos de la misma tabla de siempre. Por eso respeta los roles sin una linea
// extra: si el rol no tiene una funcion, moduleItemsFor no la devuelve y el
// boton no existe.
//
// En el telefono no se dibuja. Ahi manda la pantalla, no el raton.

var RIBBON_MIN = 1024;

// Las funciones de cada modulo, agrupadas por lo que se hace con ellas. Lo que
// no este aqui cae al final en "Mas", asi que añadir una pantalla nueva nunca
// la deja fuera de la cinta.
var RIBBON_GROUPS = {
  qa: [
    {n:'Captura en línea', s:['screen-weight','screen-seal','screen-metal']},
    {n:'Muestras',         s:['screen-samplelist']},
    {n:'Ambiente',         s:['screen-temp','screen-gmp']},
    {n:'Documentos',       s:['screen-capa','screen-hold','screen-shift']},
    {n:'Consulta',         s:['screen-reports','screen-lotsearch']}
  ],
  lab: [
    {n:'Análisis',      s:['screen-analysis','screen-yeast']},
    {n:'Laboratorio',   s:['screen-lab']},
    {n:'Materia prima', s:['screen-raw','screen-dry','screen-formag','screen-rd']},
    {n:'Grilling',      s:['screen-grilling']},
    {n:'Consulta',      s:['screen-shift','screen-reports','screen-lotsearch']}
  ],
  production: [
    {n:'Programación', s:['screen-production']},
    {n:'Consulta',     s:['screen-reports','screen-lotsearch']}
  ],
  products: [
    {n:'Catálogo', s:['screen-products','screen-addproduct']}
  ],
  coa: [
    {n:'Certificados',        s:['screen-coa','screen-coastatus']},
    {n:'Laboratorio externo', s:['screen-labresults']},
    {n:'Consulta',            s:['screen-lotsearch']}
  ],
  admin: [
    {n:'Panel',    s:['screen-dashboard']},
    {n:'Personas', s:['screen-admin']},
    {n:'Registro', s:['screen-activity']},
    {n:'Consulta', s:['screen-reports','screen-lotsearch']}
  ]
};

var ribbonTab = null;          // modulo abierto en la cinta

// ---- Preferencias del equipo (cada PC decide) ----
function ribbonOn(){
  try { return localStorage.getItem('safety_ui') !== 'classic'; } catch(e){ return true; }
}
function ribbonCollapsed(){
  try { return localStorage.getItem('safety_ribbon') === 'collapsed'; } catch(e){ return false; }
}
function ribbonSetOn(v){
  try { localStorage.setItem('safety_ui', v ? 'ribbon' : 'classic'); } catch(e){}
  document.body.classList.toggle('ui-ribbon', !!v);
  renderRibbon();
  if(typeof toast === 'function') toast(v ? 'Cinta activada' : 'Vista clásica');
}
function toggleRibbonUI(){ ribbonSetOn(!ribbonOn()); }

// Plegar: doble clic en la pestaña o la flecha de la derecha, como en Excel
function toggleRibbonBody(){
  var plegada = !ribbonCollapsed();
  try { localStorage.setItem('safety_ribbon', plegada ? 'collapsed' : 'open'); } catch(e){}
  var host = document.getElementById('ribbon');
  if(host) host.setAttribute('data-collapsed', String(plegada));
  var ch = document.getElementById('rb-collapse');
  if(ch) ch.innerHTML = plegada ? '&#709;' : '&#94;';
}

// ---- Dibujo ----
function renderRibbon(){
  var host = document.getElementById('ribbon');
  if(!host) return;
  if(!ribbonOn() || !currentUser || window.innerWidth < RIBBON_MIN){
    host.innerHTML = ''; return;
  }
  var mods = (typeof myModules === 'function') ? myModules() : [];
  if(!mods.length){ host.innerHTML = ''; return; }
  // Se abre en la pestaña de la pantalla en la que ya estas, no en la primera
  if(!ribbonTab || !mods.some(function(m){ return m.id === ribbonTab; })){
    var actual = (typeof moduleOfScreen === 'function')
      ? moduleOfScreen((document.querySelector('.screen.active')||{}).id) : null;
    ribbonTab = (actual && mods.some(function(m){ return m.id === actual; }))
      ? actual : (activeModule && mods.some(function(m){ return m.id === activeModule; })
        ? activeModule : mods[0].id);
  }

  var pestañas = mods.map(function(m, i){
    var sel = m.id === ribbonTab;
    return '<button class="rb-tab" type="button" role="tab" aria-selected="'+sel+'" '+
      'data-mod="'+m.id+'" style="--tabcolor:'+m.ink+'" '+
      'onclick="ribbonOpen(\''+m.id+'\')" ondblclick="toggleRibbonBody()">'+
      '<span class="rb-kt">'+(i+1)+'</span>'+esc(m.name)+'</button>';
  }).join('');

  host.innerHTML =
    '<div class="rb-tabs" role="tablist">'+pestañas+
      '<button class="rb-collapse" id="rb-collapse" type="button" onclick="toggleRibbonBody()" '+
      'title="Plegar la cinta" aria-label="Plegar la cinta">'+
      (ribbonCollapsed() ? '&#709;' : '&#94;')+'</button>'+
    '</div>'+
    '<div class="rb-body"><div class="rb-groups">'+ribbonGroupsHTML(ribbonTab)+'</div></div>';
  host.setAttribute('data-collapsed', String(ribbonCollapsed()));
  renderIcons(host);
  ribbonHighlight((document.querySelector('.screen.active')||{}).id);
}

function ribbonGroupsHTML(modId){
  var m = moduleById(modId);
  if(!m) return '';
  var permitidas = (typeof moduleItemsFor === 'function') ? moduleItemsFor(m) : m.items;
  var porPantalla = {};
  permitidas.forEach(function(i){ porPantalla[i.screen] = i; });

  var grupos = (RIBBON_GROUPS[modId] || [{n:'Funciones', s:permitidas.map(function(i){ return i.screen; })}]);
  var usadas = {};
  var html = grupos.map(function(g){
    var cmds = g.s.filter(function(s){ return porPantalla[s]; }).map(function(s){
      usadas[s] = 1;
      return ribbonCmdHTML(porPantalla[s], m);
    }).join('');
    if(!cmds) return '';
    return '<div class="rb-group"><div class="rb-cmds">'+cmds+'</div>'+
           '<div class="rb-gname">'+esc(g.n)+'</div></div>';
  }).join('');

  // Lo que no este en ningun grupo igual sale: nada se pierde
  var sueltas = permitidas.filter(function(i){ return !usadas[i.screen]; });
  if(sueltas.length){
    html += '<div class="rb-group"><div class="rb-cmds">'+
      sueltas.map(function(i){ return ribbonCmdHTML(i, m); }).join('')+
      '</div><div class="rb-gname">Más</div></div>';
  }
  return html;
}

function ribbonCmdHTML(item, m){
  if(item.soon){
    return '<span class="rb-cmd soon" title="En preparación">'+
      '<span class="rb-ico" data-icon="'+item.icon+'"></span>'+
      '<span>'+esc(item.name)+'</span></span>';
  }
  return '<button class="rb-cmd" type="button" data-screen="'+item.screen+'" '+
    'style="--accent:'+(item.color || m.ink)+'" '+
    'onclick="ribbonGo(\''+m.id+'\',\''+item.screen+'\')">'+
    '<span class="rb-ico" data-icon="'+item.icon+'"></span>'+
    '<span>'+esc(item.name)+'</span></button>';
}

// Elegir pestaña no navega: solo cambia los botones, como en Excel
function ribbonOpen(modId){
  ribbonTab = modId;
  renderRibbon();
}

// Pulsar un boton si navega — y deja el modulo activo, que es lo que decide
// el alcance de Search, Reports y Shift Report
function ribbonGo(modId, screen){
  activeModule = modId;
  ribbonTab = modId;
  ribbonRemember(screen, modId);
  goTo(screen);
}

// Al abrir una pantalla, la cinta salta a su pestaña. Repintar los botones y
// marcar el activo son dos cosas distintas a proposito: si marcar volviera a
// dibujar la cinta entera, las dos se llamarian sin parar.
function ribbonMark(screenId){
  var host = document.getElementById('ribbon');
  if(!host || !host.firstChild) return;
  var m = (typeof moduleOfScreen === 'function') ? moduleOfScreen(screenId) : null;
  var mios = (typeof myModules === 'function') ? myModules().map(function(x){ return x.id; }) : [];
  if(m && m !== ribbonTab && mios.indexOf(m) >= 0){
    ribbonTab = m;
    var caja = host.querySelector('.rb-groups');
    if(caja){ caja.innerHTML = ribbonGroupsHTML(ribbonTab); renderIcons(caja); }
  }
  ribbonHighlight(screenId);
}

// Solo pinta cual esta seleccionado: no toca el contenido
function ribbonHighlight(screenId){
  var host = document.getElementById('ribbon');
  if(!host) return;
  host.querySelectorAll('.rb-tab').forEach(function(t){
    t.setAttribute('aria-selected', String(t.getAttribute('data-mod') === ribbonTab));
  });
  host.querySelectorAll('.rb-cmd[data-screen]').forEach(function(b){
    if(b.getAttribute('data-screen') === screenId) b.setAttribute('aria-current','true');
    else b.removeAttribute('aria-current');
  });
}

// ---- Teclado: Alt enseña las letras, Alt+numero cambia de pestaña ----
document.addEventListener('keydown', function(e){
  if(!ribbonOn() || !currentUser) return;
  if(e.key === 'Alt') document.body.classList.add('rb-keytips');
  if(e.altKey && /^[1-9]$/.test(e.key)){
    var mods = (typeof myModules === 'function') ? myModules() : [];
    var m = mods[parseInt(e.key,10) - 1];
    if(m){ e.preventDefault(); ribbonOpen(m.id); }
  }
});
document.addEventListener('keyup', function(e){
  if(e.key === 'Alt') document.body.classList.remove('rb-keytips');
});
window.addEventListener('blur', function(){ document.body.classList.remove('rb-keytips'); });

// Al cruzar el ancho de escritorio hay que dibujarla o quitarla
var _rbAncho = window.innerWidth;
window.addEventListener('resize', function(){
  var antes = _rbAncho >= RIBBON_MIN, ahora = window.innerWidth >= RIBBON_MIN;
  _rbAncho = window.innerWidth;
  if(antes !== ahora) renderRibbon();
});

if(typeof document !== 'undefined'){
  document.addEventListener('DOMContentLoaded', function(){
    document.body.classList.toggle('ui-ribbon', ribbonOn());
  });
}

// ===== LA PANTALLA DE INICIO CON LA CINTA =====
// Con la cinta, las seis tarjetas del inicio sobran: ya no son el camino a
// ningun sitio, solo ocupan la pantalla. En su lugar va lo que de verdad sirve
// al abrir la aplicacion — que falta hoy y donde estabas —, con todo a un
// clic. En el telefono no cambia nada: alli las tarjetas siguen siendo el menu.

// Lo ultimo que se abrio, para volver sin buscar
function ribbonRemember(screenId, modId){
  if(!screenId || screenId === 'screen-home' || screenId === 'screen-module') return;
  try {
    var l = JSON.parse(localStorage.getItem('safety_recent') || '[]');
    l = l.filter(function(x){ return x.s !== screenId; });
    l.unshift({s:screenId, m:modId || activeModule || ''});
    localStorage.setItem('safety_recent', JSON.stringify(l.slice(0, 6)));
  } catch(e){}
}
function ribbonRecent(){
  try { return JSON.parse(localStorage.getItem('safety_recent') || '[]'); } catch(e){ return []; }
}

// Lo que quedo a medias, contado sobre lo que ya hay en el equipo
function ribbonPendientes(){
  var hoy = (typeof localDateStr === 'function') ? localDateStr() : '';
  var out = [];

  if(typeof getRuns === 'function' && typeof runSampleCount === 'function'){
    var porRecoger = getRuns().filter(function(r){
      return String(r.date||'').slice(0,10) === hoy && runSampleCount(r) > 0 && !r.collected;
    }).length;
    out.push({n:porRecoger, t:'muestras por recoger', s:'screen-samplelist', m:'qa'});
  }
  if(typeof labFormGroups === 'function'){
    var formas = labFormGroups().filter(function(g){ return g.sent < g.runs.length; }).length;
    out.push({n:formas, t:'formas del laboratorio por enviar', s:'screen-lab', m:'lab'});
  }
  if(typeof ymDone === 'function' && typeof ymDueDate === 'function'){
    var placas = (getDB().analysis || []).filter(function(a){
      return !ymDone(a) && ymDueDate(a) && ymDueDate(a) <= hoy;
    }).length;
    out.push({n:placas, t:'placas listas para leer', s:'screen-yeast', m:'lab'});
  }
  if(typeof getHolds === 'function'){
    var holds = getHolds().filter(function(h){ return h.status === 'hold'; }).length;
    out.push({n:holds, t:holds === 1 ? 'producto retenido' : 'productos retenidos', s:'screen-hold', m:'qa'});
  }
  // Solo lo que este usuario puede abrir
  return out.filter(function(p){
    return (typeof canSeeScreen !== 'function') || canSeeScreen(p.s);
  });
}

function renderRibbonStart(){
  var host = document.getElementById('home-start');
  if(!host) return false;
  if(!ribbonOn() || window.innerWidth < RIBBON_MIN){ host.innerHTML = ''; return false; }

  var pend = ribbonPendientes();
  var tarjetas = pend.map(function(p){
    return '<button class="hs-card'+(p.n ? ' hs-live' : '')+'" type="button" '+
      'onclick="ribbonGo(\''+p.m+'\',\''+p.s+'\')">'+
      '<b>'+p.n+'</b><span>'+esc(p.t)+'</span></button>';
  }).join('');

  var rec = ribbonRecent().map(function(x){
    var m = moduleById(x.m), item = null;
    MODULES.forEach(function(mm){ mm.items.forEach(function(i){
      if(i.screen === x.s && (!item || mm.id === x.m)) item = i; }); });
    if(!item || (typeof canSeeScreen === 'function' && !canSeeScreen(x.s))) return '';
    return '<button class="hs-recent" type="button" onclick="ribbonGo(\''+(x.m||'')+'\',\''+x.s+'\')">'+
      '<span class="hs-ico" data-icon="'+item.icon+'" style="color:'+(item.color || (m?m.ink:''))+'"></span>'+
      esc(item.name)+'</button>';
  }).join('');

  host.innerHTML =
    (tarjetas ? '<div class="hs-label">Hoy</div><div class="hs-grid">'+tarjetas+'</div>' : '')+
    (rec ? '<div class="hs-label">Donde estabas</div><div class="hs-recents">'+rec+'</div>' : '');
  renderIcons(host);
  return true;
}
