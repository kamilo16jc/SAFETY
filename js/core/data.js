// ===== DATA =====
// Cada paquete lleva su unidad. Los de onzas se miden y comparan EN ONZAS
// (antes su target estaba en libras y marcaba error al pesar en oz).
var PKGS = [
  {label:'1 lb',    min:0.95,  max:1.04,  unit:'lb'},
  {label:'2 lbs',   min:1.93,  max:2.07,  unit:'lb'},
  {label:'2.5 lbs', min:2.41,  max:2.60,  unit:'lb'},
  {label:'3 lbs',   min:2.95,  max:3.10,  unit:'lb'},
  {label:'4.40 lbs',min:4.28,  max:4.52,  unit:'lb'},
  {label:'5 lbs',   min:4.86,  max:5.14,  unit:'lb'},
  {label:'7 lbs',   min:6.83,  max:7.17,  unit:'lb'},
  {label:'10 lbs',  min:9.78,  max:10.22, unit:'lb'},
  {label:'4 oz',    min:3.744, max:4.256, unit:'oz'},   // = 0.234–0.266 lb, ahora en oz
  {label:'8 oz',    min:7.456, max:8.432, unit:'oz'}    // = 0.466–0.527 lb, ahora en oz
];
var SEAL_CHECKS = ['Visual','Dunk Tank','Printing'];

// Estados de la línea en Weights. "running" = normal (se toman pesos). Los otros
// tres registran un "issue" (con hora y comentario) porque no se pudo pesar; no
// llevan peso ni compliance y se excluyen del Dashboard.
var WEIGHT_ISSUES = {
  labeling: { label:'Labeling',  note:'Line stopped for labeling', comment:'Line stopped for labeling — weights not taken' },
  break:    { label:'On break',  note:'Line on break',            comment:'Line on break — weights not taken' },
  down:     { label:'Line down', note:'Line down',                comment:'Line down — weights not taken' }
};
// "HH:MM" (24h) -> "h:MM AM/PM" para el comentario del issue
function fmtTime12(t){
  if(!t || String(t).indexOf(':')<0) return t||'';
  var p=String(t).split(':'), h=parseInt(p[0],10), m=p[1];
  if(isNaN(h)) return t;
  var ap=h>=12?'PM':'AM', h12=h%12; if(h12===0) h12=12;
  return h12+':'+m+' '+ap;
}
// Comentario por defecto del issue, con la hora incluida
function weightIssueComment(issue, time){
  var info = WEIGHT_ISSUES[issue]; if(!info) return '';
  return info.comment + (time ? ' ('+fmtTime12(time)+')' : '');
}
// Minutos dentro de los cuales dos registros de la misma línea se consideran
// sospechosos (el operador olvidó cambiar la línea al pasar a otra máquina).
var DUP_WINDOW_MIN = 20;
var MD_QUESTIONS = [
  'Has a routine check been performed within the last two & half hours, since break, or since changeover?',
  'Operator used a unit that was successfully passed through the metal detector?',
  'Operator passed each probe through one time?',
  'Operator placed each probe as close to the center of unit as possible?',
  'Operator replaced unit upstream of metal detector before resetting conveyor?',
  'Was the learn process performed correctly or not needed as the machine was functional?',
  'Did the operator perform a routine check after the learn process?'
];
// Turno según la hora. 2do turno: 3:30 PM – 2:00 AM. 1er turno: 2:00 AM – 3:30 PM.
var SECOND_SHIFT_START = 15*60 + 30;  // 15:30
var SECOND_SHIFT_END   = 2*60;        // 02:00 (madrugada)
function expectedShift(d){
  d = d || new Date();
  var m = d.getHours()*60 + d.getMinutes();
  return (m >= SECOND_SHIFT_START || m < SECOND_SHIFT_END) ? 2 : 1;
}
function shiftMatchesTime(n, d){ return n === expectedShift(d); }
function warnShiftMismatch(n){
  if(typeof toast !== 'function') return;
  toast((n===1?'1st':'2nd')+' shift doesn’t match the time — 2nd shift runs 3:30 PM to 2:00 AM');
}

// Shift reports: categorías de la nota y áreas por defecto (editables)
var SHIFT_CATEGORIES = ['Quality','Maintenance','Sanitation','Safety','Operations','Personnel','Other'];
var SHIFT_AREAS_DEFAULT = [
  'Building 1931','Building 1935','Building 1945',
  'Line 1','Line 2','Line 3','Line 4','Line 5','Line 6',
  'Chopping Area','Grilling','Packaging','Cold Storage','Shipping / Receiving',
  'Sanitation','Maintenance Shop','Warehouse'
];
function getAreas(){
  var db = getDB();
  if(!db.areas || !db.areas.length) db.areas = SHIFT_AREAS_DEFAULT.slice();
  return db.areas;
}
function saveAreas(list){
  var db = getDB();
  db.areas = list;
  saveDB(db);
  if(window.saveAreasToFirebase) window.saveAreasToFirebase(list);
}

// SQF #2.5.C.2 — niveles de severidad del CAPA, con el plazo de investigación
var CAPA_SEVERITY = [
  {key:'major', label:'Major', hours:24, deadline:'within 24 hours',
   desc:'Potential to cause major production breakdowns/delays in fulfilling orders. Potential to cause illness and/or death in customers; potential food safety risk(s) may be posed.'},
  {key:'moderate', label:'Moderate', hours:48, deadline:'within 2 days',
   desc:'Potential to cause reoccurring maintenance issues in production and/or quality issues in finished products. Potential to cause illness/intolerances, negative spread of media news, or reduced customer satisfaction/sales.'},
  {key:'minimal', label:'Minimal', hours:96, deadline:'within 4 days',
   desc:'Potential to cause unfavorable conditions in production and/or any aspect of operations for staff, raw materials, packaging materials, and/or finished products. Potential to cause noncompliance with regulations. May be an isolated/sporadic incident or a food quality risk.'}
];

var GMP_ITEMS = [
  'Gloves','Smocks','Handwashing','Unsecured Jewelry/Loose Objects','Fingernails',
  'Hairnets/Beardnets','Personal Hygiene and Cologne/Perfume','Color Code Adherence',
  'Eating/Drinking/Smoking/Chewing/Spitting','Eyelashes',
  'No Visible Signs of Infectious Disease, Major Uncovered Cuts or Lesions',
  'Minor Cuts Covered with Metal Detectable Bandage',
  'Pedestrian and Forklift/Pallet Jack Traffic',
  'Open Product, Ingredients/Materials, Packaging Covered and Off Floor',
  'Doors Closed and Not Kept Open for Extended Periods of Time',
  'No Glass, Brittle Plastic, or Ceramic',
  'Air Hoses & Wash Down Water Hoses Stored on Racks off Floor',
  'Hairnets, Gloves, and Disposable Aprons Disposed of Prior to Leaving Facility',
  'Temporary Repairs on Food Contact & Non-Food Contact Equipment',
  'Visible signs of wearing on all food contact utensils',
  'Floors in good condition'
];
var LOGO_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="1025" height="320" viewBox="0 0 1025 320" role="img" aria-labelledby="title desc"> <title id="title">NEXORA</title> <desc id="desc">Logo de NEXORA: monograma N azul y turquesa junto al nombre en azul marino. Fondo transparente.</desc> <defs> <linearGradient id="nexora-bridge" x1="40" y1="0" x2="132" y2="168" gradientUnits="userSpaceOnUse"> <stop offset="0" stop-color="#2463EB"/> <stop offset="0.5" stop-color="#1689D4"/> <stop offset="1" stop-color="#10AAA7"/> </linearGradient> </defs> <g id="symbol" transform="translate(64 76)"> <path id="left-stem" fill="#2463EB" d="M 16 0 H 42 V 168 H 0 V 16 Q 0 0 16 0 Z"/> <path id="right-stem" fill="#10AAA7" d="M 126 0 H 152 Q 168 0 168 16 V 152 Q 168 168 152 168 H 126 Z"/> <path id="connection" fill="url(#nexora-bridge)" d="M 36 0 H 66 L 132 108 V 168 H 102 L 36 60 Z"/> </g> <g id="wordmark" fill="#17253F"> <path id="letter-n" d="M 302.4023 214 L 302.4023 106 L 319.2295 106 L 326.4193 127.5694 L 326.4193 214 Z M 376.9008 214 L 313.2635 132.4646 L 319.2295 106 L 382.8669 187.5354 Z M 376.9008 214 L 370.4759 192.4306 L 370.4759 106 L 394.4929 106 L 394.4929 214 Z"/> <path id="letter-e" d="M 418.8975 214 L 418.8975 106 L 442.9144 106 L 442.9144 214 Z M 437.2544 214 L 437.2544 193.1955 L 496.4555 193.1955 L 496.4555 214 Z M 437.2544 168.8725 L 437.2544 148.8329 L 491.1014 148.8329 L 491.1014 168.8725 Z M 437.2544 126.6516 L 437.2544 106 L 495.6907 106 L 495.6907 126.6516 Z"/> <path id="letter-x" d="M 585.1093 214 L 554.9734 165.813 L 552.0669 165.813 L 510.4578 106 L 539.064 106 L 568.7411 151.2805 L 571.6476 151.2805 L 613.2567 214 Z M 508.4691 214 L 548.3955 156.1756 L 566.9054 166.5779 L 535.8516 214 Z M 572.5654 163.0595 L 554.0555 152.6572 L 584.0385 106 L 611.421 106 Z"/> <path id="letter-o" d="M 681.1059 215.8357 Q 668.868 215.8357 658.5422 211.5524 Q 648.2164 207.2691 640.4147 199.6204 Q 632.613 191.9717 628.3297 181.7989 Q 624.0465 171.6261 624.0465 159.847 Q 624.0465 147.915 628.3297 137.8187 Q 632.613 127.7224 640.2618 120.1501 Q 647.9105 112.5779 658.2363 108.3711 Q 668.562 104.1643 680.8 104.1643 Q 692.885 104.1643 703.2108 108.3711 Q 713.5365 112.5779 721.2618 120.1501 Q 728.987 127.7224 733.2703 137.8952 Q 737.5535 148.068 737.5535 160 Q 737.5535 171.779 733.2703 181.9518 Q 728.987 192.1246 721.3382 199.6969 Q 713.6895 207.2691 703.3637 211.5524 Q 693.038 215.8357 681.1059 215.8357 Z M 680.8 193.9603 Q 690.4374 193.9603 697.7037 189.6771 Q 704.97 185.3938 708.9473 177.6686 Q 712.9246 169.9433 712.9246 159.847 Q 712.9246 152.1983 710.63 146.0028 Q 708.3354 139.8074 704.0521 135.2946 Q 699.7688 130.7819 693.8793 128.4108 Q 687.9898 126.0397 680.8 126.0397 Q 671.1626 126.0397 663.8963 130.2465 Q 656.63 134.4533 652.6527 142.0255 Q 648.6754 149.5977 648.6754 159.847 Q 648.6754 167.4958 650.97 173.7677 Q 653.2646 180.0397 657.4714 184.5524 Q 661.6782 189.0652 667.6442 191.5127 Q 673.6102 193.9603 680.8 193.9603 Z"/> <path id="letter-r" d="M 774.8079 169.4844 L 774.8079 151.7394 L 797.6011 151.7394 Q 804.7909 151.7394 808.6918 148.068 Q 812.5926 144.3966 812.5926 138.1246 Q 812.5926 132.3116 808.7683 128.4873 Q 804.9439 124.6629 797.7541 124.6629 L 774.8079 124.6629 L 774.8079 106 L 800.5076 106 Q 811.2159 106 819.3235 110.0538 Q 827.4312 114.1076 832.0204 121.2975 Q 836.6096 128.4873 836.6096 137.8187 Q 836.6096 147.3031 832.0204 154.4164 Q 827.4312 161.5297 819.1705 165.5071 Q 810.9099 169.4844 799.7428 169.4844 Z M 756.451 214 L 756.451 106 L 780.468 106 L 780.468 214 Z M 815.1932 214 L 781.5388 167.4958 L 803.5671 161.5297 L 843.6465 214 Z"/> <path id="letter-a" d="M 851.6827 214 L 894.5156 106 L 916.238 106 L 958.6119 214 L 933.2181 214 L 900.7875 124.3569 L 909.5071 124.3569 L 876.6176 214 Z M 876.0057 194.4193 L 876.0057 174.8385 L 934.9008 174.8385 L 934.9008 194.4193 Z"/> </g> </svg>';
var LOGO='data:image/svg+xml;utf8,'+encodeURIComponent(LOGO_SVG);
// Variante clara: la palabra en hueso, para cuando el fondo es oscuro
var LOGO_LIGHT='data:image/svg+xml;utf8,'+encodeURIComponent(LOGO_SVG.replace('#17253F','#F2F4F7'));

// ===== STATE =====
// customPkg: peso que viene de un producto del catálogo y no está en PKGS
var st = {line:null, shift:null, pkg:null, customPkg:null, samples:['','','','',''], sealChecks:{}, wIssue:null};
var gmpAnswers = {};
var gmpShift = null;
var metalAnswers = {};
var donutChart = null, trendChart = null;

// ===== DB =====
function getDB(){
  if(_dbCache) return _dbCache;
  _dbCache = _readAll();
  return _dbCache;
}

// ============================================================
// LA BASE EN EL EQUIPO
//
// Dos cosas se arreglaron aqui, las dos medidas con la prueba de carga:
//
// 1. LEER. getDB() hacia JSON.parse de TODA la base en cada llamada, y se la
//    llama dentro de bucles: pintar una hoja con un mes de datos hacia 1.698
//    lecturas y el 99% del tiempo se iba en reinterpretar los mismos bytes.
//    Ahora se interpreta una vez y se comparte el objeto.
//
// 2. GUARDAR. Todo vivia en UNA sola llave, asi que guardar un peso reescribia
//    las once colecciones: 140 ms de pantalla congelada con 30.000 registros.
//    Ahora cada coleccion tiene su llave y solo se reescribe la que cambio.
//    Quien guarda puede decir cual toco —saveDB(db,'weights')—; si no lo dice,
//    se revisan todas comparando contra lo ultimo escrito, que sigue siendo
//    mas barato que escribirlo todo.
// ============================================================
var DB_PREFIX = 'safety_db__';
var LEGACY_KEY = 'safety_db';
var _dbCache = null;
// Coleccion -> huella de lo que quedo guardado. Se guarda la HUELLA y no el
// texto: comparar cuesta lo mismo y no se tiene una segunda copia de toda la
// base ocupando memoria.
var _lastWritten = {};
function _huella(txt){
  var h = 5381;
  for(var i=0;i<txt.length;i++) h = ((h*33) ^ txt.charCodeAt(i)) >>> 0;
  return txt.length + ':' + h;
}
var _dirty = {};           // colecciones por escribir
var _saveTimer = null;

function _readAll(){
  var db = {};
  // Primero lo nuevo: una llave por coleccion
  var idx = null;
  try { idx = JSON.parse(localStorage.getItem(DB_PREFIX+'_index') || 'null'); } catch(e){}
  if(idx && idx.length){
    for(var i=0;i<idx.length;i++){
      var k = idx[i];
      try {
        var raw = localStorage.getItem(DB_PREFIX+k);
        db[k] = raw ? JSON.parse(raw) : null;
        _lastWritten[k] = _huella(raw || '');
      } catch(e){ db[k] = null; }
    }
  } else {
    // Migracion desde la llave unica de siempre
    try {
      db = JSON.parse(localStorage.getItem(LEGACY_KEY) || localStorage.getItem('caputo_db') || '{}');
    } catch(e){ db = {}; }
    _dbCache = db;
    _markAllDirty(db);
    _writeNow();
    try { localStorage.removeItem(LEGACY_KEY); } catch(e){}
  }
  if(!db.weights) db.weights=[];
  if(!db.seals)   db.seals=[];
  if(!db.gmps)    db.gmps=[];
  if(!db.holds)   db.holds=[];
  if(!db.temps)   db.temps=[];
  return db;
}

function _markAllDirty(db){
  Object.keys(db||{}).forEach(function(k){ _dirty[k] = 1; });
}

// Escribe lo pendiente. Devuelve false si el navegador se quedo sin sitio.
// Con todo=true revisa TODAS las colecciones, ignorando las pistas: asi, si
// alguna pista se quedara corta, nada se queda sin guardar.
function _writeNow(todo){
  _saveTimer = null;
  if(!_dbCache) return true;
  var db = _dbCache;
  var claves = todo ? Object.keys(db) : Object.keys(_dirty);
  if(!claves.length) claves = Object.keys(db);
  var ok = true, escritas = 0;
  for(var i=0;i<claves.length;i++){
    var k = claves[i];
    if(!(k in db)) continue;
    var txt;
    try { txt = JSON.stringify(db[k]); } catch(e){ continue; }
    var h = _huella(txt);
    if(_lastWritten[k] === h) continue;         // esa coleccion no cambio
    try {
      localStorage.setItem(DB_PREFIX+k, txt);
      _lastWritten[k] = h;
      escritas++;
    } catch(e){
      ok = false;
      console.error('No se pudo guardar en el equipo:', e && e.name);
      if(typeof toast === 'function'){
        toast('El almacenamiento del equipo esta lleno \u2014 el registro no se guardo');
      }
      break;
    }
  }
  if(escritas){
    try { localStorage.setItem(DB_PREFIX+'_index', JSON.stringify(Object.keys(db))); } catch(e){}
  }
  _dirty = {};
  return ok;
}

// saveDB(db)            -> revisa todas las colecciones
// saveDB(db,'weights')  -> solo esa, que es lo normal al guardar un registro
function _marcar(coleccion){
  if(!coleccion) return false;
  if(Object.prototype.toString.call(coleccion)==='[object Array]'){
    for(var i=0;i<coleccion.length;i++) _dirty[coleccion[i]] = 1;
    return coleccion.length > 0;
  }
  _dirty[coleccion] = 1;
  return true;
}

function saveDB(db, coleccion){
  if(db) _dbCache = db;
  if(!_marcar(coleccion)) _markAllDirty(_dbCache);
  if(_saveTimer) return;
  _saveTimer = setTimeout(_writeNow, 0);
}

// Escribe ya, sin esperar
function saveDBNow(db, coleccion){
  if(db) _dbCache = db;
  if(!_marcar(coleccion)) _markAllDirty(_dbCache);
  if(_saveTimer){ clearTimeout(_saveTimer); _saveTimer = null; }
  return _writeNow();
}

// Si la pestana se oculta o se cierra, lo pendiente se escribe de inmediato
if(typeof window !== 'undefined'){
  // Al cerrar u ocultar la pestana se revisa TODO, no solo lo marcado
  window.addEventListener('pagehide', function(){ _writeNow(true); });
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') _writeNow(true);
  });
}

// ===== IDENTIFICADOR DE UN REGISTRO =====
// Era Date.now(): con veinte equipos guardando a la vez, dos registros
// distintos salian con el mismo numero, y como el documento de Firestore se
// llama como el registro, uno pisaba al otro. Ahora el numero lleva pegada la
// huella del equipo, y dentro del equipo nunca se repite.
function deviceSalt(){
  var v = 0;
  try {
    v = parseInt(localStorage.getItem('safety_device') || '', 10);
    if(!v || isNaN(v) || v < 1 || v > 4095){
      v = 1 + Math.floor(Math.random() * 4095);
      localStorage.setItem('safety_device', String(v));
    }
  } catch(e){ v = 1 + Math.floor(Math.random() * 4095); }
  return v;
}

var _lastRecordId = 0;
function newRecordId(){
  // 4096 huellas posibles por milisegundo; el tope sigue siendo seguro en JS
  var id = Date.now() * 4096 + deviceSalt();
  if(id <= _lastRecordId) id = _lastRecordId + 4096;   // dos en el mismo ms
  _lastRecordId = id;
  return id;
}

// Rango objetivo de un registro de peso. Puede no existir: los productos
// creados sin target sólo registran el peso, sin marcar pass/fail.
function recTarget(r){
  if(r && r.target && r.target.min!=null && r.target.max!=null) return r.target;
  if(r && r.pkg!=null && PKGS[r.pkg]) return PKGS[r.pkg];
  return null;
}
// Etiqueta de compliance tolerante a registros sin target
function compLabel(c){ return (c==null || isNaN(c)) ? '—' : c+'%'; }

// ===== UNIDAD DE PESO (lb / oz) =====
// Unidad de un paquete (PKGS o customPkg del producto). Si no trae unit, se
// infiere del label ("4 oz" -> oz).
function pkgUnit(p){
  if(!p) return 'lb';
  if(p.unit) return p.unit;
  return /oz|ounce/i.test(p.label||'') ? 'oz' : 'lb';
}
// Unidad de un registro ya guardado (usa el campo unit o infiere del pkgLabel)
function recUnit(r){
  if(r && r.unit) return r.unit;
  return /oz|ounce/i.test((r&&r.pkgLabel)||'') ? 'oz' : 'lb';
}
// Etiqueta legible de la unidad
function unitLabel(u){ return u==='oz' ? 'oz' : 'lbs'; }
// Factor para convertir un valor a libras (para sumas del Dashboard)
function toLbFactor(u){ return u==='oz' ? 1/16 : 1; }

