// ===== INIT =====
updateDate();
setInterval(updateDate,60000);
// Set login logo
var loginLogo = document.getElementById('login-logo');
if(loginLogo) loginLogo.src = LOGO;
// La barra lateral es verde oscuro en todos los tamaños: el logo va en claro
var headerLogo = document.getElementById('header-logo');
if(headerLogo) headerLogo.src = LOGO_LIGHT;
renderIcons(document);

// PWA: manifest, iconos y service worker en cada carga (antes solo corría al
// cerrar sesión, así que la app no se instalaba ni funcionaba offline).
initTheme();
setupPWA();
if('serviceWorker' in navigator){
  var registerSW = function(){
    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.log('SW:', e); });
  };
  // Si la página ya terminó de cargar, el evento 'load' no volverá a dispararse
  if(document.readyState === 'complete') registerSW();
  else window.addEventListener('load', registerSW);
}

// Start with login
initLogin();
