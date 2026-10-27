// ===== FORMA OFICIAL DE GRILLING CHEESE — PDF (SQF # 2.4.D.3.A) =====
// "Pre-Grilling Cheese Verification Form", revision 10/09/2026, diseñada en
// Taller PDF (assets/forms/grilling-form.json). Reemplaza a la forma Word
// (grilling_form_template.docx). Una forma por lote; la hoja 2 (Document
// Control) va fija. La carga y los formatos son de pdf-forms.js.
//
// Lo del laboratorio (pH, Fat, Moisture, quien y cuando) sale de Raw
// Analysis; lo demas, de la ficha de grilling del lote. Lo que todavia no se
// ha hecho se queda en blanco, igual que la forma en papel para el que grilla.

var GRILLING_PDF_TPL = 'assets/forms/grilling-form.json?v=2';   // subir v si cambia la plantilla

// Las correctivas tienen dos renglones: lo que cabe junto al rotulo, y el
// resto en el renglon de abajo. Se mide con las letras del PDF (sin kerning,
// como dibuja el motor) para cortar en una palabra.
function _gcCorrectivas(tpl, txt){
  txt = String(txt || '').replace(/\s+/g, ' ').trim();
  if(!txt) return ['', ''];
  var el = (tpl.pages[0].elements || []).filter(function(e){ return e.value === '{{corrective1}}'; })[0];
  if(!el || !window.jspdf) return [txt, ''];
  var PT = 25.4 / 72, size = el.size || 10, fam = el.font || 'helvetica';
  var doc = new window.jspdf.jsPDF({unit:'mm', format:'letter'});
  var ancho = function(s, bold){ doc.setFont(fam, bold ? 'bold' : 'normal'); return doc.getStringUnitWidth(s, {doKerning:false}) * size * PT; };
  var cabe = el.w - (ancho(el.label || '', el.labelBold) + (el.gap == null ? 2 : el.gap)) - 1;
  var palabras = txt.split(' '), uno = '';
  while(palabras.length){
    var prueba = uno ? uno + ' ' + palabras[0] : palabras[0];
    if(uno && ancho(prueba) > cabe) break;
    uno = prueba; palabras.shift();
  }
  return [uno, palabras.join(' ')];
}

// Los datos con la forma que espera la plantilla (ver sampleData en el JSON)
function grillingPdfDatos(tpl, r, g){
  var f = function(v){ return v ? pdfFecha(v) : ''; };
  var corr = _gcCorrectivas(tpl, g.corrective);
  return {
    lot: r.code || r.sample || '',
    receivedDate: f(g.receivedDate), receivedBy: g.receivedBy || '',
    ph: r.ph || '', fat: r.fat || '', moisture: r.moisture || '',
    testDate: f(r.date), testBy: r.testedBy || '',
    appearance: g.appearance || '', appNote: g.appearanceNote || '',
    texture: g.texture || '', texNote: g.textureNote || '',
    corrective1: corr[0], corrective2: corr[1],
    sensoryDate: f(g.sensoryDate), sensoryBy: g.sensoryBy || '',
    approvedBy: g.approvedBy || '', approvedDate: f(g.approvedAt)
  };
}

function grillingFileName(r){
  var lote = String(r.code || r.sample || 'lot').replace(/[\\/:*?"<>|]/g, '-');
  return 'Pre-Grilling Cheese Verification - ' + lote + '.pdf';
}

// Genera la forma del lote y la entrega (descarga; compartir en iPhone)
function downloadGrillingPdf(rawId){
  var r = (getDB().raw || []).filter(function(x){ return x.id === rawId; })[0];
  if(!r) return;
  var g = (typeof gcExtraOrEmpty === 'function') ? gcExtraOrEmpty(rawId) : {};
  var nombre = grillingFileName(r);

  toast('Building the form…');
  pdfFormListo(GRILLING_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, grillingPdfDatos(tpl, r, g), {title:'SQF 2.4.D.3.A Pre-Grilling Cheese Verification Form'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('Grilling PDF:', doc.templateWarnings);
    return _deliverFile(doc.output('blob'), nombre);
  }).then(function(){
    toast('Form ready ✓');
    logActivity('form', 'Pre-Grilling Cheese form generated',
      nombre + (typeof GC_STAGE_TXT !== 'undefined' ? ' · ' + GC_STAGE_TXT[gcStage(r, g)] : ''),
      (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '—');
  }).catch(function(err){
    console.error('downloadGrillingPdf:', err);
    toast('Could not build the form: ' + err.message);
  });
}
