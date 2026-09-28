// ===== ANALISIS DE MATERIA PRIMA =====
// Cuatro hojas que comparten el mismo motor, porque en el fondo son lo mismo:
// una fecha, de que es la muestra, Moisture / Fat / pH / aw, Yeast / Mold y
// quien lo hizo. Lo que cambia es el encabezado de cada una.
//
//   raw     Queso que llega de proveedores. La muestra del dia se enumera con
//           letra (A, B, C...) y el codigo es el que viene en el material.
//   dry     Producto seco del edificio 1935, por secador.
//   formag  Produccion propia, por lote.
//   rd      Muestras de proveedores y competencia, para desarrollo.
//
// Yeast y Mold son PLACA: se siembran con la muestra y se leen a los cinco
// dias, saltando el domingo, igual que en Yeast & Mold. Por eso la fila deja
// esas dos celdas abiertas y avisa cuando toca leerlas.
//
// Lo normal es escribir pH, Moisture, Yeast y Mold (y Fat, que viene lleno en
// casi todo el historico). Pseudomonas, Coliform, aw y Vat se miran muy de vez
// en cuando, asi que viven detras del boton de pruebas extra y no estorban.
//
// Quien testea no se escribe: lo pone el sistema con el usuario que entro.

var RAW_SECTIONS = {
  raw: {
    titulo: 'Raw Analysis',
    sub: 'Cheese received from suppliers',
    fecha: 'Date',
    cols: [
      {f:'sample',   t:'Sample',   tipo:'texto'},
      {f:'material', t:'Cheese',   tipo:'material', wide:true},
      {f:'code',     t:'Code',     tipo:'texto'}
    ]
  },
  dry: {
    titulo: 'Dry 1935',
    sub: 'Dry product, building 1935',
    fecha: 'Production date',
    cols: [
      {f:'sample',   t:'Sample #', tipo:'texto'},
      {f:'time',     t:'Time',     tipo:'hora'},
      {f:'material', t:'Product',  tipo:'material', wide:true},
      {f:'drier',    t:'Drier',    tipo:'opciones', opciones:['1','2','3']}
    ]
  },
  formag: {
    titulo: 'Formag',
    sub: 'Our own production, by batch',
    fecha: 'Date tested',
    cols: [
      {f:'batch',    t:'Batch',      tipo:'texto'},
      {f:'material', t:'Type',       tipo:'material', wide:true},
      {f:'prodDate', t:'Prod. date', tipo:'fecha'}
    ],
    aw: true
  },
  rd: {
    titulo: 'R&D',
    sub: 'Vendor and competitor samples',
    fecha: 'Receipt date',
    cols: [
      {f:'sample',   t:'Sample #',   tipo:'texto'},
      {f:'supplier', t:'Vendor',     tipo:'proveedor'},
      {f:'time',     t:'Time',       tipo:'hora'},
      {f:'material', t:'Product',    tipo:'material', wide:true},
      {f:'prodDate', t:'Prod. date', tipo:'fecha'},
      {f:'expDate',  t:'Expires',    tipo:'fecha'}
    ],
    aw: true,
    notas: true
  }
};
var RAW_ORDER  = ['raw','dry','formag','rd'];
var RAW_SCREEN = {raw:'screen-raw', dry:'screen-dry', formag:'screen-formag', rd:'screen-rd'};

// Lo que se mide siempre, y lo que casi nunca
var RAW_BASE  = [{f:'moisture',t:'Moisture',ph:'%'},{f:'fat',t:'Fat',ph:'%'},{f:'ph',t:'pH',ph:'pH'}];
var RAW_EXTRA = [{f:'pseudomonas',t:'Pseudomonas'},{f:'coliform',t:'Coliform'},
                 {f:'aw',t:'aw'},{f:'vat',t:'Vat'}];

var rawSection = 'raw';
var rawExtra   = false;     // mostrar las pruebas poco frecuentes
var rawView    = 'all';     // all | pending | read
var rawDirty   = false;

function getRawRecords(){ var d=getDB(); if(!d.raw) d.raw=[]; return d.raw; }
function getSuppliers(){   var d=getDB(); if(!d.suppliers) d.suppliers=[]; return d.suppliers; }
function getRawItems(){    var d=getDB(); if(!d.rawItems) d.rawItems=[]; return d.rawItems; }

// ---- La placa: cinco dias, y el domingo no se lee ----
function rawPlateDue(r){
  var d = new Date(String(r.date||'').slice(0,10)+'T12:00:00');
  if(isNaN(d)) return '';
  d.setDate(d.getDate() + (typeof YM_DAYS==='number' ? YM_DAYS : 5));
  if(d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function rawDaysLeft(r){
  var due = rawPlateDue(r);
  if(!due) return 0;
  return Math.round((new Date(due+'T12:00:00') - new Date(localDateStr()+'T12:00:00')) / 86400000);
}
function rawHas(v){ return v!=null && String(v).trim()!==''; }
function rawPlateRead(r){ return rawHas(r.yeast) && rawHas(r.mold); }
function rawState(r){ return rawPlateRead(r) ? 'read' : 'pending'; }

function rawPlateHTML(r){
  if(rawPlateRead(r)){
    return '<span class="pill ok">Completed'+(r.plateAt ? ' · '+esc(fmtDate(r.plateAt)) : '')+'</span>';
  }
  var left = rawDaysLeft(r);
  return '<span class="pill bad">Pending · '+
    (left>0 ? esc(fmtDate(rawPlateDue(r)))+' ('+left+'d)'
            : (left<0 ? Math.abs(left)+'d late' : 'read today'))+'</span>';
}

// ============================================================
// LA PANTALLA
// Las cuatro secciones usan el mismo formulario, asi que se pinta al entrar
// dentro de la pantalla activa y se vacian las otras tres: de ese modo los
// identificadores rw-* existen una sola vez en el documento.
// ============================================================
function initRawSection(sec){
  rawSection = RAW_SECTIONS[sec] ? sec : 'raw';
  rawExtra = false;
  rawView  = 'all';
  RAW_ORDER.forEach(function(s){
    if(s === rawSection) return;
    var el = document.getElementById(RAW_SCREEN[s]);
    if(el) el.innerHTML = '';
  });
  var host = document.getElementById(RAW_SCREEN[rawSection]);
  if(!host) return;
  host.innerHTML = rawScreenHTML();
  renderIcons(host);

  var d = new Date(); d.setDate(d.getDate()-30);
  document.getElementById('rw-from').value =
    d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('rw-to').value = localDateStr();
  rawDirty = false; renderRwDirty();
  showDateOrder(host);
  echoDateRange('rw-date-echo','rw-from','rw-to');
  buildRawSheet(true);
  renderRawRows();
}
function initRaw(){    initRawSection('raw'); }
function initDry(){    initRawSection('dry'); }
function initFormag(){ initRawSection('formag'); }
function initRd(){     initRawSection('rd'); }

function rawScreenHTML(){
  var cfg = RAW_SECTIONS[rawSection];
  return '' +
  '<button class="back-btn" onclick="goBack()"><span class="btn-ico" data-icon="back"></span>BACK</button>'+
  '<div class="form-title">'+esc(cfg.titulo)+'</div>'+
  '<div class="form-meta">'+esc(cfg.sub)+' — yeast and mold plates are read 5 days later</div>'+

  '<div class="sheet-bar">'+
    '<div class="sb-field"><label for="rw-from">From <span class="ord" data-dateorder></span></label>'+
      '<input type="date" class="field" id="rw-from" oninput="markRwDirty()"></div>'+
    '<div class="sb-field"><label for="rw-to">To <span class="ord" data-dateorder></span></label>'+
      '<input type="date" class="field" id="rw-to" oninput="markRwDirty()"></div>'+
    '<div class="sb-field"><label for="rw-search">Search</label>'+
      '<div class="search-wrap">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'+
      '<circle cx="11" cy="11" r="6.3"/><path d="m15.7 15.7 4.6 4.6"/></svg>'+
      '<input type="search" id="rw-search" placeholder="Sample, code, cheese, supplier…" autocomplete="off"'+
      ' oninput="renderRawRows()"></div></div>'+
    '<div class="sb-field"><label>&nbsp;</label>'+
      '<button class="btn-solid" id="rw-go" onclick="applyRwFilters()">Apply</button></div>'+
    '<span class="sb-gap"></span>'+
    '<div class="sb-field"><label>&nbsp;</label>'+
      '<button class="ico-btn" id="rw-extra-btn" onclick="toggleRawExtra()" aria-label="Extra tests"'+
      ' title="Show Pseudomonas, Coliform, aw and Vat"><span data-icon="scan"></span></button></div>'+
    '<div class="sb-field"><label>&nbsp;</label>'+
      '<button class="ico-btn" onclick="toggleRawForm()" aria-label="New supplier or material"'+
      ' title="Create a supplier or a received material"><span data-icon="plus"></span></button></div>'+
    '<div class="sb-field"><label>&nbsp;</label>'+
      '<button class="ico-btn" onclick="exportRawCSV()" aria-label="Export to Excel"'+
      ' title="Export what is on screen to Excel"><span data-icon="grid"></span></button></div>'+
  '</div>'+
  '<div class="date-echo" id="rw-date-echo" style="display:none"></div>'+
  '<div class="hint" id="rw-dirty" style="display:none">Dates changed — press Apply.</div>'+

  '<div class="new-cust" id="rw-new-item" style="display:none">'+
    '<b>New supplier</b>'+
    '<div class="sheet-bar">'+
      '<div class="sb-field"><label for="rs-name">Supplier</label>'+
        '<input class="field" id="rs-name" placeholder="Vendor name" autocomplete="off"></div>'+
      '<div class="sb-field"><label>&nbsp;</label>'+
        '<button class="btn-solid" onclick="saveSupplier()">Add supplier</button></div>'+
    '</div>'+
    '<b>New received material</b>'+
    '<div class="sheet-bar">'+
      '<div class="sb-field"><label for="ri-name">Cheese / product type</label>'+
        '<input class="field" id="ri-name" placeholder="e.g. Parmesan wheel" autocomplete="off"></div>'+
      '<div class="sb-field"><label for="ri-supplier">Supplier</label>'+
        '<div class="select-wrap"><select class="field" id="ri-supplier"></select></div></div>'+
      '<div class="sb-field"><label>&nbsp;</label>'+
        '<button class="btn-solid" onclick="saveRawItem()">Add material</button></div>'+
    '</div>'+
    '<div class="hint">What comes in is almost always the same, so it is created once here '+
      'and after that you just pick it in the sheet.</div>'+
  '</div>'+

  '<div class="kpi-row" id="rw-kpis"></div>'+
  '<div id="rw-sheet"></div>'+
  '<datalist id="rw-material-list"></datalist>'+
  '<datalist id="rw-supplier-list"></datalist>';
}

// ---- Filtros: no buscan hasta que se pulsa Apply ----
function markRwDirty(){
  echoDateRange('rw-date-echo','rw-from','rw-to');
  if(rawDirty) return;
  rawDirty = true; renderRwDirty();
}
function renderRwDirty(){
  var el = document.getElementById('rw-dirty');
  if(el) el.style.display = rawDirty ? 'block' : 'none';
  var b = document.getElementById('rw-go');
  if(b) b.classList.toggle('pending', rawDirty);
}
function applyRwFilters(){
  rawDirty = false; renderRwDirty();
  var f = document.getElementById('rw-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderRawRows); return; }
  renderRawRows();
}
function setRawView(v){ rawView = v; renderRawRows(); }
function toggleRawExtra(){
  rawExtra = !rawExtra;
  var b = document.getElementById('rw-extra-btn');
  if(b) b.classList.toggle('on', rawExtra);
  buildRawSheet(true);
  renderRawRows();
}

// La letra que sigue para la muestra del dia (A, B, C...)
function nextSampleLetter(day){
  var usadas = {};
  getRawRecords().forEach(function(r){
    if(r.section==='raw' && String(r.date||'').slice(0,10)===day && r.sample)
      usadas[String(r.sample).trim().toUpperCase()] = 1;
  });
  for(var i=0;i<26;i++){
    var L = String.fromCharCode(65+i);
    if(!usadas[L]) return L;
  }
  return 'A'+Object.keys(usadas).length;
}

function rawFilters(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  return {from:g('rw-from'), to:g('rw-to'), q:(g('rw-search')||'').trim().toLowerCase()};
}

function rawRows(){
  var f = rawFilters();
  return getRawRecords().filter(function(r){
    if(r.section !== rawSection) return false;
    var d = String(r.date||'').slice(0,10);
    if(f.from && d < f.from) return false;
    if(f.to   && d > f.to)   return false;
    if(f.q){
      var hay = [r.sample,r.code,r.material,r.supplier,r.batch,r.notes,r.testedBy]
                .join(' ').toLowerCase();
      if(hay.indexOf(f.q) < 0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date||'').localeCompare(String(a.date||'')) || (b.id||0)-(a.id||0);
  });
}

// ---- El esqueleto de la hoja, distinto por seccion ----
function rawColumns(){
  var cfg = RAW_SECTIONS[rawSection];
  var med = RAW_BASE.slice();
  if(cfg.aw) med = med.concat([{f:'aw',t:'aw',ph:'aw'}]);
  var extra = RAW_EXTRA.filter(function(x){ return x.f!=='aw' || !cfg.aw; });
  return {cfg:cfg, ident:cfg.cols.slice(), medidas:med, extra:extra};
}

function buildRawSheet(forzar){
  var host = document.getElementById('rw-sheet');
  if(!host) return;
  if(!forzar && host.getAttribute('data-sec')===rawSection &&
     host.getAttribute('data-extra')===String(rawExtra)) return;
  host.setAttribute('data-sec', rawSection);
  host.setAttribute('data-extra', String(rawExtra));

  var c = rawColumns();
  var th = '<th class="rn">#</th><th>'+esc(c.cfg.fecha)+'</th>';
  c.ident.forEach(function(x){ th += '<th'+(x.wide?' class="wide"':'')+'>'+esc(x.t)+'</th>'; });
  c.medidas.forEach(function(x){ th += '<th class="num">'+esc(x.t)+'</th>'; });
  th += '<th class="num">Yeast</th><th class="num">Mold</th><th>Plate</th>';
  if(rawExtra) c.extra.forEach(function(x){ th += '<th class="num">'+esc(x.t)+'</th>'; });
  if(c.cfg.notas) th += '<th class="wide">Notes</th>';
  th += '<th>By</th><th>Save</th><th></th>';

  // fila de alta, arriba, como en Sample Analysis
  var nueva = '<td class="rn">new</td>'+
    '<td><input type="date" class="cell" id="rw-n-date"></td>';
  c.ident.forEach(function(x){ nueva += '<td'+(x.wide?' class="wide"':'')+'>'+rawInput('rw-n-'+x.f, x)+'</td>'; });
  c.medidas.forEach(function(x){
    nueva += '<td class="num"><input class="cell num" id="rw-n-'+x.f+'" inputmode="decimal" placeholder="'+esc(x.ph||'')+'"></td>';
  });
  nueva += '<td class="soft mid" colspan="3">Read in 5 days</td>';
  if(rawExtra) c.extra.forEach(function(x){
    nueva += '<td class="num"><input class="cell num" id="rw-n-'+x.f+'" inputmode="decimal" placeholder="'+esc(x.t)+'"></td>';
  });
  if(c.cfg.notas) nueva += '<td class="wide"><input class="cell" id="rw-n-notes" placeholder="Notes"></td>';
  nueva += '<td class="soft" id="rw-n-by">'+esc(typeof getInitials==='function'?getInitials():'')+'</td>'+
           '<td><button class="sheet-btn" onclick="saveRawRecord()">Add</button></td><td></td>';

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+th+'</tr></thead>'+
    '<tbody id="rw-new"><tr class="newrow">'+nueva+'</tr></tbody>'+
    '<tbody id="rw-body"></tbody></table></div>';
  resetRawRow();
}

function rawInput(id, x){
  if(x.tipo==='material')  return '<input class="cell" id="'+id+'" list="rw-material-list" placeholder="'+esc(x.t)+'" autocomplete="off">';
  if(x.tipo==='proveedor') return '<input class="cell" id="'+id+'" list="rw-supplier-list" placeholder="'+esc(x.t)+'" autocomplete="off">';
  if(x.tipo==='hora')      return '<input type="time" class="cell" id="'+id+'">';
  if(x.tipo==='fecha')     return '<input type="date" class="cell" id="'+id+'">';
  if(x.tipo==='opciones')  return '<select class="cell" id="'+id+'"><option value=""></option>'+
    x.opciones.map(function(o){ return '<option>'+esc(o)+'</option>'; }).join('')+'</select>';
  return '<input class="cell" id="'+id+'" placeholder="'+esc(x.t)+'">';
}

function resetRawRow(){
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
  var hoy = localDateStr();
  var c = rawColumns();
  set('rw-n-date', hoy);
  c.ident.forEach(function(x){ set('rw-n-'+x.f, ''); });
  c.medidas.forEach(function(x){ set('rw-n-'+x.f, ''); });
  RAW_EXTRA.forEach(function(x){ set('rw-n-'+x.f, ''); });
  set('rw-n-notes','');
  // En RAW las muestras del dia van por letra, asi que se propone la siguiente
  if(rawSection==='raw') set('rw-n-sample', nextSampleLetter(hoy));
  var by = document.getElementById('rw-n-by');
  if(by && typeof getInitials==='function') by.textContent = getInitials();
  renderRawDatalists();
}

function renderRawDatalists(){
  var m = document.getElementById('rw-material-list');
  if(m) m.innerHTML = getRawItems().map(function(x){
    return '<option value="'+esc(x.name)+'">'+esc(x.supplier||'')+'</option>'; }).join('');
  var s = document.getElementById('rw-supplier-list');
  if(s) s.innerHTML = getSuppliers().map(function(x){ return '<option value="'+esc(x.name)+'">'; }).join('');
}

function renderRawRows(){
  var body = document.getElementById('rw-body');
  if(!body) return;
  var all = rawRows();
  var pend = all.filter(function(r){ return rawState(r)==='pending'; }).length;

  var kp = document.getElementById('rw-kpis');
  if(kp){
    var k = function(v,n,label,color){
      return '<button class="kpi'+(rawView===v?' on':'')+'" onclick="setRawView(\''+v+'\')">'+
        '<b>'+n+'</b><span>'+(color?'<i class="dot" style="background:'+color+'"></i>':'')+label+'</span></button>';
    };
    kp.innerHTML = k('all', all.length, 'samples in range','') +
      k('pending', pend, 'plate pending', 'var(--fail)') +
      k('read', all.length-pend, 'plate completed', 'var(--pass)');
  }

  var list = all.filter(function(r){ return rawView==='all' || rawState(r)===rawView; });
  var c = rawColumns();
  var ncols = 2 + c.ident.length + c.medidas.length + 3 +
              (rawExtra ? c.extra.length : 0) + (c.cfg.notas?1:0) + 3;
  if(!list.length){
    body.innerHTML = '<tr><td colspan="'+ncols+'" class="sheet-empty" style="border:0">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No samples yet for these dates. Fill the top row to add the first one.')+'</td></tr>';
    return;
  }
  body.innerHTML = list.slice(0,300).map(function(r,i){ return rawRowHTML(r,i+1,c); }).join('');
  renderIcons(body);
}

function rawRowHTML(r, i, c){
  var v = function(x){ return (x==null||x==='') ? '—' : esc(x); };
  var cel = function(f, ph){
    return '<input class="cell num" inputmode="decimal" placeholder="'+esc(ph||'')+'" data-f="'+f+'" '+
      'value="'+esc(r[f]==null?'':r[f])+'" onchange="setRawCell('+r.id+',\''+f+'\',this.value)">';
  };
  var html = '<tr'+(rawPlateRead(r)?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="soft">'+esc(fmtDate(r.date))+'</td>';
  c.ident.forEach(function(x){
    var val = r[x.f];
    if(x.tipo==='fecha') val = val ? fmtDate(val) : '';
    var clase = x.wide ? 'wide' : ((x.f==='code'||x.f==='batch'||x.f==='sample') ? 'code' : 'soft');
    html += '<td class="'+clase+'">'+v(val)+'</td>';
  });
  c.medidas.forEach(function(x){ html += '<td class="num">'+cel(x.f, x.ph)+'</td>'; });
  html += '<td class="num">'+cel('yeast','CFU/g')+'</td>'+
          '<td class="num">'+cel('mold','CFU/g')+'</td>'+
          '<td id="rw-st-'+r.id+'">'+rawPlateHTML(r)+'</td>';
  if(rawExtra) c.extra.forEach(function(x){ html += '<td class="num">'+cel(x.f, x.t)+'</td>'; });
  if(c.cfg.notas) html += '<td class="wide"><input class="cell" data-f="notes" value="'+esc(r.notes||'')+'" '+
    'onchange="setRawCell('+r.id+',\'notes\',this.value)"></td>';
  html += '<td class="soft">'+v(r.testedBy)+'</td>'+
          '<td><button class="sheet-btn" onclick="saveRawRow('+r.id+',this)">Save</button></td>'+
          '<td><button class="run-del" onclick="deleteRawRecord('+r.id+')" title="Delete">'+
            '<span data-icon="close"></span></button></td>'+
        '</tr>';
  return html;
}

// ---- Guardar ----
function saveRawRecord(){
  var g = function(f){ var e=document.getElementById('rw-n-'+f); return e ? String(e.value).trim() : ''; };
  var c = rawColumns();
  var date = g('date') || localDateStr();
  var falta = [];
  if(rawSection==='raw' && !g('sample')) falta.push('sample');
  if(!g('material')){
    var mat = c.ident.filter(function(x){ return x.f==='material'; })[0];
    falta.push(mat ? mat.t.toLowerCase() : 'product');
  }
  if(falta.length){ toast('Missing '+falta.join(' and ')); return; }

  var rec = {
    id: newRecordId(),
    section: rawSection,
    date: date,
    testedBy: (typeof getInitials==='function') ? getInitials() : '',
    yeast: '', mold: '', plateAt: '', plateBy: '',
    createdBy: (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '—',
    createdAt: localISOStr()
  };
  c.ident.forEach(function(x){ rec[x.f] = g(x.f); });
  c.medidas.forEach(function(x){ rec[x.f] = g(x.f); });
  if(rawExtra) c.extra.forEach(function(x){ var val = g(x.f); if(val) rec[x.f] = val; });
  if(c.cfg.notas) rec.notes = g('notes');

  var db = getDB();
  if(!db.raw) db.raw = [];
  db.raw.push(rec);
  saveDB(db, 'raw');
  if(window.saveToFirebase) window.saveToFirebase('raw', rec);
  logActivity('analysis', RAW_SECTIONS[rawSection].titulo+' sample recorded',
    (rec.sample?'Sample '+rec.sample+' · ':'')+(rec.material||'')+(rec.code?' · '+rec.code:''),
    rec.testedBy || rec.createdBy);

  resetRawRow();
  var primero = document.getElementById('rw-n-'+(rawSection==='raw' ? 'material' : c.ident[0].f));
  if(primero) primero.focus();
  toast('Sample saved');
  renderRawRows();
}

function setRawCell(id, field, value){
  var db = getDB();
  var r = (db.raw||[]).filter(function(x){ return x.id===id; })[0];
  if(!r) return null;
  r[field] = String(value==null?'':value).trim();
  rawStampPlate(r);
  r.editedAt = localISOStr();
  saveDB(db, 'raw');
  if(window.saveToFirebase) window.saveToFirebase('raw', r);
  var cel = document.getElementById('rw-st-'+id);
  if(cel) cel.innerHTML = rawPlateHTML(r);
  return r;
}

// Cuando la placa queda leida se anota cuando y quien, una sola vez
function rawStampPlate(r){
  if(!rawPlateRead(r)) return;
  if(!r.plateAt) r.plateAt = localISOStr();
  if(!r.plateBy && typeof getInitials==='function') r.plateBy = getInitials();
}

function saveRawRow(id, btn){
  var vals = readRowFields(btn);
  if(!vals) return;
  var db = getDB();
  var r = (db.raw||[]).filter(function(x){ return x.id===id; })[0];
  if(!r) return;
  var antes = rawPlateRead(r);
  Object.keys(vals).forEach(function(f){ r[f] = String(vals[f]==null?'':vals[f]).trim(); });
  rawStampPlate(r);
  r.editedAt = localISOStr();
  saveDB(db, 'raw');
  if(window.saveToFirebase) window.saveToFirebase('raw', r);
  if(!antes && rawPlateRead(r)){
    logActivity('analysis',
      (RAW_SECTIONS[r.section] ? RAW_SECTIONS[r.section].titulo : 'Raw')+' plate read',
      (r.material||'')+' · Yeast '+(r.yeast||'—')+' · Mold '+(r.mold||'—'),
      r.plateBy || r.testedBy || '—');
  }
  var cel = document.getElementById('rw-st-'+id);
  if(cel) cel.innerHTML = rawPlateHTML(r);
  renderRawKpis();
  flashSaved(btn);
}

function renderRawKpis(){
  var kp = document.getElementById('rw-kpis');
  if(!kp || !kp.children.length) return;
  var all = rawRows();
  var pend = all.filter(function(r){ return rawState(r)==='pending'; }).length;
  var vals = [all.length, pend, all.length-pend];
  for(var i=0;i<vals.length;i++){
    var b = kp.children[i] && kp.children[i].querySelector('b');
    if(b) b.textContent = vals[i];
  }
}

function deleteRawRecord(id){
  var db = getDB();
  var r = (db.raw||[]).filter(function(x){ return x.id===id; })[0];
  if(!r) return;
  if(!confirm('Delete this sample?')) return;
  db.raw = (db.raw||[]).filter(function(x){ return x.id!==id; });
  saveDB(db, 'raw');
  if(r._fbId && window.deleteFromFirebase) window.deleteFromFirebase('raw', r._fbId);
  renderRawRows();
}

// ============================================================
// PROVEEDORES Y MATERIALES QUE SE RECIBEN
// Casi todo lo que entra es siempre lo mismo, asi que se da de alta una vez
// —que queso es y de quien viene— y despues solo se elige en la hoja.
// ============================================================
function toggleRawForm(forzar){
  var el = document.getElementById('rw-new-item');
  if(!el) return;
  var abrir = (forzar===undefined) ? el.style.display==='none' : !!forzar;
  el.style.display = abrir ? 'block' : 'none';
  if(!abrir) return;
  var s = document.getElementById('ri-supplier');
  if(s) s.innerHTML = '<option value="">— no supplier —</option>'+
    getSuppliers().map(function(x){ return '<option>'+esc(x.name)+'</option>'; }).join('');
  var n = document.getElementById('rs-name');
  if(n) n.focus();
}

function saveSupplier(){
  var el = document.getElementById('rs-name');
  var name = el ? el.value.trim() : '';
  if(!name){ toast('Type the supplier name'); return; }
  if(getSuppliers().some(function(x){ return x.name.toLowerCase()===name.toLowerCase(); })){
    toast('That supplier already exists'); return;
  }
  var rec = {id:newRecordId(), name:name,
             createdBy:(typeof currentUser!=='undefined' && currentUser)?currentUser.name:'—',
             createdAt: localISOStr()};
  var db = getDB();
  if(!db.suppliers) db.suppliers = [];
  db.suppliers.push(rec);
  saveDB(db, 'suppliers');
  if(window.saveToFirebase) window.saveToFirebase('suppliers', rec);
  logActivity('admin','Supplier created', name, rec.createdBy);
  el.value = '';
  toggleRawForm(true);
  renderRawDatalists();
  toast(name+' saved');
}

function saveRawItem(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; };
  var name = g('ri-name');
  if(!name){ toast('Type the cheese or product type'); return; }
  if(getRawItems().some(function(x){ return x.name.toLowerCase()===name.toLowerCase(); })){
    toast('That material already exists'); return;
  }
  var rec = {id:newRecordId(), name:name, supplier:g('ri-supplier'),
             createdBy:(typeof currentUser!=='undefined' && currentUser)?currentUser.name:'—',
             createdAt: localISOStr()};
  var db = getDB();
  if(!db.rawItems) db.rawItems = [];
  db.rawItems.push(rec);
  saveDB(db, 'rawItems');
  if(window.saveToFirebase) window.saveToFirebase('rawItems', rec);
  logActivity('admin','Raw material created', name+(rec.supplier?' · '+rec.supplier:''), rec.createdBy);
  var n = document.getElementById('ri-name');
  if(n){ n.value = ''; n.focus(); }
  renderRawDatalists();
  toast(name+' saved');
}

// ---- Exportar lo que esta en pantalla ----
function exportRawCSV(){
  var list = rawRows();
  if(!list.length){ toast('Nothing to export for these filters'); return; }
  var c = rawColumns();
  var cab = [c.cfg.fecha].concat(c.ident.map(function(x){ return x.t; }))
            .concat(c.medidas.map(function(x){ return x.t; }))
            .concat(['Yeast','Mold','Plate read'])
            .concat(c.extra.map(function(x){ return x.t; }));
  if(c.cfg.notas) cab.push('Notes');
  cab.push('Tested by');
  var out = [cab];
  list.forEach(function(r){
    var fila = [String(r.date||'').slice(0,10)];
    c.ident.forEach(function(x){ fila.push(r[x.f]||''); });
    c.medidas.forEach(function(x){ fila.push(r[x.f]||''); });
    fila.push(r.yeast||'', r.mold||'', String(r.plateAt||'').slice(0,10));
    c.extra.forEach(function(x){ fila.push(r[x.f]||''); });
    if(c.cfg.notas) fila.push(r.notes||'');
    fila.push(r.testedBy||'');
    out.push(fila);
  });
  downloadCSV(c.cfg.titulo.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+localDateStr()+'.csv', out);
}
