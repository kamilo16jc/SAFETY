// ===== FORMA OFICIAL DEL PRE-OP 2nd SHIFT — PDF (SQF # 11.2.E.A.1, 1945) =====
// "Daily Pre-Operational Inspection 2nd Shift", diseñada en Taller PDF
// (assets/forms/preop-2nd-form.json). La hoja es SEMANAL: columnas de lunes a
// sabado, una hoja por semana; la linea/area es siempre el departamento 1945.
// La hoja 2 (Change Log) va fija al final. La carga y los formatos son de
// pdf-forms.js.

var PREOP_PDF_TPL = 'assets/forms/preop-2nd-form.json?v=1';   // subir v si cambia la plantilla
var PREOP_DIAS = [{k:'m', label:'M'}, {k:'t', label:'T'}, {k:'w', label:'W'},
                  {k:'th', label:'Th'}, {k:'f', label:'F'}, {k:'s', label:'S'}];

// El lunes de la semana de esa fecha (la forma empieza en lunes)
function preopLunes(iso){
  iso = String(iso || '').slice(0,10);
  var d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? '' : lotMasDias(iso, -((d.getDay() + 6) % 7));
}
// La columna del dia: 0 = lunes … 5 = sabado; el domingo no tiene (-1)
function preopDiaCol(iso){
  var dow = new Date(String(iso).slice(0,10) + 'T12:00:00').getDay();
  return dow === 0 ? -1 : dow - 1;
}

// Lo que va en la celda: ✓ aceptable, ✗ no aceptable, N/A, o la calificacion
function _poCelda(i, v){
  if(!v) return '';
  if(v === 'na') return 'N/A';
  if(i === PREOP_RATE) return String(v);
  return v === 'yes' ? '✓' : v === 'no' ? '✗' : '';
}
// La fila de QA lleva iniciales: un nombre completo se reduce a sus iniciales
function _poIniciales(s){
  s = String(s || '').trim();
  if(s.indexOf(' ') < 0) return s;
  return s.split(/\s+/).map(function(p){ return p.charAt(0).toUpperCase(); }).join('');
}

// Arma las hojas: una por semana, en orden
function preopHojas(lista){
  var grupos = {}, orden = [], domingos = 0;
  (lista || []).forEach(function(r){
    var dia = String(r.date || '').slice(0,10);
    if(!dia) return;
    if(preopDiaCol(dia) < 0){ domingos++; return; }
    var k = preopLunes(dia);
    if(!grupos[k]){ grupos[k] = {lunes: k, recs: []}; orden.push(k); }
    grupos[k].recs.push(r);
  });
  orden.sort();
  var hojas = orden.map(function(k){
    var g = grupos[k], c = [], obs = [], nombres = [], porDia = {};
    // si un dia quedo dos veces, manda el ultimo guardado
    g.recs.slice().sort(function(a, b){ return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id)); })
      .forEach(function(r){ porDia[preopDiaCol(r.date)] = r; });
    for(var i = 0; i <= PREOP_ITEMS.length; i++){
      var fila = {}, notas = [];
      PREOP_DIAS.forEach(function(d, j){
        var r = porDia[j];
        if(!r){ fila[d.k] = ''; return; }
        if(i < PREOP_ITEMS.length){
          fila[d.k] = _poCelda(i, (r.answers || {})[i]);
          var n = (r.notes || {})[i];
          if(n) notas.push(d.label + ': ' + n);
        } else {
          // la ultima fila: iniciales de QA y, en observaciones, los comentarios del dia
          fila[d.k] = _poIniciales(r.verifiedBy);
          if(r.comments) notas.push(d.label + ': ' + r.comments);
        }
      });
      c.push(fila);
      obs.push(notas.join('; '));
    }
    PREOP_DIAS.forEach(function(d, j){
      var who = porDia[j] && String(porDia[j].completedBy || '').trim();
      if(who && nombres.indexOf(who) < 0) nombres.push(who);
    });
    return {
      completedBy: nombres.join(', '),
      dates: pdfFecha(g.lunes) + ' - ' + pdfFecha(lotMasDias(g.lunes, 5)),
      area: PREOP_AREA_PDF, c: c, obs: obs
    };
  });
  return {hojas: hojas, domingos: domingos, claves: orden.map(function(k){ return grupos[k]; })};
}

function _poNombre(arm){
  var lunes = arm.claves.map(function(g){ return g.lunes; }).sort();
  var d1 = lunes[0] || localDateStr(), d2 = lunes[lunes.length - 1] || d1;
  return 'PreOp_2nd_week_' + d1 + (d2 !== d1 ? '_to_' + d2 : '') + '.pdf';
}

// Genera la forma con esas inspecciones y la entrega (descarga; compartir en iPhone)
function downloadPreopPdf(lista){
  var arm = preopHojas(lista);
  if(!arm.hojas.length) return Promise.reject(new Error(arm.domingos ? 'Sunday inspections are not on the weekly form' : 'No inspections'));
  return pdfFormListo(PREOP_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, {hojas: arm.hojas}, {title:'SQF 11.2.E.A.1 1945 Daily Pre-Operational Inspection 2nd Shift'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('Pre-Op PDF:', doc.templateWarnings);
    var nombre = _poNombre(arm);
    return _deliverFile(doc.output('blob'), nombre).then(function(){
      return {nombre: nombre, hojas: arm.hojas.length, domingos: arm.domingos};
    });
  });
}

// ---- Los botones de la forma ----
function sendPreopForm(lista){
  lista = lista || [];
  if(!lista.length){ toast('No Pre-Op inspections for that week'); return; }
  var n = preopHojas(lista).hojas.length;
  if(n > 30 && !confirm('This makes ' + n + ' sheets (one per week). Generate anyway?')) return;
  toast('Building form…');
  downloadPreopPdf(lista).then(function(r){
    toast('Form ready ✓' + (r.hojas > 1 ? ' · ' + r.hojas + ' sheets' : '') +
          (r.domingos ? ' · ' + r.domingos + ' Sunday inspection(s) left out' : ''));
    logActivity('form', 'Pre-Op form generated', r.nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadPreopPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
// La semana de esa fecha
function _preopSemana(fecha){
  var lunes = preopLunes(fecha);
  return (getDB().preop || []).filter(function(r){ return preopLunes(r.date || '') === lunes; });
}
// Pantalla de captura: la semana de la fecha en pantalla
function preopFormFromScreen(){
  sendPreopForm(_preopSemana(_poVal('po-date') || localDateStr()));
}
// Search: la semana de esa fila
function preopFormFor(id){
  var r = (getDB().preop || []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(r) sendPreopForm(_preopSemana(r.date));
}
// Search: todo lo que muestra la busqueda
function searchPreopForm(){
  sendPreopForm((window._srch || {}).preop || []);
}
