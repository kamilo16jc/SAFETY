// ===== BARCODE SCANNER (cámara del teléfono) =====
// Usa el lector de códigos nativo del navegador (BarcodeDetector). Donde no
// existe, el campo de producto sigue funcionando escribiendo o con una
// pistola lectora (que escribe como teclado).
var scanStream = null, scanTimer = null, scanScreen = null, scanDetector = null;

function scanSupported(){
  return typeof window.BarcodeDetector !== 'undefined';
}

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
  var overlay = document.getElementById('scan-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setScanMsg('Point the camera at the barcode');

  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
    .then(function(stream){
      scanStream = stream;
      var v = document.getElementById('scan-video');
      v.srcObject = stream;
      v.play();
      scanDetector = new window.BarcodeDetector();
      scanTimer = setInterval(scanTick, 400);
    })
    .catch(function(e){
      setScanMsg('Could not open the camera: '+(e && e.name ? e.name : 'error'));
    });
}

function setScanMsg(msg){
  var el = document.getElementById('scan-msg');
  if(el) el.textContent = msg;
}

function scanTick(){
  var v = document.getElementById('scan-video');
  if(!v || !scanDetector || v.readyState !== 4) return;
  scanDetector.detect(v).then(function(codes){
    if(codes && codes.length) onScanResult(codes[0].rawValue);
  }).catch(function(){});
}

function closeScanner(){
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
  if(scanStream){ scanStream.getTracks().forEach(function(t){ t.stop(); }); scanStream = null; }
  var v = document.getElementById('scan-video');
  if(v) v.srcObject = null;
  var overlay = document.getElementById('scan-overlay');
  if(overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function onScanResult(code){
  closeScanner();
  playAlert('pass');
  var screen = scanScreen || 'weight';
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
