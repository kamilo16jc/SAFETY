// ===== INCIDENT & CAPA REPORT (SQF #2.5.C.2) =====
// Registra incidentes y sus acciones correctivas/preventivas. Se guarda en
// db.capa + colección Firestore 'capa'. La numeración es CAPA-YYYY-NNN.
var capaEditingId = null;   // id del reporte que se está editando, o null

function getCapa(){
  var db = getDB();
  if(!db.capa) db.capa = [];
  return db.capa;
}
function saveCapaDB(list){
  var db = getDB();
  db.capa = list;
  saveDB(db,'capa');
}

function nextCapaNumber(){
  var year = new Date().getFullYear();
  var nums = getCapa().map(function(c){
    var m = /CAPA-(\d{4})-(\d+)/.exec(c.reportNumber||'');
    return (m && m[1]==String(year)) ? parseInt(m[2]) : 0;
  });
  var n = (nums.length ? Math.max.apply(null,nums) : 0) + 1;
  return 'CAPA-'+year+'-'+String(n).padStart(3,'0');
}

var CAPA_SEV = {
  major:    {label:'Major',    cls:'bad'},
  moderate: {label:'Moderate', cls:'warn'},
  minimal:  {label:'Minimal',  cls:''}
};
var CAPA_STATUS = {
  open:      {label:'Open',        cls:'bad'},
  progress:  {label:'In progress', cls:'warn'},
  closed:    {label:'Closed',      cls:'ok'}
};

function initCapa(){
  capaEditingId = null;
  resetCapaForm();
  renderCapaList();
}

function resetCapaForm(){
  document.getElementById('capa-title').textContent = capaEditingId ? 'Edit report' : 'New incident & CAPA report';
  var g = function(id){ return document.getElementById(id); };
  g('capa-report').value    = capaEditingId ? g('capa-report').value : nextCapaNumber();
  g('capa-date').value      = localDateStr();
  g('capa-complaint').value = '';
  g('capa-product').value   = '';
  g('capa-lot').value       = '';
  g('capa-problem').value   = '';
  g('capa-desc').value      = '';
  g('capa-short').value     = '';
  g('capa-short-date').value= '';
  g('capa-long').value      = '';
  g('capa-long-date').value = '';
  g('capa-completed').value = currentUser ? currentUser.name : '';
  g('capa-verified').value  = '';
  capaSeverity = null;
  capaStatus = 'open';
  renderCapaSeverity();
  renderCapaStatus();
  renderProductOptions('capa-product-list');
  updateCapaDue();
  capaCloseMsg(false);
  capaSaveLabel();
}

// El boton de guardar dice lo que va a hacer. "New report" se queda siempre a
// la vista: es como se vuelve a empezar, no solo como se cancela una edicion.
function capaSaveLabel(){
  var b = document.getElementById('capa-save-btn');
  if(!b) return;
  var t = b.querySelector('span') || b;
  var txt = capaEditingId ? 'Update report' : 'Save report';
  if(b.lastChild && b.lastChild.nodeType === 3) b.lastChild.nodeValue = ' ' + txt;
  else b.textContent = txt;
}

var capaSeverity = null, capaStatus = 'open';

function renderCapaSeverity(){
  document.getElementById('capa-severity').innerHTML = CAPA_SEVERITY.map(function(s){
    var on = capaSeverity===s.key;
    return '<button type="button" class="sev-btn'+(on?' on '+s.key:'')+'" '+
      'aria-pressed="'+(on?'true':'false')+'" onclick="setCapaSeverity(\''+s.key+'\')">'+
      '<span class="sev-ring"></span>'+
      '<span class="sev-body">'+
        '<span class="sev-top"><span class="sev-name">'+s.label+'</span>'+
          '<span class="sev-when '+s.key+'">Investigate '+s.deadline+'</span></span>'+
        '<span class="sev-desc">'+s.desc+'</span>'+
      '</span></button>';
  }).join('');
}
function setCapaSeverity(k){ capaSeverity = k; renderCapaSeverity(); updateCapaDue(); }

function renderCapaStatus(){
  document.getElementById('capa-status').innerHTML = Object.keys(CAPA_STATUS).map(function(k){
    var on = capaStatus===k;
    return '<button type="button" class="seg'+(on?' on':'')+'" role="radio" '+
      'aria-checked="'+(on?'true':'false')+'" onclick="setCapaStatus(\''+k+'\')">'+
      CAPA_STATUS[k].label+'</button>';
  }).join('');
}
function setCapaStatus(k){
  capaStatus = k;
  renderCapaStatus();
  updateCapaDue();
  // El aviso de cierre solo molesta cuando de verdad se intenta cerrar
  if(k !== 'closed') capaCloseMsg(false);
}

// ===== LA FECHA LIMITE DE INVESTIGACION =====
// No se escribe: sale de la severidad. Major son 24 horas desde la fecha del
// CAPA, Moderate 48 y Minimal 96, que es lo que dice la propia forma.
function capaDueDate(fecha, sev){
  var s = CAPA_SEVERITY.filter(function(x){ return x.key===sev; })[0];
  if(!fecha || !s) return null;
  var d = new Date(fecha + 'T00:00:00');
  if(isNaN(d)) return null;
  d.setHours(d.getHours() + s.hours);
  return d;
}
function capaOverdue(rec){
  if(!rec || rec.status === 'closed') return false;
  var d = capaDueDate(rec.capaDate, rec.severity);
  return !!d && d < new Date();
}
function updateCapaDue(){
  var caja = document.getElementById('capa-due');
  if(!caja) return;
  var fecha = (document.getElementById('capa-date')||{}).value;
  var d = capaDueDate(fecha, capaSeverity);
  if(!d){ caja.hidden = true; return; }
  caja.hidden = false;
  var tarde = (capaStatus !== 'closed') && d < new Date();
  caja.classList.toggle('overdue', tarde);
  document.getElementById('capa-due-text').textContent =
    (tarde ? 'Overdue \u2014 investigation was due ' : 'Investigation due by ') +
    d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
}
function capaCloseMsg(ver){
  var m = document.getElementById('capa-close-msg');
  if(m) m.classList.toggle('show', !!ver);
}
function printCapa(){
  if(!capaEditingId){ toast('Open a report first to print it'); return; }
  if(typeof exportCapaPDF === 'function') exportCapaPDF(capaEditingId);
}

function saveCapa(){
  var g = function(id){ return document.getElementById(id).value.trim(); };
  var report = g('capa-report');
  var problem = g('capa-problem');
  if(!report){ toast('Enter a report number'); return; }
  if(!capaSeverity){ toast('Select the severity'); return; }
  if(!problem){ toast('Describe the problem or deviation'); return; }
  // Cerrar un CAPA es decir que no vuelve a pasar y que alguien lo comprobo.
  // Sin accion de largo plazo ni verificador, eso no se puede afirmar.
  if(capaStatus === 'closed' && (!g('capa-long') || !g('capa-verified'))){
    capaCloseMsg(true);
    toast('Complete the long-term action and verifier to close');
    return;
  }
  capaCloseMsg(false);

  var list = getCapa();
  var now  = localISOStr();
  var rec;
  if(capaEditingId){
    rec = list.filter(function(c){ return c.id===capaEditingId; })[0];
    if(!rec){ capaEditingId=null; return; }
  } else {
    rec = { id: newRecordId(), createdBy: currentUser?currentUser.name:'—', createdAt: now };
    list.push(rec);
  }
  rec.reportNumber = report;
  rec.capaDate     = g('capa-date');
  rec.complaint    = g('capa-complaint');
  rec.product      = g('capa-product');
  rec.productName  = (findProduct(g('capa-product'))||{}).name || '';
  rec.lot          = g('capa-lot');
  rec.severity     = capaSeverity;
  rec.status       = capaStatus;
  rec.problem      = g('capa-problem');
  rec.description  = g('capa-desc');
  rec.shortTerm    = g('capa-short');
  rec.shortDate    = g('capa-short-date');
  rec.longTerm     = g('capa-long');
  rec.longDate     = g('capa-long-date');
  rec.completedBy  = g('capa-completed');
  rec.verifiedBy   = g('capa-verified');
  rec.updatedBy    = currentUser?currentUser.name:'—';
  rec.updatedAt    = now;

  saveCapaDB(list);
  if(rec._fbId && window.saveToFirebaseAt) window.saveToFirebaseAt('capa', rec._fbId, rec);
  else if(window.saveToFirebase) window.saveToFirebase('capa', rec);

  logActivity('capa', capaEditingId?'CAPA report updated':'CAPA report created',
    rec.reportNumber+' · '+(CAPA_SEV[rec.severity]||{}).label+(rec.product?' · '+rec.product:'')+(rec.lot?' · LOT '+rec.lot:''),
    currentUser?currentUser.name:'—');

  var wasEdit = !!capaEditingId;
  capaEditingId = null;
  resetCapaForm();
  renderCapaList();
  toast(wasEdit ? 'Report updated' : 'Report saved');
}

function cancelCapaEdit(){
  capaEditingId = null;
  resetCapaForm();
}

function editCapa(id){
  var rec = getCapa().filter(function(c){ return c.id===id; })[0];
  if(!rec) return;
  capaEditingId = id;
  var g = function(k){ return document.getElementById(k); };
  g('capa-report').value    = rec.reportNumber||'';
  g('capa-date').value      = rec.capaDate||localDateStr();
  g('capa-complaint').value = rec.complaint||'';
  g('capa-product').value   = rec.product||'';
  g('capa-lot').value       = rec.lot||'';
  g('capa-problem').value   = rec.problem||'';
  g('capa-desc').value      = rec.description||'';
  g('capa-short').value     = rec.shortTerm||'';
  g('capa-short-date').value= rec.shortDate||'';
  g('capa-long').value      = rec.longTerm||'';
  g('capa-long-date').value = rec.longDate||'';
  g('capa-completed').value = rec.completedBy||'';
  g('capa-verified').value  = rec.verifiedBy||'';
  capaSeverity = rec.severity;
  capaStatus   = rec.status||'open';
  document.getElementById('capa-title').textContent = 'Editing ' + (rec.reportNumber || 'report');
  renderCapaSeverity(); renderCapaStatus();
  renderProductOptions('capa-product-list');
  updateCapaDue();
  capaCloseMsg(false);
  capaSaveLabel();
  renderCapaList();      // marca en la tabla cual se esta editando
  document.getElementById('screen-capa').scrollTop = 0;
  window.scrollTo(0,0);
}

function deleteCapa(id){
  if(!currentUser || (currentUser.role!=='admin' && currentUser.role!=='supervisor')){
    toast('Only admins and supervisors can delete reports'); return;
  }
  var rec = getCapa().filter(function(c){ return c.id===id; })[0];
  if(!rec) return;
  if(!confirm('Delete report '+rec.reportNumber+'? This cannot be undone.')) return;
  var rest = getCapa().filter(function(c){ return c.id!==id; });
  saveCapaDB(rest);
  if(rec._fbId && window.deleteFromFirebase) window.deleteFromFirebase('capa', rec._fbId);
  logActivity('capa','CAPA report deleted', rec.reportNumber, currentUser?currentUser.name:'—');
  renderCapaList();
  toast('Report deleted');
}

// La lista de reportes guardados salio de esta pantalla a proposito: aqui se
// abre un incidente y se cierra, no se repasa el historial. Un CAPA viejo se
// busca en Search, que trae el boton "Open to edit" y lo abre aqui mismo.
//
// Lo unico que queda a la vista es el conteo, porque un reporte vencido tiene
// que verse sin ir a buscarlo. La funcion conserva el nombre: la llaman cuatro
// sitios y lo que necesitan de ella es justo esto.
function renderCapaList(){
  capaCounts(getCapa());
}

// Cuantos siguen abiertos y cuantos se pasaron de plazo.
function capaCounts(todos){
  var el = document.getElementById('capa-counts');
  if(!el) return;
  if(!todos.length){ el.textContent = ''; el.className = 'cbar-note'; return; }
  var abiertos = todos.filter(function(c){ return c.status !== 'closed'; }).length;
  var tarde    = todos.filter(capaOverdue).length;
  el.textContent = abiertos + ' open \u00b7 ' + tarde + ' overdue';
  el.className = 'cbar-note' + (tarde ? ' bad' : '');
}

function fmtCapaDate(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
