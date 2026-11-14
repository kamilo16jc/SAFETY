// ===== UTILIDADES COMPARTIDAS DE LAS FORMAS =====
// Antes aqui vivia la forma Word de pesos y bag seal; desde el 21 oct 2026 las
// formas de pesos, GMP y metal detector son PDF (weight-pdf.js, gmp-pdf.js,
// metal-pdf.js). Queda la entrega del archivo, que usan todas.

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var FILE_MIME = {
  pdf:  'application/pdf',
  docx: DOCX_MIME,
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12'
};
function _fileMime(nombre){
  return FILE_MIME[String(nombre || '').split('.').pop().toLowerCase()] || 'application/octet-stream';
}

// Descarga clásica (escritorio / Android): <a download> + blob URL.
function _downloadAnchor(blob, filename){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}

// iPhone / iPad (el iPad nuevo se presenta como Mac, pero con pantalla tactil)
function _esIOS(){
  var ua = navigator.userAgent || '';
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// ---- Imprimir en vez de bajar ----
// La impresora (Search en todos los modulos, 13 nov 2026; antes solo Grilling)
// arma la MISMA forma y abre el dialogo de imprimir, sin bajar el archivo: el
// PDF se carga en un marco escondido y se imprime desde ahi (el dialogo trae
// tambien "Guardar como PDF"). En el telefono no hay visor de PDF en la
// pagina: ahi se entrega el archivo como siempre (en iPhone la hoja de
// compartir trae "Imprimir").
//
// nxImprimir(fn) llama a la funcion de la forma (la misma del boton PDF) con
// un aviso puesto; _deliverFile lo toma y, en vez de bajar, imprime. Si la
// funcion devuelve su promesa el aviso se quita al terminar; si sale antes
// (no hay registros) se quita de una vez. Por si acaso, vence solo.
var _nxImprimirHasta = 0, _nxMarco = null;
function nxImprimeEnPagina(){ return !_esIOS() && !/Android/i.test(navigator.userAgent || ''); }
function nxTomarImpresion(){
  if(!(_nxImprimirHasta > Date.now())) return false;
  _nxImprimirHasta = 0;
  return nxImprimeEnPagina();
}
function nxImprimir(fn){
  _nxImprimirHasta = Date.now() + 90000;
  var fin = function(){ _nxImprimirHasta = 0; };
  var p;
  try { p = fn(); } catch(e){ fin(); throw e; }
  if(!p || typeof p.then !== 'function'){ fin(); return p; }
  return p.then(function(r){ fin(); return r; }, function(e){ fin(); throw e; });
}
function nxImprimirBlob(blob){
  return new Promise(function(ok, falla){
    if(_nxMarco){ URL.revokeObjectURL(_nxMarco.src); _nxMarco.remove(); _nxMarco = null; }
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    // con tamaño (aunque minimo): escondido con display:none el visor no carga
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;border:0;opacity:0;pointer-events:none';
    var listo = false;
    f.onload = function(){
      setTimeout(function(){
        if(listo) return;
        listo = true;
        try { f.contentWindow.focus(); f.contentWindow.print(); ok(); }
        catch(e){ falla(e); }
      }, 150);
    };
    // Si el navegador esta puesto para bajar los PDF en vez de abrirlos, el
    // marco nunca carga: el archivo ya se bajo
    setTimeout(function(){ if(!listo){ listo = true; ok(); } }, 8000);
    f.src = URL.createObjectURL(blob);
    document.body.appendChild(f);
    _nxMarco = f;
  });
}

// Entrega el archivo: se DESCARGA, en la PC y en Android. Solo en iPhone/iPad,
// donde la app instalada no deja descargar, se abre la hoja de compartir
// ("Guardar en Archivos", correo…). Antes se compartia en cualquier equipo que
// lo permitiera y, con los PDF, Windows abria "Compartir" en vez de descargar.
// El tipo sale de la extension (antes todo iba como Word).
function _deliverFile(blob, filename){
  // la impresora de Search: la misma forma, al dialogo de imprimir
  if(nxTomarImpresion()){
    if(typeof logActivity === 'function')
      logActivity('form', 'Form sent to print', filename, (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '');
    return nxImprimirBlob(blob).then(function(){ return 'printed'; }, function(err){
      // si el navegador no deja imprimir el marco, el PDF en otra pestaña
      console.warn('_deliverFile, marco de impresion:', err);
      window.open(URL.createObjectURL(blob), '_blank');
      return 'opened';
    });
  }
  if(!_esIOS()){
    _downloadAnchor(blob, filename);
    return Promise.resolve('downloaded');
  }
  var file;
  try { file = new File([blob], filename, { type: _fileMime(filename) }); } catch(e){ file = null; }
  if(file && navigator.canShare && navigator.canShare({ files: [file] })){
    return navigator.share({ files: [file], title: filename })
      .then(function(){ return 'shared'; })
      .catch(function(err){
        if(err && err.name === 'AbortError') return 'cancelled'; // el usuario cerró la hoja
        _downloadAnchor(blob, filename); // otro fallo → intentar descarga clásica
        return 'downloaded';
      });
  }
  _downloadAnchor(blob, filename);
  return Promise.resolve('downloaded');
}
