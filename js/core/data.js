// ===== DATA =====
var PKGS = [
  {label:'1 lb',    min:0.95,  max:1.04},
  {label:'2 lbs',   min:1.93,  max:2.07},
  {label:'2.5 lbs', min:2.41,  max:2.60},
  {label:'3 lbs',   min:2.95,  max:3.10},
  {label:'4.40 lbs',min:4.28,  max:4.52},
  {label:'5 lbs',   min:4.86,  max:5.14},
  {label:'7 lbs',   min:6.83,  max:7.17},
  {label:'10 lbs',  min:9.78,  max:10.22},
  {label:'4 oz',    min:0.234, max:0.266},
  {label:'8 oz',    min:0.466, max:0.527}
];
var SEAL_CHECKS = ['Visual','Dunk Tank','Printing'];
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

// ===== STATE =====
var st = {line:null, shift:null, pkg:null, samples:['','','','',''], sealChecks:{}};
var gmpAnswers = {};
var gmpShift = null;
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

