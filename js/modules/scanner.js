// ===== BARCODE SCANNER (cámara del teléfono) =====
// Dos motores: el lector nativo del navegador (BarcodeDetector, Android) y
// ZXing (js/vendor/zxing.min.js) para Safari/iPhone, que no lo trae.
// Si la cámara falla, el overlay deja escribir el código a mano.
var scanStream = null, scanTimer = null, scanScreen = null;
var scanDetector = null, zxingReader = null;

function scanNative(){ return typeof window.BarcodeDetector !== 'undefined'; }
function scanZXing(){  return typeof window.ZXing !== 'undefined' && !!window.ZXing.BrowserMultiFormatReader; }
function scanSupported(){ return scanNative() || scanZXing(); }

function openScanner(screen){
  scanScreen = screen;
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
  document.body.style.overflow = 'hidden';
  setScanMsg('Point the camera at the barcode');

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

// ---- Motor 1: BarcodeDetector nativo ----
function startNativeScan(){
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
    .then(function(stream){
      scanStream = stream;
      var v = document.getElementById('scan-video');
      v.srcObject = stream;
      v.play();
      scanDetector = new window.BarcodeDetector();
      scanTimer = setInterval(scanTick, 400);
    })
    .catch(scanCameraError);
}

function scanTick(){
  var v = document.getElementById('scan-video');
  if(!v || !scanDetector || v.readyState !== 4) return;
  scanDetector.detect(v).then(function(codes){
    if(codes && codes.length) onScanResult(codes[0].rawValue);
  }).catch(function(){});
}

// ---- Motor 2: ZXing (iPhone / navegadores sin BarcodeDetector) ----
function startZXingScan(){
  try {
    zxingReader = new window.ZXing.BrowserMultiFormatReader();
    zxingReader.decodeFromConstraints(
      {video:{facingMode:{ideal:'environment'}}},
      'scan-video',
      function(result, err){
        if(result) onScanResult(result.getText ? result.getText() : String(result));
      }
    ).catch(scanCameraError);
  } catch(e) {
    scanCameraError(e);
  }
}

function closeScanner(){
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
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
  onScanResult(v);
}

function onScanResult(code){
  closeScanner();
  playAlert('pass');
  var screen = scanScreen || 'weight';
  if(screen==='catalog'){ catalogScanResult(code); return; }
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
