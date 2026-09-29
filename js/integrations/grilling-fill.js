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
        _gxSangrias = sangriasDeTablas(xml);
        return zip.generateAsync({type:'blob', compression:'DEFLATE'});
      });
    });
}

// La sangria de cada tabla, en el orden en que aparecen en el documento.
// El visor no la lee, y sin ella la tabla de Chemical Testing se pega al
// margen izquierdo en vez de quedar donde la puso QA.
var _gxSangrias = [];
function sangriasDeTablas(xml){
  var fuera = [];
  var partes = xml.split('<w:tbl>');
  for(var i = 1; i < partes.length; i++){
    var props = partes[i].slice(0, partes[i].indexOf('</w:tblPr>'));
    var m = /<w:tblInd w:w="(-?\d+)"(?:[^>]*w:type="(\w+)")?/.exec(props);
    // Word lo guarda en veinteavos de punto
    fuera.push(m ? (parseInt(m[1], 10) / 20) : 0);
  }
  return fuera;
}

// ===== QUE LAS TABLAS MIDAN LO QUE DICE LA FORMA =====
// El visor pone el ancho de cada columna en el <col>, pero deja que el
// navegador le SUME encima el relleno y el borde de cada celda. Con eso la
// tabla de Chemical Testing salia 707px de ancho cuando en Word mide 660, y
// como el texto se reacomodaba a un ancho que no era el suyo, los renglones
// caian en otro sitio y la forma se veia deformada.
//
// Con box-sizing el ancho del <col> vuelve a ser el ancho real de la columna
// —como la rejilla de la tabla en Word— y con table-layout fijo el navegador
// la respeta en vez de repartir a su gusto.
var GX_AJUSTE_TABLAS =
  'section.docx table,section.docx col,section.docx td,section.docx th' +
    '{box-sizing:border-box}' +
  'section.docx table{table-layout:fixed}';

function ajustarTablas(caja){
  var st = document.createElement('style');
  st.textContent = GX_AJUSTE_TABLAS;
  caja.insertBefore(st, caja.firstChild);
  // Y cada tabla vuelve a su sangria, en el mismo orden del documento.
  // Solo las del cuerpo: las del encabezado y el pie viven en otro archivo
  // dentro del .docx y no entran en esta cuenta.
  var tablas = caja.querySelectorAll('section.docx > article > table');
  for(var i = 0; i < tablas.length && i < _gxSangrias.length; i++){
    if(_gxSangrias[i]) tablas[i].style.marginLeft = _gxSangrias[i] + 'pt';
  }
}

// ===== REPARTIR EL CONTENIDO EN HOJAS =====
// El visor dibuja el documento entero en una sola hoja, por alta que salga, y
// deja que el navegador lo parta por donde caiga al imprimir: ahi es donde la
// forma se deformaba —el corte caia en mitad de una tabla y la segunda hoja
// salia sin encabezado—.
//
// Word no hace eso: llena la hoja, y lo que no cabe arranca en otra con su
// encabezado y su pie. Eso es lo que se hace aqui: se mide cuanto cabe en la
// hoja de carta con los margenes de la forma, y lo que se pasa se muda a una
// hoja nueva con copia del encabezado y del pie.
function paginarDocumento(caja){
  var envoltura = caja.querySelector('.docx-wrapper') || caja;
  var hoja = caja.querySelector('section.docx');
  if(!hoja) return 0;

  var css = window.getComputedStyle(hoja);
  var alto = parseFloat(css.minHeight) || parseFloat(css.height) || 0;
  if(!alto) return 1;                      // sin altura de pagina no hay nada que repartir

  var cabecera = hoja.querySelector(':scope > header');
  var pie      = hoja.querySelector(':scope > footer');
  var sobra    = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) +
                 (cabecera ? cabecera.getBoundingClientRect().height : 0) +
                 (pie ? pie.getBoundingClientRect().height : 0);
  var util = alto - sobra - 2;             // 2px de respeto para no rozar el borde
  if(util <= 0) return 1;

  var hojas = 1, tope = 60;                // el tope es por si algo midiera 0 y no avanzara
  while(tope-- > 0){
    var cuerpo = hoja.querySelector(':scope > article');
    if(!cuerpo) break;
    var hijos = Array.prototype.slice.call(cuerpo.children);
    if(hijos.length < 2) break;

    // Se mide contra el inicio del cuerpo, no contra la ventana
    var arranque = cuerpo.getBoundingClientRect().top;
    var corte = -1;
    for(var i = 0; i < hijos.length; i++){
      if(hijos[i].getBoundingClientRect().bottom - arranque > util){ corte = i; break; }
    }
    if(corte < 0) break;                   // ya cabe todo
    if(corte === 0) corte = 1;             // un solo bloque mas alto que la hoja: se deja

    var nueva = hoja.cloneNode(false);
    if(cabecera) nueva.appendChild(cabecera.cloneNode(true));
    var cuerpoNuevo = cuerpo.cloneNode(false);
    nueva.appendChild(cuerpoNuevo);
    if(pie) nueva.appendChild(pie.cloneNode(true));
    while(cuerpo.children.length > corte) cuerpoNuevo.appendChild(cuerpo.children[corte]);
    envoltura.appendChild(nueva);
    hoja = nueva; hojas++;
  }
  return hojas;
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
        ignoreHeight: false,       // la hoja mide lo que dice la forma: carta
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true         // el logo va incrustado: sobrevive a la otra ventana
      });
    })
    .then(function(){
      ajustarTablas(caja);        // primero el ancho real, que de el sale la altura
      paginarDocumento(caja);
      var w = window.open('', '_blank');
      if(!w){ toast('Allow pop-ups to open the form'); return; }
      var titulo = grillingFileName(r);   // el navegador lo usa como nombre del PDF
      w.document.write(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+_gxEsc(titulo)+'</title>'+
        '</head><body>'+
        '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+
        caja.innerHTML +
        // Este bloque va DESPUES del contenido a proposito: el visor mete sus
        // propios estilos ahi dentro, y el ultimo que se lee es el que manda.
        '<style>'+
          'html,body{margin:0;padding:0;background:#8c8c8c}'+
          '.docx-wrapper{background:transparent!important;padding:14px 0!important;'+
            'display:block!important}'+
          '.docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto 14px!important;'+
            'background:#fff!important;overflow:hidden!important}'+
          '@page{size:letter portrait;margin:0}'+
          '@media print{'+
            'html,body{background:#fff}'+
            '.docx-wrapper{padding:0!important}'+
            '.docx-wrapper>section.docx{margin:0!important;break-after:page;page-break-after:always}'+
            '.docx-wrapper>section.docx:last-of-type{break-after:auto;page-break-after:auto}'+
            '.savebtn{display:none}}'+
          '.savebtn{position:fixed;top:14px;right:16px;background:#141a17;color:#fff;border:0;'+
            'border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;'+
            'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;z-index:9}'+
        '</style>'+
        '<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>'+
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
