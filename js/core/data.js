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
var LOGO_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 96">'+
  '<path d="M48 6 L84 19 v27 c0 21-15 34-36 42 C27 80 12 67 12 46 V19 Z" fill="#16a34a"/>'+
  '<path d="M32 48 l12 12 21-25" stroke="#ffffff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'+
  '<text x="100" y="63" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="800" fill="#5b6478" letter-spacing="3">SAFETY</text>'+
  '</svg>';
var LOGO='data:image/svg+xml;utf8,'+encodeURIComponent(LOGO_SVG);
// Variante clara para la barra lateral oscura del escritorio
var LOGO_LIGHT='data:image/svg+xml;utf8,'+encodeURIComponent(LOGO_SVG.replace('#5b6478','#f2f4f7'));

// ===== STATE =====
// customPkg: peso que viene de un producto del catálogo y no está en PKGS
var st = {line:null, shift:null, pkg:null, customPkg:null, samples:['','','','',''], sealChecks:{}, wIssue:null};
var gmpAnswers = {};
var gmpShift = null;
var metalAnswers = {};
var donutChart = null, trendChart = null;

// ===== DB =====
function getDB(){
  var db=JSON.parse(localStorage.getItem('safety_db')||localStorage.getItem('caputo_db')||'{}');
  if(!db.weights) db.weights=[];
  if(!db.seals)   db.seals=[];
  if(!db.gmps)    db.gmps=[];
  if(!db.holds)   db.holds=[];
  if(!db.temps)   db.temps=[];
  return db;
}
function saveDB(db){localStorage.setItem('safety_db',JSON.stringify(db))}

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

