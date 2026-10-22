// ===== FORMA OFICIAL GMP — PDF (SQF 2.5.D.A Daily GMP Facility Audit) =====
// La forma se diseñó en Taller PDF (assets/forms/gmp-audit-form.json) y la
// dibuja su propio motor (js/vendor/pdf-template.js) con jsPDF 2.5.1. Aquí
// solo se arman los datos: el registro GMP y las lecturas de Temp & Humidity
// de ese día y turno. Reemplaza al llenado del Excel (gmp_form_template.xlsm).
//
// jsPDF, el motor y la plantilla (casi 500 KB por el logo) se cargan al
// generar la primera forma, no al abrir la app.

var GMP_PDF_TPL = 'assets/forms/gmp-audit-form.json?v=2';   // subir v si cambia la plantilla

// La carga (jsPDF, motor, plantilla) y los formatos son de pdf-forms.js
function _gmpPdfListo(){ return pdfFormListo(GMP_PDF_TPL); }
function _gmpFecha(iso){ return pdfFecha(iso); }
function _gmpHora(hhmm){ return pdfHora(hhmm); }

// Los datos con la forma que espera la plantilla (ver sampleData en el JSON)
function gmpPdfDatos(g, temps){
  var ans = g.answers || {}, notas = g.notes || {};
  var y = [], n = [], c = [];
  var hayNotas = Object.keys(notas).some(function(k){ return String(notas[k]||'').trim(); });
  var primerNo = -1;
  for(var i = 0; i < 21; i++){
    y.push(ans[i] === 'yes');
    n.push(ans[i] === 'no');
    if(ans[i] === 'no' && primerNo < 0) primerNo = i;
    c.push(String(notas[i] || ''));
  }
  // Los registros de antes no tenian accion por renglon: su comentario general
  // va en el primer renglon que salio "No"
  if(!hayNotas && primerNo >= 0 && String(g.comments||'').trim()) c[primerNo] = String(g.comments).trim();
  var cp = {begin:{}, mid:{}, end:{}};
  (temps || []).forEach(function(t){ if(cp[t.checkpoint]) cp[t.checkpoint] = t; });
  var lectura = function(t){
    return {time:_gmpHora(t.time), temp:t.temp||'', chop:t.chop||'', plat:t.plat||'',
            line6:t.line6||'', initials:t.completedBy||''};
  };
  return {
    location: g.location || '',
    date: _gmpFecha(g.date),
    shift: g.shift === 1 ? '1st Shift' : g.shift === 2 ? '2nd Shift' : (g.shift || ''),
    completedBy: g.completedBy || '',
    verifiedBy: g.verifiedBy || '',
    y: y, n: n, c: c,
    begin: lectura(cp.begin), mid: lectura(cp.mid), end: lectura(cp.end)
  };
}

function _gmpPdfNombre(g){
  var d = String(g.date || localDateStr()).slice(0,10);
  return 'GMP_'+d+(g.shift===1 ? '_1st' : g.shift===2 ? '_2nd' : '')+'.pdf';
}

// Genera la forma de un registro y la entrega (descarga o compartir)
function downloadGmpPdf(g, temps){
  return _gmpPdfListo().then(function(tpl){
    return PdfTemplate.render(tpl, gmpPdfDatos(g, temps), {title:'SQF 2.5.D.A Daily GMP Facility Audit'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('GMP PDF:', doc.templateWarnings);
    var nombre = _gmpPdfNombre(g);
    var blob = doc.output('blob');
    return (typeof _deliverFile === 'function' ? _deliverFile(blob, nombre)
                                               : Promise.resolve(doc.save(nombre))).then(function(){ return nombre; });
  });
}

// ---- El botón de la forma (Search, en la fila de cada GMP): ese registro,
// con las lecturas de Temp & Humidity de su día y turno ----
function sendGmpForm(id){
  var g = (getDB().gmps || []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(!g){ toast('GMP audit not found'); return; }
  var dia = String(g.date || '').slice(0,10);
  var temps = (getDB().temps || []).filter(function(t){
    return (!dia || String(t.date || '').slice(0,10) === dia) && (g.shift == null || t.shift === g.shift);
  });
  toast('Building form…');
  downloadGmpPdf(g, temps).then(function(nombre){
    toast('Form ready ✓');
    logActivity('form', 'GMP form generated', nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadGmpPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
