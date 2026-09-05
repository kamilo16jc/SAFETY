// ===== SHIFT REPORTS =====
// Notas de sucesos del turno que no ameritan un CAPA. Se guarda en db.shifts
// + colección Firestore 'shifts'. Numeración SR-YYYY-NNN.
var shiftEditingId = null;
var shiftCategory = null, shiftStatus = 'open', shiftFollow = false;

function getShifts(){
  var db = getDB();
  if(!db.shifts) db.shifts = [];
  return db.shifts;
}
function saveShiftsDB(list){
  var db = getDB();
  db.shifts = list;
  saveDB(db);
}

function nextShiftNumber(){
  var year = new Date().getFullYear();
  var nums = getShifts().map(function(s){
    var m = /SR-(\d{4})-(\d+)/.exec(s.reportNumber||'');
    return (m && m[1]==String(year)) ? parseInt(m[2]) : 0;
  });
  var n = (nums.length ? Math.max.apply(null,nums) : 0) + 1;
  return 'SR-'+year+'-'+String(n).padStart(3,'0');
}

var SHIFT_STATUS = {
  open:       {label:'Open',       cls:'bad'},
  monitoring: {label:'Monitoring', cls:'warn'},
  resolved:   {label:'Resolved',   cls:'ok'}
};

function initShift(){
  shiftEditingId = null;
  resetShiftForm();
  renderShiftList();
}

function renderAreaOptions(){
  var sel = document.getElementById('sr-area');
  if(!sel) return;
  var current = sel.value;
  sel.innerHTML = '<option value="">Select area</option>'+
    getAreas().map(function(a){ return '<option value="'+a.replace(/"/g,'&quot;')+'">'+a+'</option>'; }).join('');
  if(current) sel.value = current;
}

function addShiftArea(){
  var name = prompt('New area name:');
  if(name===null) return;
  name = name.trim();
  if(!name){ return; }
  var list = getAreas();
  if(list.some(function(a){ return a.toLowerCase()===name.toLowerCase(); })){
    toast('That area already exists');
  } else {
    list.push(name);
    saveAreas(list);
    toast('Area added');
  }
  renderAreaOptions();
  document.getElementById('sr-area').value = name;
}

function resetShiftForm(){
  document.getElementById('shift-form-head').textContent = shiftEditingId ? 'Edit shift report' : 'New shift report';
  var g = function(id){ return document.getElementById(id); };
  g('sr-report').value    = shiftEditingId ? g('sr-report').value : nextShiftNumber();
  g('sr-date').value      = localDateStr();
  g('sr-line').value      = '';
  g('sr-product').value   = '';
  g('sr-lot').value       = '';
  g('sr-notes').value     = '';
  g('sr-action').value    = '';
  g('sr-reported').value  = currentUser ? currentUser.name : '';
  g('sr-supervisor').value= '';
  shiftSel = null;
  shiftCategory = null; shiftStatus = 'open'; shiftFollow = false;
  renderAreaOptions();
  g('sr-area').value = '';
  renderShiftShift();
  renderShiftCategory();
  renderShiftStatus();
  renderShiftFollow();
  renderProductOptions('sr-product-list');
  g('shift-save-btn').textContent = shiftEditingId ? 'Update report' : 'Save report';
  g('shift-cancel-btn').style.display = shiftEditingId ? '' : 'none';
}

var shiftSel = null; // 1 | 2
function renderShiftShift(){
  document.getElementById('sr-shift').innerHTML = [[1,'1st'],[2,'2nd']].map(function(s){
    return '<button type="button" class="pkg-chip'+(shiftSel===s[0]?' selected':'')+'" onclick="setShiftShift('+s[0]+')">'+s[1]+' shift</button>';
  }).join('');
}
function setShiftShift(n){ shiftSel = n; renderShiftShift(); }

function renderShiftCategory(){
  document.getElementById('sr-category').innerHTML = SHIFT_CATEGORIES.map(function(c){
    return '<button type="button" class="pkg-chip'+(shiftCategory===c?' selected':'')+'" onclick="setShiftCategory(\''+c+'\')">'+c+'</button>';
  }).join('');
}
function setShiftCategory(c){ shiftCategory = c; renderShiftCategory(); }

function renderShiftStatus(){
  document.getElementById('sr-status').innerHTML = Object.keys(SHIFT_STATUS).map(function(k){
    return '<button type="button" class="pkg-chip'+(shiftStatus===k?' selected':'')+'" onclick="setShiftStatus(\''+k+'\')">'+SHIFT_STATUS[k].label+'</button>';
  }).join('');
}
function setShiftStatus(k){ shiftStatus = k; renderShiftStatus(); }

function renderShiftFollow(){
  var b = document.getElementById('sr-follow');
  if(b){ b.className = 'pkg-chip'+(shiftFollow?' selected':''); b.textContent = shiftFollow?'Follow-up required':'No follow-up'; }
}
function toggleShiftFollow(){ shiftFollow = !shiftFollow; renderShiftFollow(); }

function saveShift(){
  var g = function(id){ return document.getElementById(id).value.trim(); };
  var report = g('sr-report');
  var notes  = g('sr-notes');
  if(!report){ toast('Enter a report number'); return; }
  if(!document.getElementById('sr-area').value){ toast('Select an area'); return; }
  if(!notes){ toast('Describe what happened'); return; }

  var list = getShifts();
  var now  = localISOStr();
  var rec;
  if(shiftEditingId){
    rec = list.filter(function(s){ return s.id===shiftEditingId; })[0];
    if(!rec){ shiftEditingId=null; return; }
  } else {
    rec = { id: Date.now(), createdBy: currentUser?currentUser.name:'—', createdAt: now };
    list.push(rec);
  }
  rec.reportNumber = report;
  rec.date         = g('sr-date');
  rec.shift        = shiftSel;
  rec.area         = document.getElementById('sr-area').value;
  rec.line         = g('sr-line');
  rec.category     = shiftCategory;
  rec.product      = g('sr-product');
  rec.productName  = (findProduct(g('sr-product'))||{}).name || '';
  rec.lot          = g('sr-lot');
  rec.notes        = g('sr-notes');
  rec.action       = g('sr-action');
  rec.followUp     = shiftFollow;
  rec.status       = shiftStatus;
  rec.reportedBy   = g('sr-reported');
  rec.supervisor   = g('sr-supervisor');
  rec.updatedBy    = currentUser?currentUser.name:'—';
  rec.updatedAt    = now;

  saveShiftsDB(list);
  if(rec._fbId && window.saveToFirebaseAt) window.saveToFirebaseAt('shifts', rec._fbId, rec);
  else if(window.saveToFirebase) window.saveToFirebase('shifts', rec);

  logActivity('shift', shiftEditingId?'Shift report updated':'Shift report created',
    rec.reportNumber+' · '+(rec.area||'—')+(rec.category?' · '+rec.category:''),
    currentUser?currentUser.name:'—');

  var wasEdit = !!shiftEditingId;
  shiftEditingId = null;
  resetShiftForm();
  renderShiftList();
  toast(wasEdit ? 'Report updated' : 'Report saved');
}

function cancelShiftEdit(){ shiftEditingId = null; resetShiftForm(); }

function editShift(id){
  var rec = getShifts().filter(function(s){ return s.id===id; })[0];
  if(!rec) return;
  shiftEditingId = id;
  var g = function(k){ return document.getElementById(k); };
  g('sr-report').value    = rec.reportNumber||'';
  g('sr-date').value      = rec.date||localDateStr();
  g('sr-line').value      = rec.line||'';
  g('sr-product').value   = rec.product||'';
  g('sr-lot').value       = rec.lot||'';
  g('sr-notes').value     = rec.notes||'';
  g('sr-action').value    = rec.action||'';
  g('sr-reported').value  = rec.reportedBy||'';
  g('sr-supervisor').value= rec.supervisor||'';
  shiftSel      = rec.shift||null;
  shiftCategory = rec.category||null;
  shiftStatus   = rec.status||'open';
  shiftFollow   = !!rec.followUp;
  document.getElementById('shift-form-head').textContent = 'Edit shift report';
  renderAreaOptions();
  g('sr-area').value = rec.area||'';
  renderShiftShift(); renderShiftCategory(); renderShiftStatus(); renderShiftFollow();
  renderProductOptions('sr-product-list');
  g('shift-save-btn').textContent = 'Update report';
  g('shift-cancel-btn').style.display = '';
  window.scrollTo(0,0);
}

function deleteShift(id){
  if(!currentUser || (currentUser.role!=='admin' && currentUser.role!=='supervisor')){
    toast('Only admins and supervisors can delete reports'); return;
  }
  var rec = getShifts().filter(function(s){ return s.id===id; })[0];
  if(!rec) return;
  if(!confirm('Delete report '+rec.reportNumber+'? This cannot be undone.')) return;
  var rest = getShifts().filter(function(s){ return s.id!==id; });
  saveShiftsDB(rest);
  if(rec._fbId && window.deleteFromFirebase) window.deleteFromFirebase('shifts', rec._fbId);
  logActivity('shift','Shift report deleted', rec.reportNumber, currentUser?currentUser.name:'—');
  renderShiftList();
  toast('Report deleted');
}

function renderShiftList(){
  var el = document.getElementById('shift-list');
  if(!el) return;
  var list = getShifts().slice().sort(function(a,b){
    return String(b.date||'').localeCompare(String(a.date||''));
  });
  var canDelete = currentUser && (currentUser.role==='admin' || currentUser.role==='supervisor');
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  if(!list.length){
    el.innerHTML = '<div class="cd-empty" style="padding:24px">No shift reports yet. Fill in the form above to add the first note.</div>';
    return;
  }
  el.innerHTML = list.map(function(s){
    var st = SHIFT_STATUS[s.status] || SHIFT_STATUS.open;
    return '<div class="capa-card">'+
      '<div class="capa-card-main">'+
        '<div class="capa-card-top">'+
          '<span class="capa-num">'+esc(s.reportNumber||'—')+'</span>'+
          (s.category?'<span class="pill">'+esc(s.category)+'</span>':'')+
          '<span class="pill '+st.cls+'">'+st.label+'</span>'+
          (s.followUp?'<span class="pill warn">Follow-up</span>':'')+
        '</div>'+
        '<div class="capa-card-title">'+esc(s.notes||'—').slice(0,140)+'</div>'+
        '<div class="capa-card-meta">'+fmtShiftDate(s.date)+
          (s.shift?' · '+(s.shift===1?'1st':'2nd')+' shift':'')+
          (s.area?' · '+esc(s.area):'')+(s.reportedBy?' · '+esc(s.reportedBy):'')+'</div>'+
      '</div>'+
      '<div class="capa-card-actions">'+
        '<button class="btn-ghost" onclick="exportShiftPDF('+s.id+')"><span data-icon="doc"></span>PDF</button>'+
        '<button class="btn-ghost" onclick="editShift('+s.id+')">Edit</button>'+
        (canDelete?'<button class="btn-danger" onclick="deleteShift('+s.id+')">Delete</button>':'')+
      '</div>'+
    '</div>';
  }).join('');
  renderIcons(el);
}

function fmtShiftDate(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
