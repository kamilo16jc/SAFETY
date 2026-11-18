// ===== OPERATIONS: lo comun de sus cuatro funciones =====
// Modulo del piso de produccion (pedido del usuario, 16 nov 2026): asistencia
// de la gente (Attendance), lo que se fabrico de cada producto (Output), los
// paros de las lineas (Downtime) y los reportes de las tres cosas (Reports).
// "Production" se queda con la planeacion (Schedule y COA Orders).
//
// Colecciones (Firestore; los nombres de los empleados viven SOLO alli, nunca
// en el repo):
//   employees   {id, name, empNo, shift:'1'|'2'|'any', area, active}
//   attendance  {id, date, shift, employeeId, name, empNo, area, status, timeIn, timeOut, notes}
//   output      {id, date, shift, line, product, productName, order, ordered, produced, unit, lot, completed, notes, runId}
//   downtime    {id, date, shift, line, start, end, cause, product, productName, what, action, fixedBy}

var OPS_LINES = [1, 2, 3, 4, 5, 6];
var opsVista = {};              // pantalla -> {date, shift} que se aplico con la lupa

function opsQuien(){ return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '—'; }
function opsLista(col){ var d = getDB(); if(!d[col]) d[col] = []; return d[col]; }
function opsBuscar(col, id){
  return opsLista(col).filter(function(r){ return String(r.id) === String(id); })[0] || null;
}
// Guarda en el equipo y en Firestore. Lo ya subido se reescribe en su mismo
// documento (no se duplica); lo nuevo toma su documento la primera vez.
function opsGuardar(col, rec, nuevo){
  var db = getDB();
  if(!db[col]) db[col] = [];
  if(nuevo) db[col].push(rec);
  else { rec.editedAt = localISOStr(); rec.editedBy = opsQuien(); }
  saveDB(db, col);
  if(rec._fbId && window.saveToFirebaseAt) window.saveToFirebaseAt(col, rec._fbId, rec);
  else if(window.saveToFirebase) window.saveToFirebase(col, rec);
}
function opsBorrar(col, id){
  var db = getDB();
  var rec = opsBuscar(col, id);
  db[col] = (db[col] || []).filter(function(r){ return String(r.id) !== String(id); });
  saveDB(db, col);
  if(rec && rec._fbId && window.deleteFromFirebase) window.deleteFromFirebase(col, rec._fbId);
  return rec;
}
function opsPuedeBorrar(){
  if(typeof canDeleteRecords === 'function' && !canDeleteRecords()){
    toast('Your role cannot delete records');
    return false;
  }
  return true;
}
function opsLog(accion, detalle){
  if(typeof logActivity === 'function') logActivity('operations', accion, detalle, opsQuien());
}
// Repintar sin que la hoja salte arriba (feedback del usuario, v174)
function opsRepintar(pantalla, fn){
  var host = document.getElementById(pantalla);
  var vuelve = (typeof nxGuardarScroll === 'function' && host) ? nxGuardarScroll(host) : function(){};
  fn();
  vuelve();
}

// ---- Fecha y turno de la hoja: se aplican con la lupa ----
function opsFiltro(pre){
  return opsVista[pre] || {date: localDateStr(), shift: String(expectedShift())};
}
function opsInitFiltro(pre){
  var f = opsFiltro(pre);
  opsVista[pre] = f;
  var d = document.getElementById(pre+'-date'), s = document.getElementById(pre+'-shift');
  if(d) d.value = f.date;
  if(s) s.value = f.shift;
  opsSucio(pre, false);
}
function opsSucio(pre, on){
  var b = document.getElementById(pre+'-go');
  if(b) b.classList.toggle('pending', on !== false);
}
function opsAplicar(pre, render){
  var d = document.getElementById(pre+'-date'), s = document.getElementById(pre+'-shift');
  var f = {date: (d && d.value) || localDateStr(), shift: (s && s.value) || String(expectedShift())};
  if(d && !d.value) d.value = f.date;
  opsVista[pre] = f;
  opsSucio(pre, false);
  if(window.loadHistory) window.loadHistory(f.date, render); else render();
}
function opsTecla(e, pre, render){ if(e.key === 'Enter') opsAplicar(pre, render); }

function opsDelDia(col, f){
  return opsLista(col).filter(function(r){
    return String(r.date || '').slice(0, 10) === f.date && String(r.shift) === String(f.shift);
  });
}

// ---- Horas, minutos y numeros ----
function opsMin(hhmm){
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
// Minutos de una hora a otra; si la segunda es menor, paso la medianoche
function opsMinutos(ini, fin){
  var a = opsMin(ini), b = opsMin(fin);
  if(a == null || b == null) return null;
  var d = b - a;
  return d < 0 ? d + 1440 : d;
}
function opsAhora(){
  var d = new Date();
  return String(d.getHours()).padStart(2, '0')+':'+String(d.getMinutes()).padStart(2, '0');
}
function opsHora12(hhmm){
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if(!m) return '';
  var h = +m[1], ap = h >= 12 ? 'PM' : 'AM';
  return (h % 12 || 12)+':'+m[2]+' '+ap;
}
function opsNum(v){
  var s = String(v == null ? '' : v).replace(/,/g, '').trim();
  if(s === '') return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}
function opsFmt(n){
  if(n == null || n === '') return '';
  return (Math.round(Number(n) * 100) / 100).toLocaleString('en-US');
}
function opsHoras(min){ return min == null ? '' : (Math.round(min / 60 * 100) / 100).toFixed(2); }
function opsTurno(s){
  s = String(s || '');
  return s === '1' ? '1st shift' : s === '2' ? '2nd shift' : 'All shifts';
}
function opsFechaTxt(iso){ return (typeof fmtDate === 'function') ? fmtDate(iso) : String(iso || ''); }
// Output tambien se fabrica en el Chopped area, que no es una linea numerada
// (pedido del usuario, 17 nov 2026): se guarda como line:'chopped'
var OPS_CHOPPED = 'chopped';
// Forklift (pedido del usuario, 17 nov 2026): solo en Attendance, para los
// operadores de montacargas; no es una linea de produccion
var OPS_FORKLIFT = 'forklift';
function opsLineaTxt(v){
  v = String(v == null ? '' : v);
  return !v ? '' : v === OPS_CHOPPED ? 'Chopped area' : v === OPS_FORKLIFT ? 'Forklift' : 'Line '+v;
}
// Orden de las lineas en totales y listas: 1..6, Chopped area y al final las sin linea
function opsLineaOrden(v){
  v = String(v == null ? '' : v);
  if(!v) return 999;
  if(v === OPS_CHOPPED) return 500;
  if(v === OPS_FORKLIFT) return 510;
  return parseInt(v, 10) || 600;
}
function opsLineOptions(sel, vacio, conChopped, conForklift){
  // un registro que ya dice Forklift lo sigue diciendo aunque la lista no lo ofrezca
  var fk = conForklift || String(sel) === OPS_FORKLIFT;
  return (vacio ? '<option value="">'+vacio+'</option>' : '') + OPS_LINES.map(function(n){
    return '<option value="'+n+'"'+(String(sel) === String(n) ? ' selected' : '')+'>Line '+n+'</option>';
  }).join('') + (conChopped ? '<option value="'+OPS_CHOPPED+'"'+(String(sel) === OPS_CHOPPED ? ' selected' : '')+'>Chopped area</option>' : '') +
    (fk ? '<option value="'+OPS_FORKLIFT+'"'+(String(sel) === OPS_FORKLIFT ? ' selected' : '')+'>Forklift</option>' : '');
}

// ===== REPORTES EN PDF =====
// Una tabla por seccion, en horizontal (carta), blanco/gris/negro, con el logo
// de Caputo arriba. Los titulos de las columnas van en UNA linea (pedido del
// usuario, 17 nov 2026): la columna que no alcanza toma ancho de las que les
// sobra y, si aun asi no caben todos, se achica la letra de los titulos.
// Se entrega con _deliverFile, asi el boton de la impresora (nxImprimir) sirve solo.
//   opsPdf({title, sub, file, sections:[{title, kpis:[[label, valor]], cols:[{h, w, al}], rows:[[...]], foot:[...]}]})

// El logo de la marca es SVG y jsPDF no lo lee: se pasa a PNG una vez
var _opsLogo = null;
function opsLogoPng(){
  if(_opsLogo) return _opsLogo;
  _opsLogo = fetch('assets/caputo.svg').then(function(r){
    if(!r.ok) throw new Error('logo');
    return r.text();
  }).then(function(svg){
    return new Promise(function(ok){
      var url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
      var img = new Image();
      img.onload = function(){
        var res = null;
        try {
          var w = img.naturalWidth || 361, h = img.naturalHeight || 158, k = 4;
          var c = document.createElement('canvas');
          c.width = w * k; c.height = h * k;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res = {data: c.toDataURL('image/png'), ratio: w / h};
        } catch(e){ res = null; }
        URL.revokeObjectURL(url);
        ok(res);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }).catch(function(){ return null; }).then(function(x){
    if(!x) _opsLogo = null;          // sin logo esta vez: se reintenta la proxima
    return x;
  });
  return _opsLogo;
}

function opsPdf(spec){
  if(typeof _pdfScript !== 'function'){ toast('PDF is not available'); return Promise.resolve(); }
  var listo = _pdfScript(PDF_FORMS_JSPDF, function(){ return !!(window.jspdf && window.jspdf.jsPDF); });
  return Promise.all([listo, opsLogoPng()]).then(function(res){
    var logo = res[1];
    var doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'mm', format: 'letter'});
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    var ahora = new Date();
    var impreso = (ahora.getMonth()+1)+'/'+ahora.getDate()+'/'+ahora.getFullYear()+' '+opsHora12(opsAhora());
    var y = 0;
    // Logo a la izquierda; al lado, OPERATIONS, el titulo y la fecha del reporte;
    // a la derecha, cuando y quien lo imprimio
    var cabecera = function(){
      var tx = M, LH_LOGO = 13;
      if(logo){
        var lw = LH_LOGO * logo.ratio;
        doc.addImage(logo.data, 'PNG', M, M - 4, lw, LH_LOGO);
        tx = M + lw + 5;
      }
      doc.setTextColor(90); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('OPERATIONS', tx, M - 0.5);
      doc.setTextColor(0); doc.setFontSize(15);
      doc.text(spec.title, tx, M + 5.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      if(spec.sub) doc.text(spec.sub, tx, M + 10.5);
      doc.setTextColor(90); doc.setFontSize(8);
      doc.text('Printed '+impreso, W - M, M - 0.5, {align: 'right'});
      doc.text('by '+opsQuien(), W - M, M + 3.5, {align: 'right'});
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, M + 13, W - M, M + 13);
      y = M + 20;
    };
    var pagina = function(){ doc.addPage(); cabecera(); };
    cabecera();

    var FS = 8.5, LH = FS * 0.3528 * 1.22, PAD = 1.5, UTIL = W - 2 * M;
    (spec.sections || []).forEach(function(sec){
      if(y > H - 34) pagina();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(0);
      doc.text(sec.title, M, y);
      y += 5;
      if(sec.kpis && sec.kpis.length){
        var x = M;
        doc.setFontSize(9);
        sec.kpis.forEach(function(k){
          doc.setFont('helvetica', 'normal'); doc.text(String(k[0])+': ', x, y);
          x += doc.getTextWidth(String(k[0])+': ');
          doc.setFont('helvetica', 'bold'); doc.text(String(k[1]), x, y);
          x += doc.getTextWidth(String(k[1])) + 7;
        });
        y += 5;
      }
      var cols = sec.cols || [];
      var suma = cols.reduce(function(a, c){ return a + (c.w || 20); }, 0) || 1;
      // una tabla corta (pocos datos) puede ir mas angosta: sec.width en mm
      var ANCHO = sec.width ? Math.min(sec.width, UTIL) : UTIL;
      var base = cols.map(function(c){ return (c.w || 20) * ANCHO / suma; });

      // 1) Los titulos en una linea: la letra mas grande con la que caben todos
      var suma1 = function(l){ return l.reduce(function(a, b){ return a + b; }, 0); };
      var HFS = 8, minCab = [];
      for(var t = 8; t >= 5.5; t -= 0.25){
        HFS = t;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(t);
        minCab = cols.map(function(c){ return doc.getTextWidth(String(c.h)) + 2 * PAD + 0.4; });
        if(suma1(minCab) <= ANCHO) break;
      }
      // 2) Los datos cortos (Line 1, un LOT, una hora) tampoco se parten; los
      //    textos largos (descripcion, notas) si, y le prestan el ancho a los cortos
      var medir = function(r, negrita){
        doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.setFontSize(FS);
        return cols.map(function(c, i){ return doc.getTextWidth(String(r[i] == null ? '' : r[i])); });
      };
      var largo = cols.map(function(){ return 0; });
      (sec.rows || []).forEach(function(r){
        if(r.length < 2) return;
        medir(r, false).forEach(function(w, i){ largo[i] = Math.max(largo[i], w); });
      });
      if(sec.foot) medir(sec.foot, true).forEach(function(w, i){ largo[i] = Math.max(largo[i], w); });
      var minimo = cols.map(function(c, i){
        var m = largo[i] + 2 * PAD + 0.4;
        return m <= 42 ? Math.max(m, minCab[i]) : minCab[i];
      });
      if(suma1(minimo) > ANCHO) minimo = minCab;
      var falta = 0, holgura = 0;
      base.forEach(function(w, i){ if(w < minimo[i]) falta += minimo[i] - w; else holgura += w - minimo[i]; });
      var anchos = (!falta || !holgura) ? base : base.map(function(w, i){
        return w < minimo[i] ? minimo[i] : w - (w - minimo[i]) * Math.min(1, falta / holgura);
      });
      var altoCab = HFS * 0.3528 * 1.2 + 2 * PAD + 0.6;

      var fila = function(celdas, tipo){
        doc.setFont('helvetica', tipo === 'body' ? 'normal' : 'bold'); doc.setFontSize(FS);
        var lineas = celdas.map(function(v, i){
          return doc.splitTextToSize(String(v == null ? '' : v), Math.max(4, anchos[i] - 2 * PAD));
        });
        var alto = Math.max.apply(null, lineas.map(function(l){ return l.length || 1; })) * LH + 2 * PAD;
        return {lineas: lineas, alto: alto};
      };
      var celda = function(x, w, alto, relleno){
        doc.setDrawColor(150); doc.setLineWidth(0.2);
        if(relleno){ doc.setFillColor(relleno, relleno, relleno); doc.rect(x, y, w, alto, 'FD'); }
        else doc.rect(x, y, w, alto);
      };
      var posX = function(x, w, i){
        var al = (cols[i] && cols[i].al) || 'left';
        return {al: al, x: al === 'right' ? x + w - PAD : al === 'center' ? x + w / 2 : x + PAD};
      };
      // La fila de titulos: una linea, centrada de alto
      var dibujarCab = function(){
        var x = M;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(HFS); doc.setTextColor(0);
        cols.forEach(function(c, i){
          var w = anchos[i];
          celda(x, w, altoCab, 220);
          var p = posX(x, w, i);
          doc.text(String(c.h), p.x, y + altoCab / 2, {align: p.al, baseline: 'middle'});
          x += w;
        });
        y += altoCab;
      };
      var dibujar = function(f, tipo){
        var x = M;
        doc.setFont('helvetica', tipo === 'body' ? 'normal' : 'bold'); doc.setFontSize(FS); doc.setTextColor(0);
        f.lineas.forEach(function(l, i){
          var w = anchos[i];
          celda(x, w, f.alto, tipo === 'foot' ? 242 : 0);
          var p = posX(x, w, i);
          doc.text(l, p.x, y + PAD, {align: p.al, baseline: 'top', lineHeightFactor: 1.22});
          x += w;
        });
        y += f.alto;
      };
      if(y + altoCab + 8 > H - 14) pagina();
      dibujarCab();
      var filas = sec.rows || [];
      if(!filas.length) filas = [[sec.empty || 'No records']];
      filas.forEach(function(r){
        // un aviso suelto ("No records"): una celda a todo lo ancho
        if(r.length === 1 && cols.length > 1){
          var a1 = LH + 2 * PAD;
          if(y + a1 > H - 14){ pagina(); dibujarCab(); }
          doc.setDrawColor(150); doc.setLineWidth(0.2); doc.rect(M, y, ANCHO, a1);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(FS); doc.setTextColor(90);
          doc.text(String(r[0]), M + PAD, y + PAD, {baseline: 'top'});
          doc.setTextColor(0);
          y += a1;
          return;
        }
        var f = fila(r, 'body');
        if(y + f.alto > H - 14){ pagina(); dibujarCab(); }
        dibujar(f, 'body');
      });
      if(sec.foot){
        var ff = fila(sec.foot, 'foot');
        if(y + ff.alto > H - 14){ pagina(); dibujarCab(); }
        dibujar(ff, 'foot');
      }
      y += 8;
    });
    var n = doc.getNumberOfPages();
    for(var i = 1; i <= n; i++){
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
      doc.text(spec.title+(spec.sub ? '  ·  '+spec.sub : ''), M, H - 6);
      doc.text('Page '+i+' of '+n, W - M, H - 6, {align: 'right'});
    }
    doc.setProperties({title: spec.title+(spec.sub ? ' — '+spec.sub : ''), creator: 'NEXORA QC'});
    return doc;
  }).then(function(doc){
    var nombre = spec.file || 'operations-report.pdf';
    return _deliverFile(doc.output('blob'), nombre).then(function(r){
      opsLog('Report generated', nombre);
      return r;
    });
  }).catch(function(e){
    console.error('opsPdf:', e);
    toast('Could not build the report: '+(e && e.message ? e.message : e));
  });
}
