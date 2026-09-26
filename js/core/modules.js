// ===== MÓDULOS DEL SISTEMA =====
// La navegación y los permisos salen de esta tabla. Antes el menú mostraba las
// 18 pantallas a todo el mundo y los permisos estaban regados por 8 archivos.
//
// Search, Reports y Shift Report son los MISMOS archivos, pero se abren con el
// alcance del módulo desde el que entras: en QA Inspection ves lo de QA, en
// Laboratorio lo del lab, y el administrador lo ve todo.

var MODULES = [
  { id:'qa', color:'#4ade80', ink:'#047857', name:'QA Inspection', icon:'clipboard', items:[
      {screen:'screen-weight',    name:'Weights',          icon:'scale'},
      {screen:'screen-seal',      name:'Seal Bags',        icon:'droplet'},
      {screen:'screen-temp',      name:'Temperatures',     icon:'thermo'},
      {screen:'screen-gmp',       name:'GMP Audit',        icon:'clipboard'},
      {screen:'screen-metal',     name:'Metal Detector',   icon:'magnet'},
      {screen:'screen-capa',      name:'CAPA Reports',     icon:'alert'},
      {screen:'screen-hold',      name:'Hold Cases',       icon:'lock'},
      {screen:'screen-shift',     name:'Shift Report',     icon:'note'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search'}
  ]},
  { id:'lab', color:'#38bdf8', ink:'#0369a1', name:'QA Laboratory', icon:'droplet', items:[
      {screen:'screen-analysis',  name:'Sample Analysis',  icon:'clipboard'},
      {screen:'screen-lab',       name:'Lab Samples',      icon:'droplet'},
      {screen:'screen-grilling',  name:'Grilling Cheese',  icon:'thermo', soon:true},
      {screen:'screen-raw',       name:'Raw Material',     icon:'box',    soon:true},
      {screen:'screen-shift',     name:'Shift Report',     icon:'note'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search'}
  ]},
  { id:'production', color:'#fbbf24', ink:'#b45309', name:'Production', icon:'calendar', items:[
      {screen:'screen-production',name:'Schedule',         icon:'calendar'},
      {screen:'screen-reports',   name:'Reports',          icon:'doc'},
      {screen:'screen-lotsearch', name:'Search',           icon:'search'}
  ]},
  { id:'products', color:'#c084fc', ink:'#7c3aed', name:'Products', icon:'box', items:[
      {screen:'screen-products',  name:'Product Catalog',  icon:'box'}
  ]},
  { id:'admin', color:'#fb7185', ink:'#be123c', name:'Administrator', icon:'sliders', items:[
      {screen:'screen-dashboard', name:'Dashboard',        icon:'chart'},
      {screen:'screen-reports',   name:'Reports · all',    icon:'doc'},
      {screen:'screen-lotsearch', name:'Search · all',     icon:'search'},
      {screen:'screen-activity',  name:'Activity Log',     icon:'pulse'},
      {screen:'screen-admin',     name:'Users & Roles',    icon:'user'}
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

// El administrador ve todo sin filtrar
function scopeIsAll(){ return activeModule==='admin'; }
