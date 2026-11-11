// ===== LEER LA ETIQUETA DE UN PRODUCTO (una sola foto) =====
// Producto, LOT y Order de la foto de una etiqueta, sin servicios externos:
// el codigo de barras con ZXing (js/vendor) y el texto con Tesseract, el mismo
// lector del LOT check (js/modules/lot-ocr.js). Todo corre en el telefono.
//
// Afinado con las 209 fotos reales del LOT check de Weights (16 oct - 10 nov
// 2026, 43 productos; las fotos viven fuera del repo y no se publican):
//
//  PRODUCTO, en este orden (el primero que sale manda):
//   1. Codigo de barras registrado en el catalogo (UPC de la bolsa, ITF-14 de
//      la caja). Nunca dio un producto equivocado.
//   2. UPC de Caputo: 0 10096 PPPPP C, donde PPPPP es el numero de producto
//      (55 de los 56 UPC de Caputo del catalogo lo cumplen).
//   3. Texto: "10096 PPPPP" bajo el codigo, letras pegadas al numero
//      (codigo del distribuidor + numero, ABCDEF01234), "#01234" o "#1234".
//      Solo vale un numero que exista en el catalogo.
//  LOT: la regla juliana de lot-ocr.js (YYDDD / DDDYY cerca de la fecha). Si
//   el que se lee no es el de hoy, ayer o el dia siguiente, se marca para
//   revisar: una tinta debil hizo leer 26292 donde decia 26295.
//  ORDER: en la etiqueta de Caputo, el numero de 8 digitos junto al LOT
//   (00577346 = Order 577346, comprobado contra Sample Analysis). 22222222 es
//   el relleno de cuando no hay orden y no cuenta.

var _lrLector = null;
function lrLector(){
  if(_lrLector) return _lrLector;
  if(!window.ZXing || !ZXing.MultiFormatReader) return null;
  var F = ZXing.BarcodeFormat, H = ZXing.DecodeHintType;
  var hints = new Map();
  // Solo codigos lineales: el QR de la bolsa de Caputo (la pagina web) tapaba
  // al UPC, porque el lector se queda con el primero que encuentra. Sin EAN-8
  // ni UPC-E (nadie los usa aqui y daban pedazos de otro codigo) y el ITF solo
  // de 14 (el de la caja): con 12 leia el de la caja a medias.
  hints.set(H.POSSIBLE_FORMATS, [F.UPC_A, F.EAN_13, F.ITF, F.CODE_128, F.CODE_39]);
  hints.set(H.ALLOWED_LENGTHS, [14]);
  hints.set(H.TRY_HARDER, true);
  var r = new ZXing.MultiFormatReader();
  r.setHints(hints);
  _lrLector = r;
  return r;
}

// Un pedazo de la foto (x, y, ancho, alto en fraccion), a lo mas `lado` px
function _lrRecorte(img, fx, fy, fw, fh, lado){
  var sx = img.width*fx, sy = img.height*fy, sw = img.width*fw, sh = img.height*fh;
  var k = Math.min(2, lado / Math.max(sw, sh));
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(sw*k)); cv.height = Math.max(1, Math.round(sh*k));
  var cx = cv.getContext('2d', {willReadFrequently:true});
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv;
}
function _lrDecodificar(cv){
  var r = lrLector();
  if(!r) return null;
  var probar = function(bin){
    try {
      var src = new ZXing.HTMLCanvasElementLuminanceSource(cv);
      var res = r.decodeWithState(new ZXing.BinaryBitmap(new bin(src)));
      return res && lrCodigoValido(String(res.getText()), res.getBarcodeFormat()) ? String(res.getText()) : null;
    } catch(e){ return null; }          // NotFound / Checksum / Format: no habia codigo
  };
  return probar(ZXing.HybridBinarizer) || probar(ZXing.GlobalHistogramBinarizer);
}
// Digito verificador GS1 (UPC, EAN, ITF-14): el ultimo cuadra con los demas
function lrDigitoOk(d){
  if(!/^\d{8,14}$/.test(d)) return false;
  var suma = 0, n = d.length - 1;
  for(var i=0;i<n;i++) suma += (+d[n-1-i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - suma % 10) % 10 === +d[n];
}
// Un codigo completo y no un pedazo: el ITF es el de la caja (14, con su
// verificador); los Code 128 / 39 sueltos de pocos caracteres no sirven
function lrCodigoValido(t, fmt){
  var F = ZXing.BarcodeFormat;
  if(fmt === F.ITF) return t.length === 14 && lrDigitoOk(t);
  if(fmt === F.CODE_128 || fmt === F.CODE_39) return t.replace(/[^0-9A-Za-z]/g, '').length >= 8;
  return true;                           // UPC-A / EAN-13: ZXing ya valida el verificador
}
// Los codigos de barras de la foto. ZXing da uno por intento, asi que se
// prueba la foto entera y luego por franjas (un codigo chico se ve mas grande
// en su franja). Para en cuanto uno da el producto.
function lrCodigos(img, basta){
  var vistos = [], intentos = [
    [0, 0, 1, 1, 1600],
    [0, 0, 1, 0.5, 1600], [0, 0.5, 1, 0.5, 1600], [0, 0.25, 1, 0.5, 1600],
    [0, 0, 1, 0.36, 1800], [0, 0.32, 1, 0.36, 1800], [0, 0.64, 1, 0.36, 1800],
    [0, 0, 0.5, 1, 1600], [0.5, 0, 0.5, 1, 1600]
  ];
  for(var i=0;i<intentos.length;i++){
    var t = intentos[i];
    var c = _lrDecodificar(_lrRecorte(img, t[0], t[1], t[2], t[3], t[4]));
    if(c && vistos.indexOf(c) < 0){
      vistos.push(c);
      if(basta && basta(c)) break;
    }
  }
  return vistos;
}

// ---- GS1-128 (etiqueta de caja de algunos proveedores) ----
// (01) GTIN, (10) lote, (11) produccion, (13) empaque, (15)/(17) caducidad,
// (3xxx) peso. Sin parentesis, con o sin separador FNC1 (\x1d).
var LR_AI_FIJO = {'00':18, '01':14, '02':14, '11':6, '12':6, '13':6, '15':6, '16':6, '17':6, '20':2};
function lrGS1(texto){
  var s = String(texto || '').replace(/^\]C1/, '').replace(/[()]/g, '');
  if(!/^(00|01|02)\d/.test(s) || s.replace(/\x1d/g, '').length < 18) return null;
  var out = {}, i = 0, n = 0;
  while(i < s.length && n++ < 12){
    if(s[i] === '\x1d'){ i++; continue; }
    var a2 = s.substr(i, 2), a4 = s.substr(i, 4);
    if(LR_AI_FIJO[a2]){ out[a2] = s.substr(i+2, LR_AI_FIJO[a2]); i += 2 + LR_AI_FIJO[a2]; continue; }
    if(/^3[1-6]\d\d$/.test(a4)){ out[a4] = s.substr(i+4, 6); i += 10; continue; }
    if(a2 === '10' || a2 === '21' || a2 === '22'){
      var fin = s.indexOf('\x1d', i+2); if(fin < 0) fin = s.length;
      out[a2] = s.slice(i+2, fin); i = fin; continue;
    }
    break;
  }
  return out['01'] || out['00'] ? out : null;
}

// ---- El producto ----
function _lrNumeros(){
  var m = {};
  (typeof getProducts === 'function' ? getProducts() : []).forEach(function(p){
    var d = String(p.number || '').replace(/\D/g, '');
    if(d) m[d.length < 5 ? ('00000'+d).slice(-5) : d] = p;
  });
  return m;
}
function lrProductoDeCodigo(codigo){
  var raw = String(codigo || '');
  var g = lrGS1(raw);
  var d = raw.replace(/\D/g, '');
  if(d.length < 8) return null;                         // lecturas cortas sueltas: no
  var buscar = function(x){ return (x && typeof findProduct === 'function') ? findProduct(x) : null; };
  // 1. registrado en el catalogo (tal cual, o el UPC leido como EAN-13 con un 0 delante)
  // de un GS1 solo sirve el GTIN: lo demas (lote, fechas) cambia en cada etiqueta
  if(g && g['01']) d = g['01'];
  var p = buscar(d) || (d.length === 13 && d[0] === '0' ? buscar(d.slice(1)) : null);
  if(p) return {producto:p, numero:p.number, como:'barcode', codigo:d, gs1:g};
  // 2. UPC de Caputo: 0 10096 PPPPP C
  var m = d.match(/^0?010096(\d{5})\d$/);
  if(m){
    var q = _lrNumeros()[m[1]] || null;
    return {producto:q, numero:q ? q.number : m[1], como:'upc', codigo:d, gs1:g};
  }
  return {producto:null, numero:'', como:'unknown', codigo:d, gs1:g};
}
// El numero de producto escrito en la etiqueta. `lot` se descarta (no es un producto).
function lrProductoDeTexto(texto, lot){
  var t = String(texto || '').toUpperCase()
    .replace(/(\d)[O]/g, '$10').replace(/[O](\d)/g, '0$1')
    .replace(/(\d)[IL|]/g, '$11').replace(/[IL|](\d)/g, '1$1');
  var nums = _lrNumeros(), c = [], m, re;
  var poner = function(rango, n){ if(nums[n] && n !== lot) c.push({r:rango, n:n}); };
  re = /1\s?0\s?0\s?9\s?6\s*(\d)\s?(\d)\s?(\d)\s?(\d)\s?(\d)/g;          // bajo el UPC de Caputo
  while((m = re.exec(t))) poner(1, m[1]+m[2]+m[3]+m[4]+m[5]);
  re = /[A-Z]{2,}\s?(\d{5})(?!\d)/g;                                      // ABCDEF01234
  while((m = re.exec(t))) poner(2, m[1]);
  re = /#\s?(\d{4,5})(?!\d)/g;                                            // #01234, #1234
  while((m = re.exec(t))) poner(3, ('0'+m[1]).slice(-5));
  if(!c.length) return null;
  var mejor = Math.min.apply(null, c.map(function(x){ return x.r; }));
  var top = c.filter(function(x){ return x.r === mejor; }).map(function(x){ return x.n; })
             .filter(function(n, i, a){ return a.indexOf(n) === i; });
  if(top.length !== 1) return null;                                       // dos distintos: que elija QA
  return {producto:nums[top[0]], numero:nums[top[0]].number, como:'text'};
}

// ---- El Order (etiqueta de Caputo) ----
function lrOrder(texto){
  var t = String(texto || '').replace(/(\d)[Oo]/g, '$10').replace(/[Oo](\d)/g, '0$1');
  var m, re = /(^|\D)00([1-9]\d{5})(?!\d)/g, vistos = [];
  while((m = re.exec(t))){
    if(/2{5,}/.test(m[2])) continue;                                      // 22222222 = sin orden
    if(vistos.indexOf(m[2]) < 0) vistos.push(m[2]);
    re.lastIndex = m.index + 1;
  }
  return vistos.length === 1 ? vistos[0] : '';
}

// ---- Todo junto ----
// img: imagen ya cargada (ImageBitmap o <img>). refStr: la fecha del registro.
// Devuelve {producto, numero, comoProducto, codigo, lot, lotInfo, lotRevisar,
//           comoLot, order, codigos[]}
function leerEtiqueta(img, refStr){
  var out = {producto:null, numero:'', comoProducto:'', codigo:'', lot:'', lotInfo:null,
             lotRevisar:false, comoLot:'', order:'', codigos:[]};
  var desconocido = '';
  out.codigos = lrCodigos(img, function(c){
    var x = lrProductoDeCodigo(c);
    if(x && x.numero){
      out.producto = x.producto; out.numero = x.numero; out.comoProducto = x.como; out.codigo = x.codigo;
      var lg = x.gs1 && x.gs1['10'] && typeof lotInfo === 'function' ? lotInfo(lotLimpio(x.gs1['10']), refStr) : null;
      if(lg){ out.lotInfo = lg; out.comoLot = 'barcode'; }
      return true;
    }
    if(x && x.codigo && !desconocido) desconocido = x.codigo;
    return false;
  });
  if(!out.numero && desconocido){ out.codigo = desconocido; out.comoProducto = 'unknown'; }

  return lotMotor().then(function(w){
    return w.setParameters({tessedit_pageseg_mode: '11'})
      .then(function(){ return w.recognize(_lotLienzo(img, 0, 'gris')); })
      .then(function(r){ return (r && r.data && r.data.text) || ''; });
  }).then(function(texto){
    if(!out.lotInfo){
      var l = _lotDelTexto(texto, refStr);
      if(l){ out.lotInfo = l; out.comoLot = 'photo'; }
    }
    if(!out.numero){
      var p = lrProductoDeTexto(texto, out.lotInfo ? out.lotInfo.lot : '');
      if(p){ out.producto = p.producto; out.numero = p.numero; out.comoProducto = 'text'; }
    }
    out.order = lrOrder(texto);
    // El LOT que no salio de la foto derecha: girada, en blanco y negro, de cerca
    if(out.lotInfo) return null;
    return lotLeer(img, refStr).then(function(l){ if(l){ out.lotInfo = l; out.comoLot = 'photo'; } });
  }).then(function(){
    var l = out.lotInfo;
    if(l){
      out.lot = l.lot;
      // de hoy, de ayer (turno de noche) o del dia siguiente (Next day): bien;
      // lo demas se pone pero marcado para que QA lo mire
      out.lotRevisar = !(l.ok || l.dias === -1);
    }
    return out;
  });
}
