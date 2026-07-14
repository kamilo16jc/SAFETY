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

// Rellena la forma y la descarga en el PC. Devuelve promesa con el filename.
function downloadWeightDoc(d){
  return _fillWeight(d, 'blob').then(function(blob){
    var filename = _weightFilename(d);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    return filename;
  });
}
