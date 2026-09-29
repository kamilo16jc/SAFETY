// ===== LA FORMA DE GRILLING CHEESE =====
// SQF # 2.4.D.3.A. No se redibuja la forma en ningun lado: se rellena el
// .docx de siempre —assets/grilling_form_template.docx, que es el archivo
// original con {{Marcadores}} donde van los datos— y ese mismo archivo es el
// que se descarga. Se abre en Word y se imprime como cualquier otra forma.
//
// Es el mismo camino de las otras formas oficiales (weight, metal): JSZip
// abre el .docx, se cambia el texto dentro de word/document.xml y se vuelve a
// cerrar. La entrega tambien es la misma, por _deliverFile: en el computador
// y en Android baja el archivo, y en iPhone sale la hoja de compartir, que es
// la unica manera de guardarlo ahi.

var GRILLING_TEMPLATE = 'assets/grilling_form_template.docx';

function _gxEsc(v){
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// En papel se encierra en un circulo la respuesta. Aqui las dos opciones se
// imprimen igual que en la forma y la elegida va en negrita y subrayada.
function _gxYesNo(elegido){
  var normal = '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
  var marcado = '<w:rPr><w:b/><w:bCs/><w:u w:val="single"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
  var run = function(txt, sel){
    return '<w:r>'+(sel ? marcado : normal)+'<w:t xml:space="preserve">'+txt+'</w:t></w:r>';
  };
  // Se cierra el run donde vivia el marcador, se meten los tres, y se deja uno
  // abierto para que el cierre que ya trae la plantilla siga siendo valido.
  return '</w:t></w:r>' +
    run('Yes', elegido==='Yes') + run('   or   ') + run('No', elegido==='No') +
    '<w:r>'+normal+'<w:t xml:space="preserve">';
}

// Los datos del lote: lo del laboratorio sale de Raw Analysis y lo demas de la
// propia forma. Lo que todavia no se ha hecho se queda en blanco, igual que
// cuando se imprime en papel para que lo llene el que grilla.
function buildGrillingTokens(r, g){
  var f = function(v){ return v ? fmtDate(v) : ''; };
  return {
    texto: {
      Lote:           r.code || r.sample || '',
      FechaRecibido:  f(g.receivedDate),
      RecibidoPor:    g.receivedBy || '',
      PH:             r.ph || '',
      Fat:            r.fat || '',
      Moisture:       r.moisture || '',
      FechaTest:      f(r.date),
      TestPor:        r.testedBy || '',
      AppComments:    g.appearanceNote || '',
      TexComments:    g.textureNote || '',
      Correctivas:    g.corrective || '',
      FechaSensory:   f(g.sensoryDate),
      SensoryPor:     g.sensoryBy || '',
      AprobadoPor:    g.approvedBy || '',
      FechaAprobado:  f(g.approvedAt)
    },
    // Estos dos no son texto sino formato, asi que entran sin escapar
    crudo: {
      AppYN: _gxYesNo(g.appearance),
      TexYN: _gxYesNo(g.texture)
    }
  };
}

function grillingFileName(r){
  var lote = String(r.code || r.sample || 'lot').replace(/[\\/:*?"<>|]/g, '-');
  return 'Pre-Grilling Cheese Verification - ' + lote;
}

// Rellena la plantilla y devuelve el .docx como Blob
function fillGrillingDocx(r, g){
  if(typeof JSZip === 'undefined') return Promise.reject(new Error('JSZip no cargó'));
  return fetch(GRILLING_TEMPLATE)
    .then(function(res){ if(!res.ok) throw new Error('No se encontró la plantilla'); return res.arrayBuffer(); })
    .then(function(buf){ return JSZip.loadAsync(buf); })
    .then(function(zip){
      return zip.file('word/document.xml').async('string').then(function(xml){
        var t = buildGrillingTokens(r, g);
        Object.keys(t.crudo).forEach(function(k){
          xml = xml.split('{{'+k+'}}').join(t.crudo[k]);
        });
        Object.keys(t.texto).forEach(function(k){
          xml = xml.split('{{'+k+'}}').join(_gxEsc(t.texto[k]));
        });
        xml = xml.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '');   // por si queda alguno
        zip.file('word/document.xml', xml);
        // El tipo va explicito: asi el telefono lo reconoce como documento de Word
        // al compartirlo, no como un zip cualquiera.
        return zip.generateAsync({type:'blob', compression:'DEFLATE',
          mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      });
    });
}

// Rellena la forma con los datos del lote y la entrega.
function downloadGrillingDoc(rawId){
  var r = (getDB().raw||[]).filter(function(x){ return x.id===rawId; })[0];
  if(!r) return;
  var g = (typeof gcExtraOrEmpty==='function') ? gcExtraOrEmpty(rawId) : {};
  var nombre = grillingFileName(r) + '.docx';

  toast('Building the form\u2026');
  fillGrillingDocx(r, g)
    .then(function(blob){ return _deliverFile(blob, nombre); })
    .then(function(){
      toast('Form ready \u2713');
      if(typeof logActivity==='function'){
        logActivity('form','Pre-Grilling Cheese form generated',
          nombre + (typeof GC_STAGE_TXT!=='undefined' ? ' \u00b7 '+GC_STAGE_TXT[gcStage(r,g)] : ''),
          (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '\u2014');
      }
    })
    .catch(function(err){
      console.error('downloadGrillingDoc:', err);
      toast('Could not build the form: ' + err.message);
    });
}
