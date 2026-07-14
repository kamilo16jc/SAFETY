// ===== INIT =====
updateDate();
setInterval(updateDate,60000);
// Set login logo
var loginLogo = document.getElementById('login-logo');
if(loginLogo) loginLogo.src = LOGO;
var headerLogo = document.getElementById('header-logo');
if(headerLogo) headerLogo.src = LOGO;
// Start with login
initLogin();
