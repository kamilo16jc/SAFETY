// ===== FORMA OFICIAL DEL METAL DETECTOR — PDF (SQF 11.7.D.8) =====
// "Metal Detection Verification", diseñada en Taller PDF
// (assets/forms/metal-detector-form.json). Reemplaza a la forma Word
// (metal_form_template.docx). La carga y los formatos son de pdf-forms.js.

var METAL_PDF_TPL = 'assets/forms/metal-detector-form.json?v=2';   // subir v si cambia la plantilla

// Los datos con la forma que espera la plantilla (ver sampleData en el JSON):
// a[i] es la respuesta de la pregunta i ('yes' | 'no' | 'na')
function metalPdfDatos(m){
  var ans = m.answers || {}, a = [];
  for(var i = 0; i < 7; i++) a.push(String(ans[i] || ''));
  var fecha = pdfFecha(m.date);
  return {
    date: fecha,
    line: m.line || '',
    start: pdfHora(m.startTime),
    end: pdfHora(m.endTime),
    a: a,
    corrective: m.corrective || '',
    completedBy: m.completedBy || '',
    compDate: m.completedBy ? fecha : '',
    verifiedBy: m.verifiedBy || '',
    verifDate: m.verifiedBy ? fecha : ''
  };
}

function _metalPdfNombre(m){
  var d = String(m.date || localDateStr()).slice(0,10);
  var linea = m.line ? '_MD' + String(m.line).replace(/[^A-Za-z0-9]/g, '') : '';
  return 'MetalDetector_'+d+linea+'.pdf';
}

// Genera la forma de un chequeo y la entrega (descarga; compartir en iPhone)
function downloadMetalPdf(m){
  return pdfFormListo(METAL_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, metalPdfDatos(m), {title:'SQF 11.7.D.8 Metal Detection Verification'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('Metal PDF:', doc.templateWarnings);
    var nombre = _metalPdfNombre(m);
    return _deliverFile(doc.output('blob'), nombre).then(function(){ return nombre; });
  });
}

// ---- El botón de la forma: en Search, el chequeo de esa fila; en la pantalla
// del Metal Detector ("Export form"), el más reciente de la fecha en pantalla ----
function sendMetalForm(id){
  var lista = [];
  if(id != null){
    // desde Search: el registro de esa fila
    lista = (getDB().metal || []).filter(function(x){ return String(x.id) === String(id); });
  } else {
    // desde la pantalla del Metal Detector: el más reciente de la fecha en pantalla
    var dia = (document.getElementById('md-date') || {}).value || localDateStr();
    lista = (getDB().metal || []).filter(function(x){ return String(x.date || '').slice(0,10) === dia; });
  }
  if(!lista.length){ toast('No metal detector checks for the selected date'); return; }
  var m = lista[lista.length - 1];
  toast('Building form…');
  downloadMetalPdf(m).then(function(nombre){
    toast('Form ready ✓');
    logActivity('form', 'Metal detector form generated', nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadMetalPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
