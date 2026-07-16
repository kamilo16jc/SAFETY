// ===== METAL DETECTOR FORM FILL (client-side, sin premium) =====
// Rellena la plantilla Word de Metal Detector reemplazando marcadores {{Token}}
// (JSZip). Casillas: ☒ marcada / ☐ vacía. Entrega vía Web Share (iOS) / descarga.

function buildMetalTokens(m){
  var map = {
    Date: m.date || '',
    Line: m.line || '',
    StartTime: m.startTime || '',
    EndTime: m.endTime || '',
    Corrective: m.corrective || '',
    CompletedBy: m.completedBy || '',
    CompDate: m.date || '',
    VerifiedBy: m.verifiedBy || '',
    VerifDate: m.verifiedBy ? (m.date || '') : ''
  };
  var ans = m.answers || {};
  for(var i = 0; i < 7; i++){
    var v = ans[i];
    map['Q' + (i+1) + 'Y'] = v === 'yes' ? '☒' : '☐';
    map['Q' + (i+1) + 'N'] = v === 'no'  ? '☒' : '☐';
  }
  return map;
}

function _metalFilename(m){
  var datePart = (m.date || new Date().toISOString().slice(0,10)).replace(/[\/]/g,'-');
  var linePart = m.line ? ('_MD' + String(m.line).replace(/[^A-Za-z0-9]/g,'')) : '';
  return 'MetalDetector_' + datePart + linePart + '.docx';
}

function downloadMetalDoc(m){
  if(typeof JSZip === 'undefined'){ return Promise.reject(new Error('JSZip no cargó')); }
  return fetch('assets/metal_form_template.docx')
    .then(function(r){ if(!r.ok) throw new Error('No se encontró la plantilla Metal Detector'); return r.arrayBuffer(); })
    .then(function(buf){ return JSZip.loadAsync(buf); })
    .then(function(zip){
      return zip.file('word/document.xml').async('string').then(function(xml){
        var map = buildMetalTokens(m);
        Object.keys(map).forEach(function(token){
          xml = xml.split('{{' + token + '}}').join(_xmlEsc(map[token]));
        });
        xml = xml.replace(/\{\{[A-Za-z0-9]+\}\}/g, '');
        zip.file('word/document.xml', xml);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      });
    })
    .then(function(blob){
      var filename = _metalFilename(m);
      return _deliverFile(blob, filename).then(function(){ return filename; });
    });
}

// ---- Reports: descarga la forma del último check de metal detector del filtro ----
function sendMetalForm(){
  if(!rptMetalResults.length){ toast('No metal detector checks for the selected date'); return; }
  var m = rptMetalResults[rptMetalResults.length - 1];
  toast('Building form...');
  downloadMetalDoc(m).then(function(filename){
    toast('Form ready ✓');
    logActivity('form', 'Metal detector form generated', filename, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadMetalDoc:', e);
    toast('Could not build the form: ' + e.message);
  });
}
