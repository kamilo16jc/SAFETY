// ===== PWA SETUP =====
// Que version tiene este telefono: el numero de la cache del service worker
// (nexora-qc-vN). Mientras se instala una nueva conviven dos; la que sirve la
// pagina es la mas vieja, y al activarse la nueva la vieja se borra.
function showAppVersion(){
  var el = document.getElementById('um-ver');
  if(!el || !window.caches || !caches.keys) return;
  caches.keys().then(function(keys){
    var vs = keys.map(function(k){ var m = /^nexora-qc-v(\d+)$/.exec(k); return m ? +m[1] : 0; })
                 .filter(function(v){ return v > 0; }).sort(function(a,b){ return a-b; });
    el.textContent = vs.length ? 'App version '+vs[0] : '';
  }).catch(function(){});
}

// Barra de "hay version nueva" cuando no conviene recargar sola
function swUpdateBar(aplicar){
  if(document.getElementById('sw-update')) return;
  var b = document.createElement('div');
  b.id = 'sw-update';
  b.className = 'sw-update';
  b.setAttribute('role', 'status');
  b.innerHTML = '<span>A new version is ready. Save what you are doing, then update.</span>'+
                '<button type="button">Update</button>';
  b.querySelector('button').onclick = aplicar;
  document.body.appendChild(b);
}

// El manifest es un archivo de verdad (manifest.webmanifest, enlazado en el
// <head>). Antes se armaba aqui en un blob que nunca se enganchaba a la pagina:
// la app no tenia manifest y en la PC Chrome/Edge no la dejaban instalar.
function setupPWA() {
  pwaInstallUI();
}

// Instalar la app (PC con Chrome/Edge, y Android): el navegador avisa con
// beforeinstallprompt cuando se puede, y el menu del usuario ofrece "Install app"
var pwaPrompt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  pwaPrompt = e;
  pwaInstallUI();
});
window.addEventListener('appinstalled', function(){
  pwaPrompt = null;
  pwaInstallUI();
  if(typeof toast === 'function') toast('NEXORA installed on this device');
});
function pwaInstallUI(){
  var b = document.getElementById('um-install');
  if(b) b.hidden = !pwaPrompt;
}
function pwaInstall(){
  if(!pwaPrompt){ if(typeof toast === 'function') toast('Use the install icon in the address bar of Chrome or Edge'); return; }
  var ev = pwaPrompt;
  pwaPrompt = null;
  ev.prompt();
  ev.userChoice.then(function(){ pwaInstallUI(); }, function(){ pwaInstallUI(); });
}


