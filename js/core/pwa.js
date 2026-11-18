// ===== PWA SETUP =====
// ---- La version ----
// Desde 17 nov 2026 es la fecha de la publicacion: año.mes.dia (26.11.17) y
// .1, .2... si hay mas de una el mismo dia. Vive en sw.js (VERSION) y le da
// nombre a la cache: nexora-qc-26.11.17. Las de antes (nexora-qc-vN) cuentan
// como mas viejas que cualquier fecha.
function nxVerDe(k){
  var m = /^nexora-qc-(?:v(\d+)|(\d+(?:\.\d+){2,3}))$/.exec(k || '');
  return !m ? null : m[1] ? 'v'+m[1] : m[2];
}
function nxVerCmp(a, b){
  var n = function(v){ return v.charAt(0) === 'v' ? [0, +v.slice(1)] : v.split('.').map(Number); };
  var x = n(a), y = n(b);
  for(var i = 0; i < Math.max(x.length, y.length); i++){ var d = (x[i]||0) - (y[i]||0); if(d) return d; }
  return 0;
}
// Las de este equipo, de la mas vieja a la mas nueva. Mientras se instala una
// nueva conviven dos: la que sirve la pagina es la vieja.
function nxVersiones(){
  if(!window.caches || !caches.keys) return Promise.resolve([]);
  return caches.keys().then(function(ks){ return ks.map(nxVerDe).filter(Boolean).sort(nxVerCmp); })
    .catch(function(){ return []; });
}
function showAppVersion(){
  nxVersiones().then(function(vs){
    var el = document.getElementById('um-ver');
    if(el) el.textContent = vs.length ? 'App version '+vs[0] : '';
    if(vs.length) nxUpVisto(vs[0]);
  });
}

// ---- La actualizacion a la vista (pedido del usuario, 17 nov 2026) ----
// Una pastilla arriba: "Updating to X" con la barra de los archivos que baja
// el service worker (sw.js avisa cada uno); al terminar ✓, la pantalla se
// desvanece y vuelve ya con la version nueva, sin el blanco de antes. Si
// alguien estaba escribiendo no se recarga sola: "X is ready" + Update.
var _nxUpVer = '', _nxUpDesde = 0;
function nxUpPill(){
  var p = document.getElementById('nx-up');
  if(p) return p;
  p = document.createElement('div');
  p.id = 'nx-up';
  p.className = 'nx-up';
  p.setAttribute('role', 'status');
  p.setAttribute('aria-live', 'polite');
  p.innerHTML = '<span class="nx-up-ico"></span><span class="nx-up-txt"></span>'+
    '<span class="nx-up-bar"><i></i></span><button type="button" class="nx-up-btn">Update</button>';
  document.body.appendChild(p);
  void p.offsetWidth;   // para que entre deslizandose
  return p;
}
function nxUpPoner(estado, ico, txt){
  var p = nxUpPill();
  p.className = 'nx-up on '+estado;
  p.querySelector('.nx-up-ico').innerHTML = (window.ICONS && ICONS[ico]) || '';
  p.querySelector('.nx-up-txt').textContent = txt;
  return p;
}
function nxUpProgreso(ver, hechos, total){
  if(ver) _nxUpVer = ver;
  var p = document.getElementById('nx-up');
  if(!p || !p.classList.contains('run')){
    p = nxUpPoner('run', 'refresh', 'Updating to '+(_nxUpVer || 'the new version'));
    _nxUpDesde = Date.now();
  }
  p.querySelector('.nx-up-bar i').style.width = (total ? Math.round(hechos / total * 100) : 0)+'%';
}
function nxUpListo(ver, aplicar){
  var p = nxUpPoner('ready', 'spark', (ver || 'A new version')+' is ready');
  p.querySelector('.nx-up-btn').onclick = aplicar;
}
// La version nueva ya tomo el control: ✓, se desvanece y recarga. La barra
// se deja ver al menos un momento aunque la red sea muy rapida.
function nxUpAplicar(ver){
  if(document.hidden){ location.reload(); return; }
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var p = document.getElementById('nx-up');
  var espera = (p && p.classList.contains('run')) ? Math.max(0, 900 - (Date.now() - _nxUpDesde)) : 0;
  if(p && p.classList.contains('run')) p.querySelector('.nx-up-bar i').style.width = '100%';
  setTimeout(function(){
    nxUpPoner('done', 'check', 'Updated'+(ver ? ' · '+ver : ''));
    try { sessionStorage.setItem('nx-up-fade', '1'); } catch(e){}
    setTimeout(function(){ document.documentElement.classList.add('nx-leaving'); }, quieto ? 0 : 750);
    setTimeout(function(){ location.reload(); }, quieto ? 60 : 1100);
  }, quieto ? 0 : espera);
}
// Ya con la version nueva: la misma pastilla un momento y se va. Si el equipo
// la estrena sin haber visto ninguna (primera vez con este aviso) pero ya
// tenia la app (hay datos guardados), tambien cuenta como actualizacion.
function nxUpVisto(cur){
  var antes = null;
  try { antes = localStorage.getItem('nx-ver-seen'); localStorage.setItem('nx-ver-seen', cur); } catch(e){ return; }
  if(antes === cur) return;
  var tenia = !!antes;
  if(!tenia) try { tenia = Object.keys(localStorage).some(function(k){ return k.indexOf('safety_db') === 0; }); } catch(e){}
  if(tenia) nxUpHecho(cur);
}
function nxUpHecho(ver){
  var mostrar = function(){
    var p = nxUpPoner('done', 'check', 'Updated · '+ver);
    setTimeout(function(){ if(p.classList.contains('done')) p.classList.remove('on'); }, 2800);
    setTimeout(function(){ if(p.parentNode && !p.classList.contains('on')) p.remove(); }, 3400);
  };
  if(!document.hidden) return mostrar();
  document.addEventListener('visibilitychange', function f(){
    if(document.hidden) return;
    document.removeEventListener('visibilitychange', f);
    mostrar();
  });
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


