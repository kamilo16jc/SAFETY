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
  saveDB(db);
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
  document.getElementById('capa-save-btn').textContent = capaEditingId ? 'Update report' : 'Save report';
  document.getElementById('capa-cancel-btn').style.display = capaEditingId ? '' : 'none';
}

var capaSeverity = null, capaStatus = 'open';

function renderCapaSeverity(){
  document.getElementById('capa-severity').innerHTML = CAPA_SEVERITY.map(function(s){
    var on = capaSeverity===s.key;
    return '<button type="button" class="sev-btn'+(on?' on '+s.key:'')+'" onclick="setCapaSeverity(\''+s.key+'\')">'+
      '<div class="sev-top"><span class="sev-name">'+s.label+'</span>'+
        '<span class="sev-when">Investigate '+s.deadline+'</span></div>'+
      '<div class="sev-desc">'+s.desc+'</div></button>';
  }).join('');
}
function setCapaSeverity(k){ capaSeverity = k; renderCapaSeverity(); }

function renderCapaStatus(){
  document.getElementById('capa-status').innerHTML = Object.keys(CAPA_STATUS).map(function(k){
    return '<button type="button" class="pkg-chip'+(capaStatus===k?' selected':'')+'" onclick="setCapaStatus(\''+k+'\')">'+
      CAPA_STATUS[k].label+'</button>';
  }).join('');
}
function setCapaStatus(k){ capaStatus = k; renderCapaStatus(); }

function saveCapa(){
  var g = function(id){ return document.getElementById(id).value.trim(); };
  var report = g('capa-report');
  var problem = g('capa-problem');
  if(!report){ toast('Enter a report number'); return; }
  if(!capaSeverity){ toast('Select the severity'); return; }
  if(!problem){ toast('Describe the problem or deviation'); return; }

  var list = getCapa();
  var now  = localISOStr();
  var rec;
  if(capaEditingId){
    rec = list.filter(function(c){ return c.id===capaEditingId; })[0];
    if(!rec){ capaEditingId=null; return; }
  } else {
    rec = { id: Date.now(), createdBy: currentUser?currentUser.name:'—', createdAt: now };
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
  document.getElementById('capa-title').textContent = 'Edit report';
  renderCapaSeverity(); renderCapaStatus();
  renderProductOptions('capa-product-list');
  document.getElementById('capa-save-btn').textContent = 'Update report';
  document.getElementById('capa-cancel-btn').style.display = '';
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

function renderCapaList(){
  var el = document.getElementById('capa-list');
  if(!el) return;
  var list = getCapa().slice().sort(function(a,b){
    return String(b.capaDate||'').localeCompare(String(a.capaDate||''));
  });
  var canDelete = currentUser && (currentUser.role==='admin' || currentUser.role==='supervisor');
  if(!list.length){
    el.innerHTML = '<div class="cd-empty" style="padding:24px">No reports yet. Fill in the form above to open the first one.</div>';
    return;
  }
  el.innerHTML = list.map(function(c){
    var sev = CAPA_SEV[c.severity] || {label:'—',cls:''};
    var st  = CAPA_STATUS[c.status] || CAPA_STATUS.open;
    return '<div class="capa-card">'+
      '<div class="capa-card-main">'+
        '<div class="capa-card-top">'+
          '<span class="capa-num">'+(c.reportNumber||'—')+'</span>'+
          '<span class="pill '+sev.cls+'">'+sev.label+'</span>'+
          '<span class="pill '+st.cls+'">'+st.label+'</span>'+
        '</div>'+
        '<div class="capa-card-title">'+(esc(c.problem||'—').slice(0,120))+'</div>'+
        '<div class="capa-card-meta">'+fmtCapaDate(c.capaDate)+
          (c.product?' · '+esc(c.product):'')+(c.lot?' · LOT '+esc(c.lot):'')+
          (c.completedBy?' · '+esc(c.completedBy):'')+'</div>'+
      '</div>'+
      '<div class="capa-card-actions">'+
        '<button class="btn-ghost" onclick="exportCapaPDF('+c.id+')"><span data-icon="doc"></span>PDF</button>'+
        '<button class="btn-ghost" onclick="editCapa('+c.id+')">Edit</button>'+
        (canDelete?'<button class="btn-danger" onclick="deleteCapa('+c.id+')">Delete</button>':'')+
      '</div>'+
    '</div>';
  }).join('');
  renderIcons(el);

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
}

function fmtCapaDate(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
