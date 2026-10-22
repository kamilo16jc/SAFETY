// ===== FORMA OFICIAL DE PESOS Y BAG SEAL — PDF (SQF 2.4.D.1.1) =====
// "1945 Weight Monitoring & Leak Pointer H20 Quality Check Log", diseñada en
// Taller PDF (assets/forms/weight-seal-form.json). Reemplaza a la forma Word
// (weight_form_template.docx).
//
// Una hoja es un dia de produccion + turno + linea, con 9 chequeos de peso y 9
// de sello: si hay mas (el 2o turno pasa de 9 horas) sale una hoja de
// continuacion. La forma pide UN solo LOT y es siempre el de Caputo de ese dia
// (YYDDD), aunque haya registros con el LOT de un cliente "day first": no se
// separan hojas por LOT. El Document Control Log va una vez, al final.

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

// El dia de produccion de un registro: su fecha, salvo el 2o turno despues de
// medianoche (hasta las 2:00 AM), que sigue siendo el dia en que empezo
function wsDiaProduccion(r){
  var d = String(r.date || '').slice(0,10);
  var hhmm = String(r.time || String(r.date || '').slice(11,16) || '');
  var fin = (typeof SECOND_SHIFT_END === 'number') ? SECOND_SHIFT_END : 120;
  var m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if(d && +r.shift === 2 && m && (+m[1])*60 + (+m[2]) < fin && typeof lotMasDias === 'function') return lotMasDias(d, -1);
  return d;
}
// El LOT de la forma: el de Caputo de ese dia (YYDDD)
function wsLotCaputo(dia){
  return (typeof lotCodigo === 'function' && dia) ? lotCodigo(dia, 'yyddd') : '';
}

// Arma las hojas: una por dia de produccion + turno + linea, de 9 en 9
function wsHojas(weights, seals){
  var grupos = {}, orden = [];
  var clave = function(r){ return [wsDiaProduccion(r), r.shift || '', r.line || ''].join('|'); };
  var nuevo = function(k, r){
    var dia = wsDiaProduccion(r);
    grupos[k] = {dia:dia, shift:r.shift, line:r.line, lot:wsLotCaputo(dia), w:[], s:[], com:[]};
    orden.push(k);
    return grupos[k];
  };
  (weights || []).forEach(function(r){
    var k = clave(r), g = grupos[k] || nuevo(k, r);
    g.w.push(r); g.com.push(r.comments);
  });
  (seals || []).forEach(function(r){
    var k = clave(r), g = grupos[k] || nuevo(k, r);
    g.s.push(r); g.com.push(r.comments);
  });

  var porHora = function(a, b){ return String(a.date || '').localeCompare(String(b.date || '')) ||
                                       String(a.time || '').localeCompare(String(b.time || '')); };
  var relleno = function(lista, vacio){ while(lista.length < WS_POR_HOJA) lista.push(vacio); return lista; };
  var vacioW = wsPeso({}), vacioS = wsSello({});
  vacioW.total = ''; vacioW.avg = '';
  // en orden: dia, turno, linea
  orden.sort(function(a, b){
    var x = grupos[a], y = grupos[b];
    return String(x.dia).localeCompare(String(y.dia)) || (+x.shift||0) - (+y.shift||0) ||
           String(x.line).localeCompare(String(y.line), undefined, {numeric:true});
  });
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

// El nombre dice las fechas y, si es una sola, la linea y el turno
function _wsNombre(hojas){
  var iso = function(f){ var p = String(f||'').split('/'); return p.length === 3 ? p[2]+'-'+p[0]+'-'+p[1] : ''; };
  var fechas = hojas.map(function(h){ return iso(h.date); }).filter(Boolean).sort();
  var d1 = fechas[0] || localDateStr(), d2 = fechas[fechas.length-1] || d1;
  var uno = function(k){ var v = hojas.map(function(h){ return h[k]; }).filter(function(x, i, a){ return a.indexOf(x) === i; }); return v.length === 1 ? v[0] : ''; };
  var linea = uno('line') ? '_L'+uno('line') : '', turno = uno('shift') ? '_'+uno('shift') : '';
  return 'Weight_Seal_'+d1+(d2 !== d1 ? '_to_'+d2 : '')+linea+turno+'.pdf';
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

// ---- El botón de la forma (Search): con los pesos y sellos que muestra ----
function sendWeightSealForm(weights, seals){
  weights = weights || []; seals = seals || [];
  if(!weights.length && !seals.length){ toast('No weight or bag seal records in this search'); return; }
  var n = wsHojas(weights, seals).length;
  if(n > 30 && !confirm('This makes '+n+' sheets (one per date, shift, line and LOT). Generate anyway?')) return;
  toast('Building form…');
  downloadWeightSealPdf(weights, seals).then(function(r){
    toast('Form ready ✓' + (r.hojas > 1 ? ' · '+r.hojas+' sheets' : ''));
    logActivity('form', 'Official form generated', r.nombre, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadWeightSealPdf:', e);
    toast('Could not build the form: ' + e.message);
  });
}
