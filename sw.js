// ===== SERVICE WORKER — SAFETY Quality Control =====
// Precachea la app completa para que abra y funcione sin señal. Las librerías
// de CDN y las fuentes se cachean en tiempo de ejecución. Las llamadas a
// Firestore/Auth NUNCA se cachean: siempre van a la red y fallan solas
// cuando no hay conexión (la app trabaja sobre localStorage).
const CACHE = 'safety-qc-v6';

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './apple-touch-icon.png',
  './js/main.js',
  './js/core/data.js','./js/core/icons.js','./js/core/nav.js','./js/core/utils.js',
  './js/core/auth.js','./js/core/theme.js','./js/core/sound.js','./js/core/pwa.js',
  './js/core/dup-guard.js','./js/core/firebase.js',
  './js/modules/weight.js','./js/modules/seal.js','./js/modules/dashboard.js',
  './js/modules/admin.js','./js/modules/reports.js','./js/modules/holds.js',
  './js/modules/check-timer.js','./js/modules/search.js','./js/modules/activity.js',
  './js/modules/hold-notify.js','./js/modules/metal.js','./js/modules/products.js',
  './js/modules/catalog.js','./js/modules/scanner.js','./js/modules/capa.js','./js/modules/shift.js',
  './js/export/pdf-reports.js','./js/export/excel.js','./js/export/dash-pdf.js',
  './js/export/capa-pdf.js','./js/export/shift-pdf.js',
  './js/integrations/word-fill.js','./js/integrations/excel-fill.js','./js/integrations/metal-fill.js',
  './js/vendor/jszip.min.js','./js/vendor/zxing.min.js'
];

// Hosts que jamás se cachean (API en vivo de Firebase)
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // addAll falla si un archivo falta; se cachea uno por uno para no romper la instalación
      return Promise.all(SHELL.map(function(url){
        return c.add(url).catch(function(){ /* ignora el que no exista */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; })
                             .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;                       // solo GET

  var url = new URL(req.url);
  if(NEVER_CACHE.indexOf(url.hostname) > -1) return;     // Firebase API: siempre a la red

  // Navegación (abrir la app): red primero, y si no hay señal, el shell cacheado
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }

  // Todo lo demás (JS, CSS, librerías de CDN, fuentes): cache primero, y en
  // segundo plano se refresca desde la red (stale-while-revalidate).
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === 'opaque')){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
