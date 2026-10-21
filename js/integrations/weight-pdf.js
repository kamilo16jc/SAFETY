// ===== FORMA OFICIAL DE PESOS Y BAG SEAL — PDF (SQF 2.4.D.1.1) =====
// "1945 Weight Monitoring & Leak Pointer H20 Quality Check Log", diseñada en
// Taller PDF (assets/forms/weight-seal-form.json). Reemplaza a la forma Word
// (weight_form_template.docx).
//
// Una hoja es una fecha + turno + linea + LOT, con 9 chequeos de peso y 9 de
// sello: si hay mas (el 2o turno pasa de 9 horas) o cambia el LOT, sale otra
// hoja. El Document Control Log va una vez, al final.

var WEIGHT_PDF_TPL = 'assets/forms/weight-seal-form.json?v=1';   // subir v si cambia la plantilla
var WS_POR_HOJA = 9;

function _wsDos(n){ return (n === '' || n == null || isNaN(n)) ? '' : (Math.round(n*100)/100).toFixed(2); }

// Una columna de pesos
function wsPeso(r){
  var vals = r.vals || [], col = {
    pkg: r.pkgLabel || '', time: pdfHora(r.time), total: '', avg: '', ini: r.initials || ''
  };
  // las muestras con dos decimales, como se pesan (5.00, no 5)
  for(var k = 0; k < 5; k++){
    var v = vals[k], n = parseFloat(v);
    col['s'+(k+1)] = (v == null || v === '') ? '' : (isNaN(n) ? String(v) : n.toFixed(2));
  }
  // un issue de linea (sin pesos) no lleva total ni promedio
  if(!r.issue){
    var nums = vals.map(function(v){ return parseFloat(v); }).filter(function(n){ return !isNaN(n); });
    if(nums.length){
      var suma = nums.reduce(function(a, b){ return a + b; }, 0);
      col.total = _wsDos(suma);
      col.avg = _wsDos(r.avg != null && !isNaN(r.avg) ? +r.avg : suma / nums.length);
    }
  }
  return col;
}
// Una columna de sellos
function wsSello(r){
  var c = r.checks || {};
  var m = function(v){ return v === 'pass' ? 'PASS' : v === 'fail' ? 'FAIL' : ''; };
  return {time: pdfHora(r.time), visual: m(c['Visual']), dunk: m(c['Dunk Tank']),
          printing: m(c['Printing']), ini: r.initials || ''};
}

// Las notas (comentarios de esos registros) en las tres lineas de la forma
function wsNotas(lista){
  var vistos = {}, txt = lista.filter(function(x){
    x = String(x||'').trim();
    if(!x || vistos[x]) return false;
    vistos[x] = 1; return true;
  }).join(' · ');
  var lineas = ['', '', ''], i = 0, MAX = 115;
  txt.split(/\s+/).forEach(function(p){
    if(!p) return;
    if(i < 3 && lineas[i] && (lineas[i] + ' ' + p).length > MAX) i++;
    if(i < 3) lineas[i] = lineas[i] ? lineas[i] + ' ' + p : p;
    else if(!/…$/.test(lineas[2])) lineas[2] = lineas[2].replace(/\s*\S*$/, '') + ' …';
  });
  return lineas;
}

// Arma las hojas: una por fecha + turno + linea + LOT, de 9 en 9
function wsHojas(weights, seals){
  var grupos = {}, orden = [];
  var dia = function(r){ return String(r.date || '').slice(0,10); };
  var clave = function(r){ return [dia(r), r.shift || '', r.line || '', String(r.lot || '').trim()].join('|'); };
  var nuevo = function(k, r){
    grupos[k] = {dia:dia(r), shift:r.shift, line:r.line, lot:String(r.lot || '').trim(), w:[], s:[], com:[]};
    orden.push(k);
    return grupos[k];
  };
  (weights || []).forEach(function(r){
    var k = clave(r), g = grupos[k] || nuevo(k, r);
    g.w.push(r); g.com.push(r.comments);
  });
  (seals || []).forEach(function(r){
    var k = clave(r);
    // un sello sin LOT va con los pesos de esa linea y turno, si son de un solo LOT
    if(!grupos[k] && !String(r.lot || '').trim()){
      var mismos = orden.filter(function(x){
        var g = grupos[x];
        return g.dia === dia(r) && String(g.shift) === String(r.shift) && String(g.line) === String(r.line);
      });
      if(mismos.length === 1) k = mismos[0];
    }
    var g = grupos[k] || nuevo(k, r);
    g.s.push(r); g.com.push(r.comments);
  });

  var porHora = function(a, b){ return String(a.date || '').localeCompare(String(b.date || '')) ||
                                       String(a.time || '').localeCompare(String(b.time || '')); };
  var relleno = function(lista, vacio){ while(lista.length < WS_POR_HOJA) lista.push(vacio); return lista; };
  var vacioW = wsPeso({}), vacioS = wsSello({});
  vacioW.total = ''; vacioW.avg = '';
  var hojas = [];
  orden.forEach(function(k){
    var g = grupos[k];
    g.w.sort(porHora); g.s.sort(porHora);
    var n = Math.max(1, Math.ceil(g.w.length / WS_POR_HOJA), Math.ceil(g.s.length / WS_POR_HOJA));
    for(var p = 0; p < n; p++){
      hojas.push({
        lot: g.lot,
        date: pdfFecha(g.dia),
        shift: +g.shift === 1 ? '1st' : +g.shift === 2 ? '2nd' : (g.shift || ''),
        line: g.line ? String(g.line) : '',
        w: relleno(g.w.slice(p*WS_POR_HOJA, (p+1)*WS_POR_HOJA).map(wsPeso), vacioW),
        s: relleno(g.s.slice(p*WS_POR_HOJA, (p+1)*WS_POR_HOJA).map(wsSello), vacioS),
        notes: p === 0 ? wsNotas(g.com) : ['', '', '']
      });
    }
  });
  return hojas;
}

function _wsNombre(hojas){
  var h = hojas[0] || {}, d = String(rptFilters.date || '').slice(0,10);
  if(!d && h.date){ var p = h.date.split('/'); d = p[2]+'-'+p[0]+'-'+p[1]; }
  var linea = (rptFilters.line && rptFilters.line !== 'all') ? '_L'+rptFilters.line : '';
  var turno = rptFilters.shift === '1' ? '_1st' : rptFilters.shift === '2' ? '_2nd' : '';
  return 'Weight_Seal_'+(d || localDateStr())+linea+turno+'.pdf';
}

// Genera la forma con lo que muestra Reports (sus filtros) y la entrega
function downloadWeightSealPdf(weights, seals){
  var hojas = wsHojas(weights, seals);
  return pdfFormListo(WEIGHT_PDF_TPL).then(function(tpl){
    return PdfTemplate.render(tpl, {hojas:hojas}, {title:'SQF 2.4.D.1.1 Weight Monitoring & Leak Pointer H20 Quality Check Log'});
  }).then(function(doc){
    if(doc.templateWarnings && doc.templateWarnings.length) console.warn('Weight PDF:', doc.templateWarnings);
    var nombre = _wsNombre(hojas);
    return _deliverFile(doc.output('blob'), nombre).then(function(){ return {nombre:nombre, hojas:hojas.length}; });
  });
}

// ---- Reports: el botón de la forma oficial de pesos y bag seal ----
function sendWeightSealForm(){
  if(!rptWeightResults.length && !rptSealResults.length){ toast('No records for the selected filters'); return; }
  toast('Building form…');
  downloadWeightSealPdf(rptWeightResults, rptSealResults).then(function(r){
    toast('Form ready ✓' + (r.hojas > 1 ? ' · '+r.hojas+' sheets' : ''));
    logActivity('form', 'Official form generated', r.nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadWeightSealPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
