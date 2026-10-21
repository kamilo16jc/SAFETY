// ===== FORMAS OFICIALES EN PDF (plantillas de Taller PDF) =====
// Cada forma es un JSON en assets/forms/ que dibuja su propio motor
// (js/vendor/pdf-template.js) con jsPDF 2.5.1. jsPDF, el motor y la plantilla
// se cargan al generar la primera forma, no al abrir la app.
// Las formas: GMP (gmp-pdf.js) y pesos + bag seal (weight-pdf.js).

var PDF_FORMS_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var _pdfFormsTpl = {};

function _pdfScript(src, listo){
  return new Promise(function(ok, mal){
    if(listo()) return ok();
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ listo() ? ok() : mal(new Error('No se cargó '+src)); };
    s.onerror = function(){ mal(new Error('No se pudo cargar '+src.split('/').pop()+' (¿sin conexión?)')); };
    document.head.appendChild(s);
  });
}

// Deja listo todo para dibujar la plantilla de esa direccion y la devuelve
function pdfFormListo(url){
  return _pdfScript(PDF_FORMS_JSPDF, function(){ return !!(window.jspdf && window.jspdf.jsPDF); })
    .then(function(){ return _pdfScript('js/vendor/pdf-template.js', function(){ return !!window.PdfTemplate; }); })
    .then(function(){
      if(_pdfFormsTpl[url]) return _pdfFormsTpl[url];
      return fetch(url).then(function(r){
        if(!r.ok) throw new Error('No se encontró la plantilla '+url.split('/').pop().split('?')[0]);
        return r.json();
      }).then(function(t){ _pdfFormsTpl[url] = t; return t; });
    });
}

// Las formas van en el formato de la planta: 10/21/2026 y 2:30 PM
function pdfFecha(iso){
  var p = String(iso||'').slice(0,10).split('-');
  return p.length === 3 ? p[1]+'/'+p[2]+'/'+p[0] : String(iso||'');
}
function pdfHora(hhmm){
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm||''));
  if(!m) return String(hhmm||'');
  var h = +m[1], ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h+':'+m[2]+' '+ap;
}
