// ===== INIT =====
updateDate();
setInterval(updateDate,60000);
renderIcons(document);

// PWA: manifest, iconos y service worker en cada carga (antes solo corría al
// cerrar sesión, así que la app no se instalaba ni funcionaba offline).
initTheme();
setupPWA();
if('serviceWorker' in navigator){
  // Cuando se publica una versión nueva, el service worker nuevo se instala y
  // toma el control, PERO la página ya cargó los archivos viejos. Sin esto hay
  // que recargar dos veces (o cerrar la PWA) para ver un cambio: se recarga
  // sola en cuanto el SW nuevo toma el control.
  var swReloading = false;
  var hadController = !!navigator.serviceWorker.controller;
  // Si el operador escribio hace poco, no se recarga encima de su captura: se
  // le avisa con una barra y el decide cuando actualizar.
  var swLastTyped = 0;
  document.addEventListener('input', function(){ swLastTyped = Date.now(); }, true);
  // La actualizacion se ve (js/core/pwa.js, nxUp*): barra mientras baja,
  // ✓ y la pantalla se desvanece y vuelve con la version nueva.
  var swNueva = '';
  var swApply = function(){
    if(swReloading) return;
    swReloading = true;
    nxUpAplicar(swNueva);
  };
  navigator.serviceWorker.addEventListener('message', function(e){
    var d = e.data || {};
    if(d.type !== 'nx-sw-progress') return;
    if(d.version) swNueva = d.version;
    // la primera instalacion no es una actualizacion: no se anuncia
    if(hadController && !swReloading) nxUpProgreso(d.version, d.done, d.total);
  });
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(swReloading) return;
    // La primera instalacion toma el control sin que haya nada viejo que
    // cambiar: esa no recarga, pero las siguientes en esta misma sesion si.
    if(!hadController){ hadController = true; return; }
    nxVersiones().then(function(vs){
      if(vs.length) swNueva = vs[vs.length - 1];
      if(document.hidden || Date.now() - swLastTyped > 90000) swApply();
      else nxUpListo(swNueva, swApply);
    });
  });
  // El navegador solo busca una version nueva al ABRIR la app. En el telefono
  // la PWA se queda abierta en segundo plano dias enteros y nunca se enteraba
  // de una publicacion: ahora se pregunta al volver a la pantalla y cada media
  // hora (como mucho una vez por minuto).
  var swReg = null, swLastCheck = 0;
  var swCheck = function(){
    if(!swReg || !swReg.update || Date.now() - swLastCheck < 60000) return;
    swLastCheck = Date.now();
    swReg.update().catch(function(){});
  };
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') swCheck();
  });
  setInterval(swCheck, 30*60*1000);
  var registerSW = function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      swReg = reg;
      swLastCheck = Date.now();
      showAppVersion();
    }).catch(function(e){ console.log('SW:', e); });
  };
  // Si la página ya terminó de cargar, el evento 'load' no volverá a dispararse
  if(document.readyState === 'complete') registerSW();
  else window.addEventListener('load', registerSW);
}

// Start with login
initLogin();
