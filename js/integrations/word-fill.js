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

// Entrega el archivo: se DESCARGA, en la PC y en Android. Solo en iPhone/iPad,
// donde la app instalada no deja descargar, se abre la hoja de compartir
// ("Guardar en Archivos", correo…). Antes se compartia en cualquier equipo que
// lo permitiera y, con los PDF, Windows abria "Compartir" en vez de descargar.
// El tipo sale de la extension (antes todo iba como Word).
function _deliverFile(blob, filename){
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
