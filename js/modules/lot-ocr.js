// ===== LEER EL LOT DE UNA FOTO =====
// Sin servicios externos: Tesseract (OCR de codigo abierto) corre en el propio
// telefono. Se baja la primera vez que alguien toma una foto (~6-9 MB) y
// despues queda guardado y funciona sin señal.
//
// Leer "todo el texto" no basta: la foto trae codigos postales, codigos de
// barras, numeros de producto... Lo que lo hace confiable es la regla del lot:
// es una fecha juliana de 5 digitos, YYDDD (26289) o DDDYY (28826). De todos
// los numeros de la foto solo vale el que cae en una fecha cercana a la del
// registro. Lo que viene pegado (28826B0V0) se ignora.
//
// Probado con fotos reales (2026-10-16): nunca dio un lot equivocado; cuando
// falla, no encuentra nada, y el operador lo escribe mirando la foto.

var LOT_TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
var LOT_LADO = 2800;        // el lector trabaja sobre la foto grande, no la que se sube: con
                            // letras de ~35 px lee bien; con ~28 px ya falla (prueba 2026-10-16)
var _lotMotor = null;

function lotMotor(){
  if(_lotMotor) return _lotMotor;
  _lotMotor = new Promise(function(ok, mal){
    var crear = function(){
      Tesseract.createWorker('eng', 1).then(function(w){
        // '11' = texto disperso: lineas sueltas, como en una etiqueta
        // debug_file: Tesseract escribe sus avisos internos como errores de consola
        return w.setParameters({tessedit_pageseg_mode: '11', debug_file: '/dev/null'}).then(function(){ ok(w); });
      }).catch(mal);
    };
    if(window.Tesseract){ crear(); return; }
    var s = document.createElement('script');
    s.src = LOT_TESS; s.async = true;
    s.onload = crear;
    s.onerror = function(){ mal(new Error('The LOT reader could not load')); };
    document.head.appendChild(s);
  });
  _lotMotor.catch(function(){ _lotMotor = null; });   // se reintenta la proxima vez
  return _lotMotor;
}

// ---- La regla del lot ----
function _lotDia(d){ return Math.round((d - new Date(d.getFullYear(),0,1)) / 864e5) + 1; }
function _lotRef(refStr){
  var p = String(refStr || localDateStr()).slice(0,10).split('-');
  return new Date(+p[0], +p[1]-1, +p[2]);
}
// Un lot de 5 digitos -> su fecha, si la tiene (YYDDD o DDDYY) y es cercana
// a la del registro: de 7 dias antes a 1 despues. Si sirven los dos formatos,
// gana el mas cercano.
function lotInfo(lot, refStr){
  lot = String(lot || '');
  if(!/^\d{5}$/.test(lot)) return null;
  var ref = _lotRef(refStr), mejor = null;
  var probar = function(yy, ddd, formato){
    var y = 2000 + yy;
    var max = (y % 4 === 0) ? 366 : 365;
    if(ddd < 1 || ddd > max) return;
    var f = new Date(y, 0, ddd);
    var dias = Math.round((ref - f) / 864e5);
    if(dias < -1 || dias > 7) return;
    if(!mejor || Math.abs(dias) < Math.abs(mejor.dias))
      mejor = {lot:lot, formato:formato, fecha:f, dias:dias};
  };
  probar(+lot.slice(0,2), +lot.slice(2), 'YYDDD');
  probar(+lot.slice(3), +lot.slice(0,3), 'DDDYY');
  if(mejor){
    var f = mejor.fecha;
    mejor.fechaStr = f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');
    mejor.ok = mejor.dias === 0 || mejor.dias === 1;     // de hoy, o de ayer (turno de noche)
  }
  return mejor;
}
// Todos los numeros de 5 digitos del texto: seguidos, partidos 3+2 o 2+3 (la
// bolsa imprime "288 26"), o con letras pegadas detras ("28826B0V0")
function lotCandidatos(texto){
  var t = String(texto || '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  var vistos = {}, out = [];
  var add = function(x){ if(!vistos[x]){ vistos[x] = 1; out.push(x); } };
  var re = [/(?:^|\D)(\d{5})(?!\d)/g, /(?:^|\D)(\d{3}) (\d{2})(?!\d)/g, /(?:^|\D)(\d{2}) (\d{3})(?!\d)/g];
  re.forEach(function(r){
    var m;
    while((m = r.exec(t))){ add(m[1] + (m[2] || '')); r.lastIndex = m.index + 1; }
  });
  return out;
}
// Si no hay ninguno exacto: los primeros 5 digitos de un numero mas largo. En
// la etiqueta de Tia Angelita "28826B0V0" el lector puede ver "2882680": el
// lot y el sufijo pegados. La regla juliana descarta los numeros largos que
// no lo son (codigos de barras, numeros de producto).
function lotPrefijos(texto){
  var t = String(texto || '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  var out = [], m, r = /(?:^|\D)(\d{5})\d+/g;
  while((m = r.exec(t))){ if(out.indexOf(m[1]) < 0) out.push(m[1]); r.lastIndex = m.index + 1; }
  return out;
}
function _lotMejor(lista, refStr){
  return lista.map(function(x){ return lotInfo(x, refStr); }).filter(Boolean)
    .sort(function(a, b){ return Math.abs(a.dias) - Math.abs(b.dias); })[0] || null;
}

// Lo que escribe el operador: el primer grupo de 5 digitos, sin sufijo
function lotLimpio(v){
  var m = String(v || '').replace(/\s+/g, '').match(/\d{5}/);
  return m ? m[0] : String(v || '').replace(/\D/g, '').slice(0, 5);
}

// ---- Preparar la foto para el lector ----
// Girada, en gris y con el contraste estirado; o en blanco y negro puro.
function _lotLienzo(img, giro, modo){
  var w = img.width, h = img.height;
  var k = Math.min(1, LOT_LADO / Math.max(w, h));
  var cw = Math.round(w*k), ch = Math.round(h*k);
  var rot = (giro === 90 || giro === 270);
  var cv = document.createElement('canvas');
  cv.width = rot ? ch : cw; cv.height = rot ? cw : ch;
  var cx = cv.getContext('2d', {willReadFrequently:true});
  cx.translate(cv.width/2, cv.height/2);
  cx.rotate(giro * Math.PI / 180);
  cx.drawImage(img, -cw/2, -ch/2, cw, ch);
  var id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data, n = d.length / 4;
  var hist = new Uint32Array(256), g = new Uint8ClampedArray(n);
  for(var i=0;i<n;i++){
    var v = (d[i*4]*299 + d[i*4+1]*587 + d[i*4+2]*114) / 1000 | 0;
    g[i] = v; hist[v]++;
  }
  // percentiles 2 % y 98 % -> estirar el contraste entre ellos
  var acum = 0, lo = 0, hi = 255;
  for(var a=0;a<256;a++){ acum += hist[a]; if(acum >= n*0.02){ lo = a; break; } }
  acum = 0;
  for(var b=255;b>=0;b--){ acum += hist[b]; if(acum >= n*0.02){ hi = b; break; } }
  var rango = Math.max(1, hi - lo);
  for(var j=0;j<n;j++){
    var e = Math.max(0, Math.min(255, (g[j] - lo) * 255 / rango));
    if(modo === 'bn') e = e < 140 ? 0 : 255;
    d[j*4] = d[j*4+1] = d[j*4+2] = e;
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.putImageData(id, 0, 0);
  return cv;
}

// El lot en un texto: primero los numeros exactos de 5 digitos, y si no hay,
// los primeros 5 de uno mas largo
function _lotDelTexto(texto, refStr){
  return _lotMejor(lotCandidatos(texto), refStr) || _lotMejor(lotPrefijos(texto), refStr);
}

// Acercarse a un renglon: recortarlo de la foto (con margen, y mas hacia la
// derecha, donde suele cortarse el numero), agrandarlo y leerlo solo.
function _lotRenglon(cv, bb){
  var h = Math.max(8, bb.y1 - bb.y0);
  var x0 = Math.max(0, bb.x0 - h*0.5), y0 = Math.max(0, bb.y0 - h*0.45);
  var x1 = Math.min(cv.width, bb.x1 + h*3), y1 = Math.min(cv.height, bb.y1 + h*0.45);
  var k = Math.max(1, Math.min(4, 90 / h));            // letra de ~90 px de alto
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((x1-x0)*k)); c.height = Math.max(1, Math.round((y1-y0)*k));
  var cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(cv, x0, y0, x1-x0, y1-y0, 0, 0, c.width, c.height);
  return c;
}

// Lee el lot de una imagen ya cargada. Para cada forma de la foto (derecha,
// girada a cada lado, en blanco y negro): primero la foto entera; si no sale,
// se acerca a los renglones que dicen LOT o traen numeros. Para en cuanto
// encuentra uno valido. Devuelve lotInfo(...) o null.
function lotLeer(img, refStr){
  var intentos = [[0,'gris'], [270,'gris'], [90,'gris'], [0,'bn']];
  return lotMotor().then(function(w){
    var i = 0;
    var siguiente = function(){
      if(i >= intentos.length) return null;
      var it = intentos[i++];
      var cv = _lotLienzo(img, it[0], it[1]);
      return w.setParameters({tessedit_pageseg_mode: '11'})
        .then(function(){ return w.recognize(cv, {}, {text:true, blocks:true}); })
        .then(function(r){
          var d = (r && r.data) || {};
          var hallado = _lotDelTexto(d.text, refStr);
          if(hallado) return hallado;
          // los renglones que valen la pena: primero los que dicen LOT
          var lineas = [];
          (d.blocks || []).forEach(function(b){ (b.paragraphs || []).forEach(function(p){
            (p.lines || []).forEach(function(l){ if(/OT|\d{3}/i.test(l.text || '')) lineas.push(l); });
          }); });
          lineas.sort(function(a, b){ return (/OT/i.test(b.text) ? 1 : 0) - (/OT/i.test(a.text) ? 1 : 0); });
          lineas = lineas.slice(0, 4);
          var j = 0;
          var cerca = function(){
            if(j >= lineas.length) return w.setParameters({tessedit_pageseg_mode: '11'}).then(siguiente);
            var l = lineas[j++];
            return w.setParameters({tessedit_pageseg_mode: '7'})          // un solo renglon
              .then(function(){ return w.recognize(_lotRenglon(cv, l.bbox)); })
              .then(function(r2){
                var h2 = _lotDelTexto(r2 && r2.data ? r2.data.text : '', refStr);
                return h2 || cerca();
              });
          };
          return cerca();
        });
    };
    return siguiente().then(function(x){
      return w.setParameters({tessedit_pageseg_mode: '11'}).then(function(){ return x; });
    });
  });
}
