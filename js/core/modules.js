// ===== MÓDULOS DEL SISTEMA =====
// La navegación y los permisos salen de esta tabla. Antes el menú mostraba las
// 18 pantallas a todo el mundo y los permisos estaban regados por 8 archivos.
//
// Search, Reports y Shift Report son los MISMOS archivos, pero se abren con el
// alcance del módulo desde el que entras: en QA Inspection ves lo de QA, en
// Laboratorio lo del lab, y el administrador lo ve todo.

var MODULES = [
  { id:'qa', color:'#4ade80', ink:'#047857', name:'QA Inspection', icon:'clipboard', items:[
      {screen:'screen-weight',    name:'Weights',          icon:'scale', color:'#047857'},
      {screen:'screen-samplelist',name:'List Samples',     icon:'droplet', color:'#0f766e'},
      {screen:'screen-seal',      name:'Seal Bags',        icon:'droplet', color:'#0369a1'},
      {screen:'screen-temp',      name:'Temperatures',     icon:'thermo', color:'#b45309'},
      {screen:'screen-gmp',       name:'GMP Audit',        icon:'clipboard', color:'#7c3aed'},
      {screen:'screen-metal',     name:'Metal Detector',   icon:'magnet', color:'#be123c'},
      {screen:'screen-capa',      name:'CAPA Reports',     icon:'alert', color:'#0e7490'},
      {screen:'screen-hold',      name:'Hold Cases',       icon:'lock', color:'#15803d'},
      {screen:'screen-shift',     name:'Shift Report',     icon:'note', color:'#c2410c'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc', color:'#6d28d9'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search', color:'#9d174d'}
  ]},
  { id:'lab', color:'#38bdf8', ink:'#0369a1', name:'QA Laboratory', icon:'droplet', items:[
      {screen:'screen-analysis',  name:'Sample Analysis',  icon:'clipboard', color:'#047857'},
      {screen:'screen-yeast',     name:'Yeast & Mold',     icon:'clock', color:'#a16207'},
      {screen:'screen-lab',       name:'Lab Samples',      icon:'droplet', color:'#0369a1'},
      {screen:'screen-grilling',  name:'Grilling Cheese',  icon:'thermo', soon:true, color:'#b45309'},
      {screen:'screen-raw',       name:'Raw Material',     icon:'box',    soon:true, color:'#7c3aed'},
      {screen:'screen-shift',     name:'Shift Report',     icon:'note', color:'#be123c'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc', color:'#0e7490'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search', color:'#15803d'}
  ]},
  { id:'production', color:'#fbbf24', ink:'#b45309', name:'Production', icon:'calendar', items:[
      {screen:'screen-production',name:'Schedule',         icon:'calendar', color:'#047857'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc', color:'#0369a1'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search', color:'#b45309'}
  ]},
  { id:'products', color:'#c084fc', ink:'#7c3aed', name:'Products', icon:'box', items:[
      {screen:'screen-products',  name:'Product Catalog',  icon:'box', color:'#047857'}
  ]},
  { id:'admin', color:'#fb7185', ink:'#be123c', name:'Administrator', icon:'sliders', items:[
      {screen:'screen-dashboard', name:'Dashboard',        icon:'chart', color:'#047857'},
      {screen:'screen-reports',   name:'Reports · all',    icon:'doc', color:'#0369a1'},
      {screen:'screen-lotsearch', name:'Search · all',     icon:'search', color:'#b45309'},
      {screen:'screen-activity',  name:'Activity Log',     icon:'pulse', color:'#7c3aed'},
      {screen:'screen-admin',     name:'Users & Roles',    icon:'user', color:'#be123c'}
  ]}
];

// Acceso por defecto según el rol. El administrador podrá asignar módulos por
// usuario (user.modules) y eso manda sobre este default.
var ROLE_MODULES = {
  admin:      ['qa','lab','production','products','admin'],
  supervisor: ['qa','lab','production','products'],
  operator:   ['qa']
};

function userModules(u){
  u = u || currentUser;
  if(!u) return [];
  if(u.modules && u.modules.length) return u.modules;
  return ROLE_MODULES[u.role] || ROLE_MODULES.operator;
}
function moduleById(id){
  return MODULES.filter(function(m){ return m.id===id; })[0] || null;
}
function myModules(){
  var allowed = userModules();
  return MODULES.filter(function(m){ return allowed.indexOf(m.id)>=0; });
}
function canSeeModule(id){ return userModules().indexOf(id)>=0; }

// Un reporte guardado solo lo cambia el manager (supervisor) o el
// administrador. El operador lo crea y lo consulta, pero no lo modifica:
// es un documento de calidad, no una nota suelta.
function canEditReports(){
  return !!currentUser && (currentUser.role==='admin' || currentUser.role==='supervisor');
}

// Módulo activo: define el ALCANCE de Search / Reports / Shift Report
var activeModule = null;

function moduleOfScreen(screen){
  // A qué módulo pertenece una pantalla dentro del módulo activo (si aplica)
  if(activeModule){
    var m = moduleById(activeModule);
    if(m && m.items.some(function(i){ return i.screen===screen; })) return activeModule;
  }
  var hit = myModules().filter(function(m){
    return m.items.some(function(i){ return i.screen===screen; });
  })[0];
  return hit ? hit.id : null;
}

// ===== ALCANCE DE SEARCH Y REPORTS =====
// Search y Reports son las MISMAS pantallas en todos los modulos, pero solo
// deben traer los registros de aquel desde el que se entro: desde QA
// Laboratory no tiene por que salir un peso ni un bag seal.
//
// 'runs' es la excepcion a proposito: ahi vive si la muestra se recogio de la
// linea o no, y eso le sirve igual a QA y al laboratorio.
var MODULE_SCOPE = {
  qa:         ['weights','seals','holds','capa','shifts','runs'],
  lab:        ['analysis','runs'],
  production: ['runs','shifts'],
  admin:      null                       // el administrador ve todo
};
function scopeKinds(){
  var m = activeModule || 'admin';
  return (m in MODULE_SCOPE) ? MODULE_SCOPE[m] : null;
}
function scopeHas(kind){
  var s = scopeKinds();
  return !s || s.indexOf(kind) >= 0;
}

// El administrador ve todo sin filtrar
function scopeIsAll(){ return activeModule==='admin'; }
