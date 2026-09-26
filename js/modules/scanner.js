// ===== BARCODE SCANNER (cámara del teléfono) =====
// Dos motores: el lector nativo del navegador (BarcodeDetector, Android) y
// ZXing (js/vendor/zxing.min.js) para Safari/iPhone, que no lo trae.
// Si la cámara falla, el overlay deja escribir el código a mano.
//
// Mejoras para evitar lecturas equivocadas y códigos grandes:
//  - Lee TODAS las clases de código (UPC/EAN, Code-128, Code-39, ITF, QR…).
//  - Apunta al centro: elige el código dentro del recuadro (evita leer el
//    de al lado en el label) — motor nativo.
//  - Confirma por repetición: acepta solo si lee el MISMO valor 2 veces seguidas.
//  - Cámara en alta resolución + enfoque continuo + botón de linterna.
var scanStream = null, scanTimer = null, scanScreen = null;
var scanDetector = null, zxingReader = null, scanTrack = null, scanTorchOn = false;

// Confirmación por repetición
var SCAN_CONFIRM = 2;
var scanLast = null, scanHits = 0;

function scanNative(){ return typeof window.BarcodeDetector !== 'undefined'; }
function scanZXing(){  return typeof window.ZXing !== 'undefined' && !!window.ZXing.BrowserMultiFormatReader; }
function scanSupported(){ return scanNative() || scanZXing(); }

function openScanner(screen){
  scanScreen = screen;
  scanLast = null; scanHits = 0; scanTorchOn = false;
  if(!scanSupported()){
    showGuardModal({
      title:'Camera scanning is not available on this device',
      detail:'Type the product number instead, or use a handheld scanner: point it at the Product Number field and pull the trigger.',
      ask:'The product number works the same either way.',
      primaryLabel:'OK', onPrimary:closeDupModal,
      secondaryLabel:'Create product', onSecondary:function(){ closeDupModal(); openProductModal(screen); }
    });
    return;
  }
  document.getElementById('scan-overlay').style.display = 'flex';
  document.getElementById('scan-manual').value = '';
  var tb = document.getElementById('scan-torch'); if(tb){ tb.style.display='none'; tb.textContent='Turn on light'; }
  document.body.style.overflow = 'hidden';
  setScanMsg('Center the barcode inside the frame');

  if(scanNative()) startNativeScan();
  else startZXingScan();
}

function setScanMsg(msg){
  var el = document.getElementById('scan-msg');
  if(el) el.textContent = msg;
}

function scanCameraError(e){
  var name = (e && e.name) || '';
  if(name==='NotAllowedError')      setScanMsg('Camera permission denied. Allow camera access for this site, or type the code below.');
  else if(name==='NotFoundError')   setScanMsg('No camera found on this device. Type the code below.');
  else                              setScanMsg('Could not open the camera. Type the code below.');
}

// Restricciones de vídeo: cámara trasera, alta resolución, enfoque continuo
function scanVideoConstraints(){
  return {
    facingMode:{ideal:'environment'},
    width:{ideal:1920}, height:{ideal:1080},
    focusMode:'continuous'
  };
}

// Cuando el stream ya corre: guarda el track, aplica enfoque continuo y
// muestra el botón de linterna si el dispositivo lo soporta.
function setupTrackControls(track){
  scanTrack = track || null;
  if(!scanTrack) return;
  try {
    var caps = scanTrack.getCapabilities ? scanTrack.getCapabilities() : {};
    if(caps.focusMode && caps.focusMode.indexOf('continuous')>=0){
      scanTrack.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(function(){});
    }
    if(caps.torch){
      var tb = document.getElementById('scan-torch');
      if(tb) tb.style.display = 'inline-flex';
    }
  } catch(e){}
}

function toggleTorch(){
  if(!scanTrack) return;
  scanTorchOn = !scanTorchOn;
  scanTrack.applyConstraints({advanced:[{torch:scanTorchOn}]})
    .then(function(){
      var tb=document.getElementById('scan-torch');
      if(tb) tb.textContent = scanTorchOn ? 'Turn off light' : 'Turn on light';
    })
    .catch(function(){ scanTorchOn=!scanTorchOn; });
}

// ---- Validación + confirmación centralizada (ambos motores pasan por aquí) ----
// Acepta cualquier código razonable (numérico o alfanumérico). Se descartan
// lecturas basura muy cortas. El apuntar-al-centro + confirmar-2-veces son los
// que evitan leer el código equivocado, no el formato.
function scanValidate(v){
  var s = String(v||'').trim();
  return (s.length>=4 && s.length<=64) ? s : null;
}

// value: texto decodificado. box/vw/vh: caja del código y tamaño del vídeo
// (solo el motor nativo los pasa) para exigir que esté en el centro.
function handleRawScan(value, box, vw, vh){
  var code = scanValidate(value);
  if(!code) return;                       // no es un UPC/EAN válido

  // Apuntar al centro: la caja debe caer dentro del 60% central
  if(box && vw && vh){
    var cx = box.x + box.width/2, cy = box.y + box.height/2;
    var inCenter = cx > vw*0.2 && cx < vw*0.8 && cy > vh*0.2 && cy < vh*0.8;
    if(!inCenter){ setScanMsg('Move the barcode into the center frame'); return; }
  }

  // Confirmar por repetición: mismo valor 2 veces seguidas
  if(code === scanLast){ scanHits++; } else { scanLast = code; scanHits = 1; }
  if(scanHits < SCAN_CONFIRM){ setScanMsg('Reading… hold steady'); return; }

  onScanResult(code);
}

// ---- Motor 1: BarcodeDetector nativo (Android) ----
function startNativeScan(){
  navigator.mediaDevices.getUserMedia({video:scanVideoConstraints()})
    .then(function(stream){
      scanStream = stream;
      var v = document.getElementById('scan-video');
      v.srcObject = stream;
      v.play();
      setupTrackControls(stream.getVideoTracks()[0]);
      scanDetector = new window.BarcodeDetector();   // sin restricción: lee todos los formatos
      scanTimer = setInterval(scanTick, 300);
    })
    .catch(scanCameraError);
}

function scanTick(){
  var v = document.getElementById('scan-video');
  if(!v || !scanDetector || v.readyState !== 4) return;
  scanDetector.detect(v).then(function(codes){
    if(!codes || !codes.length) return;
    var vw = v.videoWidth, vh = v.videoHeight, cx0 = vw/2, cy0 = vh/2;
    // El más cercano al centro del recuadro (evita leer el código de al lado)
    codes.sort(function(a,b){ return boxDist(a.boundingBox,cx0,cy0) - boxDist(b.boundingBox,cx0,cy0); });
    var best = codes[0];
    handleRawScan(best.rawValue, best.boundingBox, vw, vh);
  }).catch(function(){});
}

function boxDist(box, cx0, cy0){
  if(!box) return 1e9;
  var cx = box.x + box.width/2, cy = box.y + box.height/2;
  return Math.abs(cx-cx0) + Math.abs(cy-cy0);
}

// ---- Motor 2: ZXing (iPhone / navegadores sin BarcodeDetector) ----
function startZXingScan(){
  try {
    zxingReader = new window.ZXing.BrowserMultiFormatReader();  // sin hints: lee todos los formatos
    zxingReader.decodeFromConstraints(
      {video:scanVideoConstraints()},
      'scan-video',
      function(result, err){
        if(result) handleRawScan(result.getText ? result.getText() : String(result));
      }
    ).then(function(){
      // El stream ya está en el <video>: toma el track para linterna/enfoque
      var s = document.getElementById('scan-video').srcObject;
      if(s && s.getVideoTracks) setupTrackControls(s.getVideoTracks()[0]);
    }).catch(scanCameraError);
  } catch(e) {
    scanCameraError(e);
  }
}

function closeScanner(){
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
  if(scanTorchOn && scanTrack){ try{ scanTrack.applyConstraints({advanced:[{torch:false}]}); }catch(e){} }
  scanTrack = null; scanTorchOn = false;
  if(scanStream){ scanStream.getTracks().forEach(function(t){ t.stop(); }); scanStream = null; }
  if(zxingReader){ try{ zxingReader.reset(); }catch(e){} zxingReader = null; }
  var v = document.getElementById('scan-video');
  if(v) v.srcObject = null;
  var overlay = document.getElementById('scan-overlay');
  if(overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// Salida manual del overlay: si la cámara no coopera, se escribe el código
function submitManualScan(){
  var v = document.getElementById('scan-manual').value.trim();
  if(!v){ toast('Enter the code'); return; }
  onScanResult(v);   // entrada manual: sin validación de formato (el operador lo decidió)
}

function onScanResult(code){
  closeScanner();
  playAlert('pass');
  var screen = scanScreen || 'weight';
  if(screen==='catalog'){ catalogScanResult(code); return; }
  if(screen==='search'){
    var si=document.getElementById('search-input');
    if(si) si.value=code;
    runSearch();
    return;
  }
  var p = findProduct(code);
  var ids = productIds(screen);
  if(p){
    linkBarcode(p, code);              // recuerda el código para la próxima
    document.getElementById(ids.input).value = p.number;
    onProductInput(screen);
    toast('Scanned: '+p.number);
  } else {
    // Código desconocido: se ofrece crear el producto con ese código guardado
    pendingBarcode = normNumber(code);
    document.getElementById(ids.input).value = '';
    currentProduct = null;
    renderProductCard(screen, '');
    openProductModal(screen);
    toast('New barcode — create the product');
  }
}
