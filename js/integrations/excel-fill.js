// ===== EXCEL FILL (client-side, sin premium) =====
// Rellena la plantilla GMP .xlsm reemplazando marcadores {{Coord}} en el XML
// de la hoja (vía JSZip), preservando formato, logo y macros. Entrega el
// archivo con el mismo mecanismo que Word (Web Share en iOS, descarga en PC).

// Mapea los datos del reporte a tokens = coordenada de celda.
function buildGmpTokens(g, temps){
  var map = {
    B10: g.location || '',
    H10: g.date || '',
    L10: g.shift===1 ? '1st Shift' : g.shift===2 ? '2nd Shift' : (g.shift || ''),
    A46: g.comments || '',
    E49: g.completedBy || '',
    E51: g.verifiedBy || ''
  };
  // Checklist: answers[0..20] -> K14..K34 ("✓ Yes" / "✗ No")
  var ans = g.answers || {};
  for(var i = 0; i < 21; i++){
    var v = ans[i];
    map['K' + (14 + i)] = v === 'yes' ? '✓ Yes' : v === 'no' ? '✗ No' : '';
  }
  // Temperaturas: columnas G=Beginning, I=Middle, K=End ; filas 38-43
  var byCp = { begin:{}, mid:{}, end:{} };
  (temps || []).forEach(function(t){ if(byCp[t.checkpoint] !== undefined) byCp[t.checkpoint] = t; });
  var cols = { G:'begin', I:'mid', K:'end' };
  var rows = { 38:'time', 39:'temp', 40:'chop', 41:'plat', 42:'line6', 43:'completedBy' };
  Object.keys(cols).forEach(function(col){
    var t = byCp[cols[col]] || {};
    Object.keys(rows).forEach(function(r){
      map[col + r] = t[rows[r]] || '';
    });
  });
  return map;
}

function _gmpFilename(g){
  var datePart = (g.date || new Date().toISOString().slice(0,10)).replace(/[\/]/g,'-');
  var shiftPart = g.shift===1 ? '_1st' : g.shift===2 ? '_2nd' : '';
  return 'GMP_' + datePart + shiftPart + '.xlsm';
}

// Rellena la plantilla y devuelve el zip como blob.
function _fillGmp(g, temps){
  if(typeof JSZip === 'undefined'){ return Promise.reject(new Error('JSZip no cargó')); }
  return fetch('assets/gmp_form_template.xlsm')
    .then(function(r){ if(!r.ok) throw new Error('No se encontró la plantilla GMP'); return r.arrayBuffer(); })
    .then(function(buf){ return JSZip.loadAsync(buf); })
    .then(function(zip){
      var sheet = 'xl/worksheets/sheet1.xml';
      return zip.file(sheet).async('string').then(function(xml){
        var map = buildGmpTokens(g, temps);
        Object.keys(map).forEach(function(token){
          xml = xml.split('{{' + token + '}}').join(_xmlEsc(map[token]));
        });
        xml = xml.replace(/\{\{[A-Z]+[0-9]+\}\}/g, ''); // tokens sin usar -> vacío
        zip.file(sheet, xml);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      });
    });
}

// Rellena la forma GMP y la entrega (compartir/descargar). Promesa con filename.
function downloadGmpDoc(g, temps){
  return _fillGmp(g, temps).then(function(blob){
    var filename = _gmpFilename(g);
    return _deliverFile(blob, filename).then(function(){ return filename; });
  });
}

// ---- Reports: arma los datos del GMP del día filtrado y descarga la forma ----
function sendGmpForm(){
  if(!rptGmpResults.length){ toast('No GMP audits for the selected date'); return; }
  var g = rptGmpResults[rptGmpResults.length - 1]; // la auditoría más reciente del filtro
  var db = getDB();
  var temps = (db.temps || []).filter(function(t){
    return (!rptFilters.date || (t.date || '').startsWith(rptFilters.date)) &&
           (g.shift == null || t.shift === g.shift);
  });
  toast('Building form...');
  downloadGmpDoc(g, temps).then(function(filename){
    toast('Form ready ✓');
    logActivity('form', 'GMP form generated', filename, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadGmpDoc:', e);
    toast('Could not build the form: ' + e.message);
  });
}
