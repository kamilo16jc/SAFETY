// ===== FORMA OFICIAL GMP — PDF (SQF 2.5.D.A Daily GMP Facility Audit) =====
// La forma se diseñó en Taller PDF (assets/forms/gmp-audit-form.json) y la
// dibuja su propio motor (js/vendor/pdf-template.js) con jsPDF 2.5.1. Aquí
// solo se arman los datos: el registro GMP y las lecturas de Temp & Humidity
// de ese día y turno. Reemplaza al llenado del Excel (gmp_form_template.xlsm).
//
// jsPDF, el motor y la plantilla (casi 500 KB por el logo) se cargan al
// generar la primera forma, no al abrir la app.

var GMP_PDF_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var GMP_PDF_TPL   = 'assets/forms/gmp-audit-form.json?v=1';   // subir v si cambia la plantilla
var _gmpPdfTpl = null;

function _gmpScript(src, listo){
  return new Promise(function(ok, mal){
    if(listo()) return ok();
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ listo() ? ok() : mal(new Error('No se cargó '+src)); };
    s.onerror = function(){ mal(new Error('No se pudo cargar '+src.split('/').pop()+' (¿sin conexión?)')); };
    document.head.appendChild(s);
  });
}
function _gmpPdfListo(){
  return _gmpScript(GMP_PDF_JSPDF, function(){ return !!(window.jspdf && window.jspdf.jsPDF); })
    .then(function(){ return _gmpScript('js/vendor/pdf-template.js', function(){ return !!window.PdfTemplate; }); })
    .then(function(){
      if(_gmpPdfTpl) return _gmpPdfTpl;
      return fetch(GMP_PDF_TPL).then(function(r){
        if(!r.ok) throw new Error('No se encontró la plantilla GMP');
        return r.json();
      }).then(function(t){ _gmpPdfTpl = t; return t; });
    });
}

function _gmpFecha(iso){
  var p = String(iso||'').slice(0,10).split('-');
  return p.length === 3 ? p[1]+'/'+p[2]+'/'+p[0] : String(iso||'');
}
function _gmpHora(hhmm){
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm||''));
  if(!m) return String(hhmm||'');
  var h = +m[1], ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h+':'+m[2]+' '+ap;
}

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

// ---- Reports: el GMP del día filtrado, con sus lecturas de ese turno ----
function sendGmpForm(){
  if(!rptGmpResults.length){ toast('No GMP audits for the selected date'); return; }
  var g = rptGmpResults[rptGmpResults.length - 1];   // la auditoría más reciente del filtro
  var dia = String(g.date || rptFilters.date || '').slice(0,10);
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
