// ===== WORD FILL (client-side, sin premium) =====
// Rellena la plantilla .docx con marcadores {{Token}} usando JSZip.
// Devuelve el documento como base64 para enviarlo al flow (Create file).

function _xmlEsc(v){
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Arma el mapa Token -> valor a partir del paquete de datos del reporte.
function buildWeightTokens(d){
  var map = {
    Lote:  (d.weights[0] || {}).lot || '',
    Fecha: d.date || '',
    Turno: d.shiftLabel || '',
    Linea: d.lineLabel || '',
    Comentarios: d.notes || ''
  };
  for(var i = 0; i < 10; i++){
    var w = d.weights[i];
    var n = i + 1;
    if(w){
      map['Pkg'+n]  = w.pkgLabel || '';
      map['Hora'+n] = w.time || '';
      for(var k = 0; k < 5; k++){
        var val = (w.vals && w.vals[k] != null) ? w.vals[k] : '';
        map['P'+n+'_'+(k+1)] = val;
      }
      map['Tot'+n]  = (w.sum  != null ? w.sum  : '');
      map['Prom'+n] = (w.avgR != null ? w.avgR : '');
      map['Ini'+n]  = w.initials || '';
    }
  }
  for(var j = 0; j < 9; j++){
    var s = d.seals[j];
    var m = j + 1;
    if(s){
      map['SHora'+m]  = s.time || '';
      map['SVis'+m]   = s.visual || '';
      map['SDunk'+m]  = s.dunk || '';
      map['SPrint'+m] = s.printing || '';
      map['SIni'+m]   = s.initials || '';
    }
  }
  return map;
}

function _weightFilename(d){
  var datePart = (d.date || new Date().toISOString().slice(0,10));
  var linePart = d.lineLabel ? ('_L' + d.lineLabel) : '';
  var shiftPart = d.shiftLabel ? ('_' + d.shiftLabel) : '';
  return 'Weight_' + datePart + linePart + shiftPart + '.docx';
}

// Rellena la plantilla y devuelve el zip listo. outType: 'base64' | 'blob'
function _fillWeight(d, outType){
  if(typeof JSZip === 'undefined'){
    return Promise.reject(new Error('JSZip no cargó'));
  }
  return fetch('assets/weight_form_template.docx')
    .then(function(r){ if(!r.ok) throw new Error('No se encontró la plantilla'); return r.arrayBuffer(); })
    .then(function(buf){ return JSZip.loadAsync(buf); })
    .then(function(zip){
      return zip.file('word/document.xml').async('string').then(function(xml){
        var map = buildWeightTokens(d);
        Object.keys(map).forEach(function(token){
          xml = xml.split('{{' + token + '}}').join(_xmlEsc(map[token]));
        });
        // Marcadores no usados (columnas sin registro) -> vacío
        xml = xml.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '');
        zip.file('word/document.xml', xml);
        return zip.generateAsync({ type: outType, compression: 'DEFLATE' });
      });
    });
}

// Devuelve una promesa con { base64, filename } (por si se quiere enviar a un flow)
function fillWeightDoc(d){
  return _fillWeight(d, 'base64').then(function(base64){
    return { base64: base64, filename: _weightFilename(d) };
  });
}

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Descarga clásica (escritorio / Android): <a download> + blob URL.
function _downloadAnchor(blob, filename){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}

// Entrega el archivo de la forma que soporte el dispositivo.
// iOS/PWA no permite <a download>; ahí se usa el Web Share API (hoja de
// compartir → "Guardar en Archivos", Word, correo…).
function _deliverFile(blob, filename){
  var file;
  try { file = new File([blob], filename, { type: DOCX_MIME }); } catch(e){ file = null; }
  if(file && navigator.canShare && navigator.canShare({ files: [file] })){
    return navigator.share({ files: [file], title: filename })
      .then(function(){ return 'shared'; })
      .catch(function(err){
        if(err && err.name === 'AbortError') return 'cancelled'; // el usuario cerró la hoja
        _downloadAnchor(blob, filename); // otro fallo → intentar descarga clásica
        return 'downloaded';
      });
  }
  _downloadAnchor(blob, filename);
  return Promise.resolve('downloaded');
}

// Rellena la forma y la entrega (descarga o compartir). Devuelve promesa con el filename.
function downloadWeightDoc(d){
  return _fillWeight(d, 'blob').then(function(blob){
    var filename = _weightFilename(d);
    return _deliverFile(blob, filename).then(function(){ return filename; });
  });
}

// ---- Reports: arma el paquete de datos y descarga la forma oficial ----
// SQF 2.4.D.1.1 — Weight Monitoring & LeakPointer log (Word)
function sendWeightSealForm(){
  if(!rptWeightResults.length && !rptSealResults.length){ toast('No records for the selected filters'); return; }
  var db = getDB();
  var temps = (db.temps||[]).filter(function(t){ return !rptFilters.date || (t.date||'').startsWith(rptFilters.date); });

  // Campos pre-calculados para que el mapeo del Word template sea directo
  var weights = rptWeightResults.map(function(r){
    var sum = (r.vals||[]).reduce(function(a,b){ return a + (parseFloat(b)||0); }, 0);
    return Object.assign({}, r, {
      sum:  Math.round(sum*100)/100,
      avgR: Math.round((r.avg||0)*100)/100
    });
  });
  var mark = function(v){ return v==='pass' ? 'PASS' : v==='fail' ? 'FAIL' : ''; };
  var seals = rptSealResults.map(function(r){
    var c = r.checks||{};
    return Object.assign({}, r, {
      visual: mark(c['Visual']), dunk: mark(c['Dunk Tank']), printing: mark(c['Printing'])
    });
  });
  var notes = rptWeightResults.concat(rptSealResults)
    .map(function(r){ return (r.comments||'').trim(); })
    .filter(function(x){ return x; })
    .join(' · ');

  var payload = {
    date: rptFilters.date, line: rptFilters.line, shift: rptFilters.shift,
    shiftLabel: rptFilters.shift==='1' ? '1st' : rptFilters.shift==='2' ? '2nd' : '',
    lineLabel: rptFilters.line==='all' ? '' : rptFilters.line,
    notes: notes,
    weights: weights, seals: seals, temps: temps
  };

  toast('Building form...');
  downloadWeightDoc(payload).then(function(filename){
    toast('Form ready ✓');
    logActivity('form', 'Official form generated', filename, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadWeightDoc:', e);
    toast('Could not build the form: ' + e.message);
  });
}
