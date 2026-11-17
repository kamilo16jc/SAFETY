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
function opsLineOptions(sel, vacio){
  return (vacio ? '<option value="">'+vacio+'</option>' : '') + OPS_LINES.map(function(n){
    return '<option value="'+n+'"'+(String(sel) === String(n) ? ' selected' : '')+'>Line '+n+'</option>';
  }).join('');
}

// ===== REPORTES EN PDF =====
// Una tabla por seccion, en horizontal (carta), blanco/gris/negro. Se entrega
// con _deliverFile, asi el boton de la impresora (nxImprimir) sirve solo.
//   opsPdf({title, sub, file, sections:[{title, kpis:[[label, valor]], cols:[{h, w, al}], rows:[[...]], foot:[...]}]})
function opsPdf(spec){
  if(typeof _pdfScript !== 'function'){ toast('PDF is not available'); return Promise.resolve(); }
  return _pdfScript(PDF_FORMS_JSPDF, function(){ return !!(window.jspdf && window.jspdf.jsPDF); }).then(function(){
    var doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'mm', format: 'letter'});
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    var ahora = new Date();
    var impreso = (ahora.getMonth()+1)+'/'+ahora.getDate()+'/'+ahora.getFullYear()+' '+opsHora12(opsAhora());
    var y = 0;
    var cabecera = function(){
      doc.setTextColor(70); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.text('CAPUTO CHEESE  ·  OPERATIONS', M, M);
      doc.setFont('helvetica', 'normal');
      doc.text('Printed '+impreso+' by '+opsQuien(), W - M, M, {align: 'right'});
      doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(spec.title, M, M + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      if(spec.sub) doc.text(spec.sub, M, M + 13.5);
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, M + 16.5, W - M, M + 16.5);
      y = M + 23;
    };
    var pagina = function(){ doc.addPage(); cabecera(); };
    cabecera();

    var FS = 8.5, LH = FS * 0.3528 * 1.22, PAD = 1.5;
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
      var k = (W - 2 * M) / suma;
      var anchos = cols.map(function(c){ return (c.w || 20) * k; });
      var fila = function(celdas, tipo){
        doc.setFont('helvetica', tipo === 'body' ? 'normal' : 'bold'); doc.setFontSize(FS);
        var lineas = celdas.map(function(v, i){
          return doc.splitTextToSize(String(v == null ? '' : v), Math.max(4, anchos[i] - 2 * PAD));
        });
        var alto = Math.max.apply(null, lineas.map(function(l){ return l.length || 1; })) * LH + 2 * PAD;
        return {lineas: lineas, alto: alto};
      };
      var dibujar = function(f, tipo){
        var x = M;
        doc.setFont('helvetica', tipo === 'body' ? 'normal' : 'bold'); doc.setFontSize(FS);
        doc.setDrawColor(150); doc.setLineWidth(0.2);
        f.lineas.forEach(function(l, i){
          var w = anchos[i];
          if(tipo === 'head'){ doc.setFillColor(220, 220, 220); doc.rect(x, y, w, f.alto, 'FD'); }
          else if(tipo === 'foot'){ doc.setFillColor(242, 242, 242); doc.rect(x, y, w, f.alto, 'FD'); }
          else doc.rect(x, y, w, f.alto);
          var al = (cols[i] && cols[i].al) || 'left';
          var tx = al === 'right' ? x + w - PAD : al === 'center' ? x + w / 2 : x + PAD;
          doc.setTextColor(0);
          doc.text(l, tx, y + PAD, {align: al, baseline: 'top', lineHeightFactor: 1.22});
          x += w;
        });
        y += f.alto;
      };
      var cab = fila(cols.map(function(c){ return c.h; }), 'head');
      dibujar(cab, 'head');
      var filas = sec.rows || [];
      if(!filas.length) filas = [[sec.empty || 'No records']];
      filas.forEach(function(r){
        var celdas = r.length === 1 && cols.length > 1 ? [r[0]].concat(cols.slice(1).map(function(){ return ''; })) : r;
        var f = fila(celdas, 'body');
        if(y + f.alto > H - 14){ pagina(); dibujar(cab, 'head'); }
        dibujar(f, 'body');
      });
      if(sec.foot){
        var ff = fila(sec.foot, 'foot');
        if(y + ff.alto > H - 14){ pagina(); dibujar(cab, 'head'); }
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
