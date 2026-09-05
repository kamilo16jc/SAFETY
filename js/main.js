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
// Start with login
initLogin();
