// ===== FOTO DE LA VERIFICACION DE PESO =====
// Una foto opcional por registro: la bascula y la etiqueta. Se toma con la
// camara del telefono, se achica aqui mismo (1280 px, JPEG 70 %: de 3-4 MB a
// unos 150 KB, y de paso pierde el GPS y los datos del telefono) y se sube a
// SharePoint por dos funciones de Firebase (ver functions/index.js).
//
// El registro de peso guarda solo el nombre del archivo, que se inventa aqui:
// asi se puede guardar sin señal. La foto espera en el telefono (IndexedDB, que
// si aguanta imagenes; localStorage no) hasta que haya conexion y donde subirla.

var WP_UPLOAD = 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyPhotoUpload';
var WP_GET    = 'https://us-central1-envirotrack-5173f.cloudfunctions.net/safetyPhotoGet';
var WP_LADO = 1280, WP_CALIDAD = 0.7;

var wpActual = null;       // la foto del formulario, antes de guardar
var wpCache  = {};         // fileName -> data URI ya traida

// ---- La cola en el telefono ----
var _wpDb = null;
function wpDB(){
  if(_wpDb) return _wpDb;
  _wpDb = new Promise(function(ok, mal){
    if(!window.indexedDB){ mal(new Error('IndexedDB not available')); return; }
    var r = indexedDB.open('nexora-fotos', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('cola', {keyPath:'fileName'}); };
    r.onsuccess = function(){ ok(r.result); };
    r.onerror = function(){ mal(r.error); };
  });
  return _wpDb;
}
function _wpPedir(modo, hacer){
  return wpDB().then(function(db){
    return new Promise(function(ok, mal){
      var tx = db.transaction('cola', modo);
      var req = hacer(tx.objectStore('cola'));
      tx.oncomplete = function(){ ok(req ? req.result : undefined); };
      tx.onerror = tx.onabort = function(){ mal(tx.error); };
    });
  });
}
function wpColaPut(it){ return _wpPedir('readwrite', function(s){ return s.put(it); }); }
function wpColaGet(fn){ return _wpPedir('readonly',  function(s){ return s.get(fn); }); }
function wpColaDel(fn){ return _wpPedir('readwrite', function(s){ return s.delete(fn); }); }
function wpColaAll(){   return _wpPedir('readonly',  function(s){ return s.getAll(); }).then(function(x){ return x || []; }); }

// ---- Achicar ----
function wpComprimir(file){
  var cargar = window.createImageBitmap
    ? createImageBitmap(file, {imageOrientation:'from-image'}).catch(function(){ return createImageBitmap(file); })
    : new Promise(function(ok, mal){
        var img = new Image(), u = URL.createObjectURL(file);
        img.onload = function(){ URL.revokeObjectURL(u); ok(img); };
        img.onerror = function(){ URL.revokeObjectURL(u); mal(new Error('not an image')); };
        img.src = u;
      });
  return cargar.then(function(img){
    var w = img.width, h = img.height;
    var k = Math.min(1, WP_LADO / Math.max(w, h));
    var cw = Math.round(w*k), ch = Math.round(h*k);
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
    if(img.close) img.close();
    var b64 = cv.toDataURL('image/jpeg', WP_CALIDAD).split(',')[1] || '';
    return {b64:b64, w:cw, h:ch, kb:Math.round(b64.length*3/4/1024)};
  });
}

// W-AAAAMMDD-xxxxxxxxxxxx.jpg (la funcion solo acepta esta forma)
function wpNombre(fechaIso){
  var d = String(fechaIso || localDateStr()).slice(0,10).replace(/-/g,'');
  var r = '';
  var abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var rnd = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(12)) : null;
  for(var i=0;i<12;i++) r += abc[rnd ? rnd[i] % abc.length : Math.floor(Math.random()*abc.length)];
  return 'W-'+d+'-'+r+'.jpg';
}

// ---- El formulario ----
function wpElegir(){ var i = document.getElementById('w-photo-input'); if(i){ i.value=''; i.click(); } }
function wpAlElegir(input){
  var f = input && input.files && input.files[0];
  if(!f) return;
  var box = document.getElementById('w-photo-box');
  if(box) box.innerHTML = '<span class="wp-meta">Processing photo…</span>';
  wpComprimir(f).then(function(x){
    if(!/^\/9j\//.test(x.b64)) throw new Error('not a JPEG');
    wpActual = x;
    wpPintar();
  }).catch(function(){
    wpActual = null;
    wpPintar();
    toast('That file could not be read as a photo');
  });
}
function wpQuitar(){ wpActual = null; wpPintar(); }

function wpPintar(){
  var box = document.getElementById('w-photo-box');
  if(!box) return;
  if(!wpActual){
    box.innerHTML = '<button type="button" class="cbtn wp-btn" onclick="wpElegir()">'+
      '<span data-icon="camera"></span>Take photo</button>';
  } else {
    box.innerHTML =
      '<img class="wp-thumb" src="data:image/jpeg;base64,'+wpActual.b64+'" alt="Photo to attach">'+
      '<div class="wp-side">'+
        '<span class="wp-meta">'+wpActual.w+' × '+wpActual.h+' · '+wpActual.kb+' KB</span>'+
        '<div class="wp-acts">'+
          '<button type="button" class="cbtn" onclick="wpElegir()"><span data-icon="camera"></span>Retake</button>'+
          '<button type="button" class="cbtn" onclick="wpQuitar()"><span data-icon="trash"></span>Remove</button>'+
        '</div>'+
      '</div>';
  }
  if(typeof renderIcons==='function') renderIcons(box);
}

// Lo llama commitWeight antes de guardar: el registro se lleva el nombre y la
// foto se queda en la cola
function wpAdjuntar(rec){
  if(!wpActual || !rec) return;
  var fn = wpNombre(rec.date);
  rec.photo = {fileName:fn, w:wpActual.w, h:wpActual.h, kb:wpActual.kb};
  var it = {
    fileName: fn, b64: wpActual.b64, createdAt: new Date().toISOString(), tries: 0,
    meta: {date:rec.date, line:rec.line, product:rec.product||'', lot:rec.lot||'', by:rec.initials||''}
  };
  wpActual = null;
  wpPintar();
  wpColaPut(it).then(function(){ wpAviso(); wpSubir(); })
    .catch(function(){ toast('The photo could not be kept on this device'); });
}

// ---- Subir lo pendiente ----
var _wpSubiendo = false;
function wpSubir(){
  if(_wpSubiendo || navigator.onLine === false){ wpAviso(); return Promise.resolve(); }
  _wpSubiendo = true;
  return wpColaAll().then(function(items){
    items.sort(function(a,b){ return String(a.createdAt).localeCompare(String(b.createdAt)); });
    var i = 0;
    var siguiente = function(){
      if(i >= items.length) return;
      var it = items[i++];
      return fetch(WP_UPLOAD, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fileName:it.fileName, contentBase64:it.b64, meta:it.meta})
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(j){ return {s:r.status, j:j}; });
      }).then(function(x){
        if(x.s === 200 && x.j.ok) return wpColaDel(it.fileName).then(siguiente);
        it.tries = (it.tries||0) + 1;
        it.error = x.j.error || ('HTTP '+x.s);
        // Lo que nunca va a pasar (nombre o archivo malo) no frena a los demas;
        // lo de afuera (sin flujo, sin señal, demasiadas) para y se reintenta
        if(x.s === 400 || x.s === 413) return wpColaPut(it).then(siguiente);
        return wpColaPut(it);
      });
    };
    return siguiente();
  }).catch(function(){ /* sin red: se reintenta despues */ })
    .then(function(){ _wpSubiendo = false; wpAviso(); });
}

// "2 photos waiting to upload" en la pantalla de pesos
function wpAviso(){
  var el = document.getElementById('w-photo-pend');
  if(!el) return;
  wpColaAll().then(function(items){
    if(!items.length){ el.hidden = true; el.textContent = ''; return; }
    var n = items.length;
    var motivo = items.some(function(x){ return x.error === 'not configured'; })
      ? ' · SharePoint is not connected yet'
      : (navigator.onLine === false ? ' · no connection' : '');
    el.textContent = n+' photo'+(n===1?'':'s')+' waiting to upload'+motivo;
    el.hidden = false;
  }).catch(function(){ el.hidden = true; });
}

// Reintentos: al volver la señal, al volver a la app y cada dos minutos
window.addEventListener('online', function(){ wpSubir(); });
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') wpSubir(); });
setTimeout(function(){ wpSubir(); }, 4000);
setInterval(function(){ wpColaAll().then(function(x){ if(x.length) wpSubir(); }).catch(function(){}); }, 120000);

// ---- Ver la foto de un registro ----
function wpBloqueHTML(w){
  if(!w || !w.photo || !w.photo.fileName) return '';
  return '<div class="rec-block"><div class="rec-lbl">Photo</div>'+
    '<div class="wp-ver" data-wp="'+esc(w.photo.fileName)+'"><span class="rec-hint">Loading photo…</span></div></div>';
}
function wpCargarEn(root){
  if(!root) return;
  root.querySelectorAll('[data-wp]').forEach(function(el){
    var fn = el.getAttribute('data-wp');
    wpTraer(fn).then(function(uri){
      el.innerHTML = '<img class="wp-img" src="'+uri+'" alt="Weight check photo" onclick="wpAmpliar(this.src)">';
    }, function(msg){
      el.innerHTML = '<span class="rec-hint">'+esc(String(msg))+'</span>';
    });
  });
}
function wpTraer(fn){
  if(wpCache[fn]) return Promise.resolve(wpCache[fn]);
  return wpColaGet(fn).catch(function(){ return null; }).then(function(it){
    // Si todavia no subio, la tiene este telefono
    if(it && it.b64) return 'data:image/jpeg;base64,'+it.b64;
    return fetch(WP_GET, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fileName:fn})
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ return {s:r.status, j:j}; });
    }, function(){ throw 'No connection: the photo shows when you are online.'; })
    .then(function(x){
      if(x.s === 200 && x.j.ok && x.j.content){
        var u = 'data:image/jpeg;base64,'+x.j.content;
        wpCache[fn] = u;
        return u;
      }
      if(x.s === 503) throw 'Photos are not connected to SharePoint yet.';
      if(x.s === 404) throw 'Not uploaded yet: it is still on the device that took it.';
      throw 'The photo could not be loaded.';
    });
  });
}
// A pantalla completa; un toque la cierra
function wpAmpliar(src){
  var z = document.createElement('div');
  z.className = 'wp-zoom';
  z.innerHTML = '<img src="'+src+'" alt="Weight check photo">';
  z.onclick = function(){ z.remove(); };
  document.body.appendChild(z);
}
