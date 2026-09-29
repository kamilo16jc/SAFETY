// ===== LA FORMA DE GRILLING CHEESE, EN PDF =====
// SQF # 2.4.D.3.A. No se redibuja la forma: se rellena el .docx de siempre
// —assets/grilling_form_template.docx, que es el archivo original con
// {{Marcadores}} donde iban los datos— y ese documento se muestra ya armado
// para guardarlo en PDF. De Word no sale nada: el usuario recibe el PDF.
//
// Es el mismo camino de las otras formas oficiales (weight, metal): JSZip
// abre el .docx, se cambia el texto dentro de word/document.xml y se vuelve a
// cerrar. Lo que cambia aqui es el final: en vez de descargar el .docx, se
// dibuja con docx-preview y se manda a imprimir.

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
        return zip.generateAsync({type:'blob', compression:'DEFLATE'});
      });
    });
}

// Dibuja el .docx relleno y lo manda a imprimir. El navegador guarda en PDF.
function openGrillingPdf(rawId){
  var r = (getDB().raw||[]).filter(function(x){ return x.id===rawId; })[0];
  if(!r) return;
  var g = (typeof gcExtraOrEmpty==='function') ? gcExtraOrEmpty(rawId) : {};
  if(typeof docx === 'undefined'){ toast('El visor del documento no cargó'); return; }

  toast('Building the form…');
  var caja = document.getElementById('gx-render');
  if(!caja){
    caja = document.createElement('div');
    caja.id = 'gx-render';
    caja.style.cssText = 'position:fixed;left:-10000px;top:0;width:8.5in';
    document.body.appendChild(caja);
  }
  caja.innerHTML = '';

  fillGrillingDocx(r, g)
    .then(function(blob){
      return docx.renderAsync(blob, caja, caja, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: true,        // que la hoja crezca con el contenido
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true         // el logo va incrustado: sobrevive a la otra ventana
      });
    })
    .then(function(){
      var w = window.open('', '_blank');
      if(!w){ toast('Allow pop-ups to open the form'); return; }
      var titulo = grillingFileName(r);   // el navegador lo usa como nombre del PDF
      w.document.write(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+_gxEsc(titulo)+'</title>'+
        '<style>'+
          'html,body{margin:0;padding:0;background:#f4f4f2}'+
          '.docx-wrapper{background:transparent;padding:0;display:block}'+
          '.docx-wrapper>section.docx{box-shadow:none;margin:0 auto 10px;background:#fff;'+'height:auto!important;min-height:0!important;overflow:visible!important}'+
          '@page{size:letter portrait;margin:0}'+
          '@media print{html,body{background:#fff}'+
            '.docx-wrapper>section.docx{margin:0;width:auto;height:auto!important}.savebtn{display:none}}'+
          '.savebtn{position:fixed;top:14px;right:16px;background:#141a17;color:#fff;border:0;'+
            'border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;'+
            'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;z-index:9}'+
        '</style></head><body>'+
        '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
        caja.innerHTML +
        '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>'+
        '</body></html>');
      w.document.close();
      caja.innerHTML = '';
      if(typeof logActivity==='function'){
        logActivity('form','Pre-Grilling Cheese form generated',
          titulo + (typeof GC_STAGE_TXT!=='undefined' ? ' · '+GC_STAGE_TXT[gcStage(r,g)] : ''),
          (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '—');
      }
    })
    .catch(function(err){
      console.error('openGrillingPdf:', err);
      toast('Could not build the form: ' + err.message);
    });
}
