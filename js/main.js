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
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(!hadController || swReloading) return;   // primera instalación: no recargar
    swReloading = true;
    window.location.reload();
  });
  var registerSW = function(){
    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.log('SW:', e); });
  };
  // Si la página ya terminó de cargar, el evento 'load' no volverá a dispararse
  if(document.readyState === 'complete') registerSW();
  else window.addEventListener('load', registerSW);
}

// El arranque se retira cuando la marca termina de dibujarse. Si el equipo
// pidio menos movimiento, se va casi de inmediato.
(function(){
  var sp = document.getElementById('splash');
  if(!sp) return;
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function(){
    sp.classList.add('gone');
    setTimeout(function(){ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 450);
  }, quieto ? 250 : 1900);
})();

// Start with login
initLogin();
