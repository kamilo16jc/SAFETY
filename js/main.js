// ===== INIT =====
updateDate();
setInterval(updateDate,60000);
// Set login logo
var loginLogo = document.getElementById('login-logo');
if(loginLogo) loginLogo.src = LOGO;
// En escritorio la barra lateral es oscura, así que el logo va en claro
var headerLogo = document.getElementById('header-logo');
var deskQuery = window.matchMedia('(min-width:1024px)');
function syncHeaderLogo(){ if(headerLogo) headerLogo.src = deskQuery.matches ? LOGO_LIGHT : LOGO; }
syncHeaderLogo();
if(deskQuery.addEventListener) deskQuery.addEventListener('change', syncHeaderLogo);
renderIcons(document);
// Start with login
initLogin();
