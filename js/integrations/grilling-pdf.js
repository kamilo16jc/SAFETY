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

function _gcQuien(){ return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '—'; }

// El lote, su ficha de grilling y el PDF armado (promesa del Blob)
function _gcLote(rawId){
  var r = (getDB().raw || []).filter(function(x){ return x.id === rawId; })[0];
  if(!r) return null;
  var g = (typeof gcExtraOrEmpty === 'function') ? gcExtraOrEmpty(rawId) : {};
  return {r:r, g:g, nombre:grillingFileName(r)};
}
function _gcPdfBlob(L){
  return pdfFormListo(GRILLING_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, grillingPdfDatos(tpl, L.r, L.g), {title:'SQF 2.4.D.3.A Pre-Grilling Cheese Verification Form'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('Grilling PDF:', doc.templateWarnings);
    return doc.output('blob');
  });
}

// Genera la forma del lote y la entrega (descarga; compartir en iPhone)
function downloadGrillingPdf(rawId){
  var L = _gcLote(rawId);
  if(!L) return;
  toast('Building the form…');
  _gcPdfBlob(L).then(function(blob){
    return _deliverFile(blob, L.nombre);
  }).then(function(){
    toast('Form ready ✓');
    logActivity('form', 'Pre-Grilling Cheese form generated',
      L.nombre + (typeof GC_STAGE_TXT !== 'undefined' ? ' · ' + GC_STAGE_TXT[gcStage(L.r, L.g)] : ''), _gcQuien());
  }).catch(function(err){
    console.error('downloadGrillingPdf:', err);
    toast('Could not build the form: ' + err.message);
  });
}

// ---- Imprimir de una vez ----
// La impresora de la tabla arma la forma y abre el dialogo de imprimir, sin
// bajar el archivo ni abrirlo. El PDF se carga en un marco escondido y se
// imprime desde ahi. En el telefono no hay visor de PDF en la pagina: ahi se
// entrega el archivo (en iPhone la hoja de compartir trae "Imprimir").
//
// Al cerrar el dialogo se pregunta si la hoja salio bien: el navegador no lo
// sabe. El "si" deja el lote marcado (ver gcPrintedHTML en grilling.js).
var _gcMarco = null;

function _gcImprimeEnPagina(){
  return !(typeof _esIOS === 'function' && _esIOS()) && !/Android/i.test(navigator.userAgent || '');
}

function _gcImprimirBlob(blob){
  return new Promise(function(ok, falla){
    if(_gcMarco){ URL.revokeObjectURL(_gcMarco.src); _gcMarco.remove(); _gcMarco = null; }
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
    // marco nunca carga: el archivo ya se bajo y de todos modos se pregunta
    setTimeout(function(){ if(!listo){ listo = true; ok(); } }, 8000);
    f.src = URL.createObjectURL(blob);
    document.body.appendChild(f);
    _gcMarco = f;
  });
}

function printGrillingPdf(rawId){
  var L = _gcLote(rawId);
  if(!L) return;
  var firma = gcPrintSig(L.r, L.g);          // lo que se manda a imprimir
  toast('Opening the print dialog…');
  _gcPdfBlob(L).then(function(blob){
    if(!_gcImprimeEnPagina()) return _deliverFile(blob, L.nombre);
    return _gcImprimirBlob(blob).catch(function(err){
      // si el navegador no deja imprimir el marco, el PDF en otra pestaña
      console.warn('printGrillingPdf, marco:', err);
      window.open(URL.createObjectURL(blob), '_blank');
    });
  }).then(function(res){
    if(res === 'cancelled') return;          // cerro la hoja de compartir
    logActivity('form', 'Pre-Grilling Cheese form sent to print', L.nombre, _gcQuien());
    _gcPreguntarImpreso(rawId, firma);
  }).catch(function(err){
    console.error('printGrillingPdf:', err);
    toast('Could not build the form: ' + err.message);
  });
}

// Queda detras del dialogo de imprimir y se ve al cerrarlo
function _gcPreguntarImpreso(rawId, firma){
  var L = _gcLote(rawId);
  if(!L) return;
  showGuardModal({
    icon:'print',
    title:'Did the form print OK?',
    detail:'Pre-Grilling Cheese Verification · Lot ' + (L.r.code || L.r.sample || '—'),
    ask:'Check the sheet. If it came out complete and readable, mark it as printed.',
    primaryLabel:'Yes, it printed OK',
    onPrimary:function(){ closeDupModal(); markGrillingPrinted(rawId, firma); },
    secondaryLabel:'It did not print',
    onSecondary:function(){ closeDupModal(); toast('Not marked · use the printer button to try again'); }
  });
}

function markGrillingPrinted(rawId, firma){
  var db = getDB();
  var g = gcEnsure(db, rawId);
  var r = (db.raw || []).filter(function(x){ return x.id === rawId; })[0] || {};
  g.printedAt = localISOStr();
  g.printedBy = _gcQuien();
  g.printedSig = firma || gcPrintSig(r, g);
  g.printCount = (g.printCount || 0) + 1;
  saveDB(db, 'grilling');
  if(window.saveToFirebase) window.saveToFirebase('grilling', g);
  logActivity('form', 'Pre-Grilling Cheese form printed OK', grillingFileName(r), g.printedBy);
  gcRefreshPrinted(rawId, r, g);
  toast('Marked as printed ✓');
}
