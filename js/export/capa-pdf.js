// ===== FORMA OFICIAL DEL INCIDENT & CAPA REPORT — PDF (SQF 2.5.C.2) =====
// Diseñada en Taller PDF (assets/forms/capa-report-form.json). Reemplaza a la
// réplica en HTML que se abría para "Save as PDF". La carga y los formatos son
// de js/integrations/pdf-forms.js. La hoja 2 (Document Control Log) va fija.

var CAPA_PDF_TPL = 'assets/forms/capa-report-form.json?v=1';   // subir v si cambia la plantilla

// Un recuadro de la forma: el texto y, si la tiene, su fecha en otro renglón
function _capaConFecha(txt, iso){
  txt = String(txt || '').trim();
  return iso ? (txt ? txt + '\n' : '') + 'Date: ' + pdfFecha(iso) : txt;
}

// Los datos con la forma que espera la plantilla (ver sampleData en el JSON)
function capaPdfDatos(c){
  var problema = [c.problem, c.description].map(function(x){ return String(x || '').trim(); })
                   .filter(Boolean).join('\n');
  return {
    reportNumber: c.reportNumber || '',
    complaint: c.complaint || '',
    capaDate: pdfFecha(c.capaDate),
    item: (c.product || '') + (c.productName ? ' - ' + c.productName : ''),
    lot: c.lot || '',
    severity: c.severity || '',
    problem: problema,
    shortTerm: _capaConFecha(c.shortTerm, c.shortDate),
    longTerm: _capaConFecha(c.longTerm, c.longDate),
    // el primer "Completed By" es quien hizo el reporte; el segundo, quien
    // verificó y cerró la acción de largo plazo
    completedBy: c.completedBy || '',
    completedDate: c.completedBy ? pdfFecha(c.shortDate || c.capaDate) : '',
    verifiedBy: c.verifiedBy || '',
    verifiedDate: c.verifiedBy ? pdfFecha(c.longDate) : ''
  };
}

// El número ya dice CAPA (CAPA-2026-004.pdf); si no lo tiene, va delante
function _capaPdfNombre(c){
  var n = String(c.reportNumber || '').replace(/[^A-Za-z0-9-]/g, '') || String(c.capaDate || localDateStr()).slice(0,10);
  return (/^CAPA/i.test(n) ? n : 'CAPA_' + n) + '.pdf';
}

// Genera la forma de un reporte y la entrega (descarga; compartir en iPhone)
function downloadCapaPdf(c){
  return pdfFormListo(CAPA_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, capaPdfDatos(c), {title:'SQF 2.5.C.2 Incident & CAPA Report'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('CAPA PDF:', doc.templateWarnings);
    var nombre = _capaPdfNombre(c);
    return _deliverFile(doc.output('blob'), nombre).then(function(){ return nombre; });
  });
}

// ---- El botón de la forma: en la pantalla de CAPA (el reporte abierto) y en
// el visor de Search ----
function exportCapaPDF(id){
  var rec = getCapa().filter(function(c){ return String(c.id) === String(id); })[0];
  if(!rec){ toast('Report not found'); return; }
  toast('Building form…');
  downloadCapaPdf(rec).then(function(nombre){
    toast('Form ready ✓');
    logActivity('form', 'CAPA form generated', nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadCapaPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
