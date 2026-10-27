// ===== GRILLING CHEESE =====
// SQF # 2.4.D.3.A Pre-Grilling Cheese Verification Form, por lote.
//
// El lote pasa por tres manos y casi nunca son la misma persona:
//
//   1. RECEPCION   en shipping: lote, cuando llego y quien lo recibio.
//   2. LABORATORIO pH, Fat y Moisture. Eso NO se escribe aqui: se escribe una
//      sola vez en Raw Analysis y de ahi se jala, porque es el mismo analisis.
//   3. SENSORY     otra persona grilla la muestra y juzga appearance y texture,
//      anota correctivas si hace falta, y al final un manager aprueba.
//
// El certificado se puede sacar en cualquier momento: quien solo testeo imprime
// con el sensory en blanco, igual que cuando se imprime la forma en papel para
// que la llene el que grilla. Cuando el sensory se completa, se vuelve a sacar
// y sale entero.
//
// Aqui aparece todo lo que en Raw sea grilling cheese; no hay que volver a
// registrar el lote.

// Los limites de la forma, revision 10/09/2026 (antes pH 5.90-6.3 y Fat
// 47.70-50.60%). Fat ">40" no incluye el 40.
var GC_SPEC = {
  ph:       {t:'pH', spec:'6.05-6.5',          min:6.05,  max:6.50},
  fat:      {t:'Fat by Dry Matter', spec:'>40', min:40, minExcl:true},
  moisture: {t:'Moisture', spec:'≤ 42%',              max:42}
};

var gcView = 'all';     // all | lab | sensory | done
var gcDirty = false;

function getGrilling(){ var d=getDB(); if(!d.grilling) d.grilling=[]; return d.grilling; }

// Un material es grilling cheese si el catalogo lo marca asi, o si el nombre
// lo dice. Lo segundo es lo que pediste: lo que diga grilling cheese, entra.
function isGrillingMaterial(nombre){
  var n = String(nombre||'').toLowerCase();
  if(!n) return false;
  if(n.indexOf('grilling') >= 0) return true;
  return getRawItems().some(function(x){
    return x.grilling && String(x.name||'').toLowerCase() === n;
  });
}

// ---- Los extras de la forma, uno por lote, colgados del registro de Raw ----
function gcExtra(rawId){
  return getGrilling().filter(function(x){ return x.rawId===rawId; })[0] || null;
}
function gcExtraOrEmpty(rawId){ return gcExtra(rawId) || {rawId:rawId}; }
function gcEnsure(db, rawId){
  if(!db.grilling) db.grilling = [];
  var g = db.grilling.filter(function(x){ return x.rawId===rawId; })[0];
  if(!g){
    g = {id:newRecordId(), rawId:rawId,
         receivedDate:'', receivedBy:'',
         appearance:'', appearanceNote:'', texture:'', textureNote:'', corrective:'',
         sensoryDate:'', sensoryBy:'', approvedBy:'', approvedAt:'',
         createdAt: localISOStr()};
    db.grilling.push(g);
  }
  return g;
}

// ---- Especificacion ----
function gcNum(v){ var n=parseFloat(v); return isNaN(n) ? null : n; }
function gcHas(v){ return v!=null && String(v).trim()!==''; }

// El pH tiene dos niveles: el rango impreso manda para pasar o no, y a mas
// de 0.25 fuera de el se pone en HOLD y se sacan tres muestras mas. Esa nota
// era de la forma anterior (sobre 6.1-6.3); la revision 10/09/2026 ya no la
// imprime, y aqui se sigue aplicando sobre el rango nuevo.
function gcPhState(v){
  var n = gcNum(v);
  if(n==null) return '';
  var s = GC_SPEC.ph;
  if(n >= s.min && n <= s.max) return 'ok';
  if(n >= s.min-0.25 && n <= s.max+0.25) return 'out';   // 5.80 a 6.75
  return 'hold';
}
function gcState(campo, v){
  if(campo==='ph') return gcPhState(v);
  var n = gcNum(v);
  if(n==null) return '';
  var s = GC_SPEC[campo];
  if(s.min!=null && (s.minExcl ? n <= s.min : n < s.min)) return 'out';
  if(s.max!=null && n > s.max) return 'out';
  return 'ok';
}
function gcValueHTML(campo, v){
  if(!gcHas(v)) return '<span class="pill bad">Pending</span>';
  var st = gcState(campo, v);
  var cls = st==='ok' ? 'ok' : 'bad';
  return '<span class="pill '+cls+'">'+esc(v)+'</span>';
}

// ---- Estado del lote ----
function gcLabDone(r){ return gcHas(r.ph) && gcHas(r.fat) && gcHas(r.moisture); }
function gcSensoryDone(g){ return gcHas(g.appearance) && gcHas(g.texture); }
function gcStage(r, g){
  if(!gcLabDone(r))    return 'lab';
  if(!gcSensoryDone(g))return 'sensory';
  if(!gcHas(g.approvedBy)) return 'approval';
  return 'done';
}
var GC_STAGE_TXT = {lab:'Pending Lab', sensory:'Pending Sensory',
                    approval:'Pending Approval', done:'Completed'};
function gcStageHTML(r, g){
  var s = gcStage(r,g);
  return '<span class="pill '+(s==='done'?'ok':'bad')+'">'+GC_STAGE_TXT[s]+'</span>'+
    (gcPhState(r.ph)==='hold'
      ? '<div class="gc-hold">HOLD · test 3 more samples (top, middle, bottom)</div>' : '');
}

// ---- La forma impresa ----
// El navegador no sabe si la hoja salio de la impresora: lo confirma quien
// imprime (grilling-pdf.js) y queda quien, cuando y con que datos. Si despues
// cambia algo de lo que va en la forma —se completa el sensory, se aprueba—
// lo impreso ya no es lo de hoy y la marca pide reimprimir.
function gcPrintSig(r, g){
  var s = [r.code||r.sample, r.date, r.ph, r.fat, r.moisture, r.testedBy,
           g.receivedDate, g.receivedBy, g.appearance, g.appearanceNote, g.texture, g.textureNote,
           g.corrective, g.sensoryDate, g.sensoryBy, g.approvedBy, g.approvedAt]
    .map(function(x){ return String(x==null ? '' : x).replace(/\s+/g,' ').trim(); }).join('|');
  var h = 5381;
  for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
// 'ok' impresa con lo de hoy · 'old' impresa antes de un cambio · '' nunca
function gcPrintState(r, g){
  if(!g || !g.printedAt) return '';
  return g.printedSig === gcPrintSig(r, g) ? 'ok' : 'old';
}
function gcPrintedHTML(r, g){
  var st = gcPrintState(r, g);
  if(!st) return '';
  var d = new Date(g.printedAt);
  var cuando = fmtDate(g.printedAt) + (isNaN(d) ? '' :
               ' ' + d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}));
  var quien = g.printedBy ? ' by ' + g.printedBy : '';
  return st === 'ok'
    ? '<span class="pill ok gc-printed" data-tip="Printed OK · '+esc(cuando+quien)+'">✓ Printed</span>'
    : '<span class="pill warn gc-printed" data-tip="Printed '+esc(cuando+quien)+
        ', before the last changes · print it again">Reprint</span>';
}
function gcRefreshPrinted(rawId, r, g){
  var el = document.getElementById('gc-pr-'+rawId);
  if(el) el.innerHTML = gcPrintedHTML(r, g);
}

// ============================================================
// PANTALLA
// ============================================================
function initGrilling(){
  gcView = 'all';
  gcDirty = false; renderGcDirty();
  buildGrillingSheet();
  renderGrilling();
}

function markGcDirty(){
  if(gcDirty) return;
  gcDirty = true; renderGcDirty();
}
function renderGcDirty(){
  var el = document.getElementById('gc-dirty');
  if(el) el.style.display = gcDirty ? 'block' : 'none';
  var b = document.getElementById('gc-go');
  if(b) b.classList.toggle('pending', gcDirty);
}
function applyGcFilters(){
  gcDirty = false; renderGcDirty();
  var f = document.getElementById('gc-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderGrilling); return; }
  renderGrilling();
}
function setGcView(v){ gcView = v; renderGrilling(); }

function gcRows(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var from=g('gc-from'), to=g('gc-to'), q=(g('gc-search')||'').trim().toLowerCase();
  return (typeof getRawRecords==='function' ? getRawRecords() : []).filter(function(r){
    if(!isGrillingMaterial(r.material)) return false;
    if(!inScope(r.date, from, to, gcStage(r, gcExtraOrEmpty(r.id))!=='done')) return false;
    if(q){
      var ex = gcExtraOrEmpty(r.id);
      var hay = [r.code,r.sample,r.material,r.testedBy,ex.receivedBy,ex.sensoryBy,ex.approvedBy]
                .join(' ').toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  }).sort(function(a,b){
    return String(b.date||'').localeCompare(String(a.date||'')) || (b.id||0)-(a.id||0);
  });
}

function buildGrillingSheet(){
  var host = document.getElementById('gc-sheet');
  if(!host) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th>'+
      '<th>Batch ID / Lot</th>'+
      '<th>Received</th>'+
      '<th>Received by</th>'+
      '<th>Date tested</th>'+
      '<th class="num">pH</th>'+
      '<th class="num">Fat</th>'+
      '<th class="num">Moisture</th>'+
      '<th>Performed by</th>'+
      '<th>Appearance</th>'+
      '<th class="wide">Appearance comments</th>'+
      '<th>Texture</th>'+
      '<th class="wide">Texture comments</th>'+
      '<th class="wide">Corrective actions</th>'+
      '<th>Sensory by</th>'+
      '<th>Approved</th>'+
      '<th>Status</th>'+
      '<th>Save</th>'+
      '<th>Form</th>'+
    '</tr></thead><tbody id="gc-body"></tbody></table></div>';
}

function renderGrilling(){
  var body = document.getElementById('gc-body');
  if(!body) return;
  var all = gcRows();
  var cuenta = {lab:0, sensory:0, approval:0, done:0};
  all.forEach(function(r){ cuenta[gcStage(r, gcExtraOrEmpty(r.id))]++; });

  var kp = document.getElementById('gc-kpis');
  if(kp){
    var k = function(v, n, label, tono, icono){
      return kpiCard(n, label, {tono:tono, icono:icono, on:gcView===v,
                                click:"setGcView('"+v+"')"});
    };
    kp.innerHTML = k('all', all.length, 'lots in range', '', 'box') +
      k('lab', cuenta.lab, 'pending lab', 'bad', 'droplet') +
      k('sensory', cuenta.sensory, 'pending sensory', 'bad', 'user') +
      k('approval', cuenta.approval, 'pending approval', 'bad', 'lock') +
      k('done', cuenta.done, 'completed', 'ok', 'check');
    renderIcons(kp);
  }

  var list = all.filter(function(r){
    if(gcView==='all') return true;
    var s = gcStage(r, gcExtraOrEmpty(r.id));
    return s===gcView;
  });

  if(!list.length){
    body.innerHTML = '<tr><td colspan="19" class="sheet-empty" style="border:0">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No grilling cheese lots for these dates. They show up here as soon as '+
                    'the lot is recorded in Raw Analysis.')+'</td></tr>';
    return;
  }
  body.innerHTML = list.map(function(r,i){ return gcRowHTML(r, i+1); }).join('');
  renderIcons(body);
}

function gcRowHTML(r, i){
  var g = gcExtraOrEmpty(r.id);
  var v = function(x){ return (x==null||x==='') ? '—' : esc(x); };
  var yn = function(campo, val){
    return '<select class="cell" data-f="'+campo+'" onchange="saveGcRow('+r.id+',this)">'+
      '<option value=""'+(val?'':' selected')+'></option>'+
      '<option'+(val==='Yes'?' selected':'')+'>Yes</option>'+
      '<option'+(val==='No'?' selected':'')+'>No</option></select>';
  };
  var texto = function(campo, val, ph){
    return '<input class="cell" data-f="'+campo+'" placeholder="'+esc(ph||'')+'" value="'+esc(val||'')+'">';
  };
  var etapa = gcStage(r,g);

  return '<tr'+(etapa==='done'?' class="done"':'')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+v(r.code || r.sample)+'</td>'+
    '<td><input type="date" class="cell" data-f="receivedDate" value="'+esc(g.receivedDate||'')+'"></td>'+
    '<td>'+texto('receivedBy', g.receivedBy, 'Who received it')+'</td>'+
    '<td class="soft">'+esc(fmtDate(r.date))+'</td>'+
    '<td class="num">'+gcValueHTML('ph', r.ph)+'</td>'+
    '<td class="num">'+gcValueHTML('fat', r.fat)+'</td>'+
    '<td class="num">'+gcValueHTML('moisture', r.moisture)+'</td>'+
    '<td class="soft">'+v(r.testedBy)+'</td>'+
    '<td>'+yn('appearance', g.appearance)+'</td>'+
    '<td class="wide">'+texto('appearanceNote', g.appearanceNote, 'Comments')+'</td>'+
    '<td>'+yn('texture', g.texture)+'</td>'+
    '<td class="wide">'+texto('textureNote', g.textureNote, 'Comments')+'</td>'+
    '<td class="wide">'+texto('corrective', g.corrective, 'If applicable')+'</td>'+
    '<td class="soft">'+v(g.sensoryBy)+(g.sensoryDate?'<br><span class="soft">'+esc(fmtDate(g.sensoryDate))+'</span>':'')+'</td>'+
    '<td id="gc-ap-'+r.id+'">'+gcApproveHTML(r, g)+'</td>'+
    '<td id="gc-st-'+r.id+'">'+gcStageHTML(r, g)+'</td>'+
    '<td>'+saveBtn("saveGcRow("+r.id+",this)")+'</td>'+
    '<td class="gc-form"><div class="row-icos">'+
      '<button class="ico-btn sm" onclick="printGrillingPdf('+r.id+')" aria-label="Print the official form now"'+
        ' data-tip="Print now · SQF 2.4.D.3.A"><span data-icon="print"></span></button>'+
      '<button class="ico-btn sm" onclick="downloadGrillingPdf('+r.id+')" aria-label="Official form, SQF 2.4.D.3.A (PDF)"'+
        ' data-tip="Official form · SQF 2.4.D.3.A (PDF)"><span data-icon="pdf"></span></button>'+
    '</div><div id="gc-pr-'+r.id+'">'+gcPrintedHTML(r, g)+'</div></td>'+
  '</tr>';
}

// La aprobacion final es del manager o del administrador, como los reportes
// guardados. Al operador se le dice quien tiene que firmar.
function gcApproveHTML(r, g){
  if(gcHas(g.approvedBy)){
    return '<span class="pill ok">'+esc(g.approvedBy)+
           (g.approvedAt ? ' · '+esc(fmtDate(g.approvedAt)) : '')+'</span>';
  }
  if(!gcSensoryDone(g)) return '<span class="pill bad">Pending</span>';
  if(typeof canApprove==='function' && !canApprove())
    return '<span class="pill bad">Pending manager</span>';
  return '<button class="sheet-btn" onclick="approveGrilling('+r.id+')">Approve</button>';
}

function saveGcRow(rawId, btn){
  var vals = readRowFields(btn);
  if(!vals) return;
  var db = getDB();
  var g = gcEnsure(db, rawId);
  var antes = gcSensoryDone(g);
  Object.keys(vals).forEach(function(f){ g[f] = String(vals[f]==null?'':vals[f]).trim(); });
  // El sensory queda firmado con quien lo cerro, la primera vez que se cierra
  if(!antes && gcSensoryDone(g)){
    if(!g.sensoryBy && typeof getInitials==='function') g.sensoryBy = getInitials();
    if(!g.sensoryDate) g.sensoryDate = localDateStr();
  }
  g.editedAt = localISOStr();
  saveDB(db, 'grilling');
  if(window.saveToFirebase) window.saveToFirebase('grilling', g);

  var r = (db.raw||[]).filter(function(x){ return x.id===rawId; })[0] || {};
  if(!antes && gcSensoryDone(g)){
    logActivity('analysis','Grilling cheese sensory completed',
      (r.code||r.sample||'')+' · Appearance '+g.appearance+' · Texture '+g.texture,
      g.sensoryBy || '—');
  }
  var st = document.getElementById('gc-st-'+rawId);
  if(st) st.innerHTML = gcStageHTML(r, g);
  var ap = document.getElementById('gc-ap-'+rawId);
  if(ap) ap.innerHTML = gcApproveHTML(r, g);
  gcRefreshPrinted(rawId, r, g);
  if(btn && btn.classList && btn.classList.contains('sheet-btn')) flashSaved(btn);
}

function approveGrilling(rawId){
  if(typeof canApprove==='function' && !canApprove()){
    toast('You are not allowed to approve forms'); return;
  }
  var db = getDB();
  var g = gcEnsure(db, rawId);
  if(!gcSensoryDone(g)){ toast('The sensory review is not finished'); return; }
  g.approvedBy = currentUser ? currentUser.name : '—';
  g.approvedAt = localDateStr();
  saveDB(db, 'grilling');
  if(window.saveToFirebase) window.saveToFirebase('grilling', g);
  var r = (db.raw||[]).filter(function(x){ return x.id===rawId; })[0] || {};
  logActivity('analysis','Grilling cheese form approved', r.code||r.sample||'', g.approvedBy);
  var ap = document.getElementById('gc-ap-'+rawId);
  if(ap) ap.innerHTML = gcApproveHTML(r, g);
  var st = document.getElementById('gc-st-'+rawId);
  if(st) st.innerHTML = gcStageHTML(r, g);
  renderGrilling();
  toast('Form approved');
}

function exportGrillingCSV(){
  var list = xlEntryOrder(gcRows());            // en el orden en que se capturo
  if(!list.length){ toast('Nothing to export for these filters'); return; }
  var out = [['Batch ID / Lot','Date received','Received by','Date tested','pH','Fat','Moisture',
              'Performed by','Appearance','Appearance comments','Texture','Texture comments',
              'Corrective actions','Sensory by','Sensory date','Approved by','Date approved','Status']];
  list.forEach(function(r){
    var g = gcExtraOrEmpty(r.id);
    out.push([r.code||r.sample||'', g.receivedDate||'', g.receivedBy||'', String(r.date||'').slice(0,10),
              r.ph||'', r.fat||'', r.moisture||'', r.testedBy||'',
              g.appearance||'', g.appearanceNote||'', g.texture||'', g.textureNote||'',
              g.corrective||'', g.sensoryBy||'', g.sensoryDate||'',
              g.approvedBy||'', g.approvedAt||'', GC_STAGE_TXT[gcStage(r,g)]]);
  });
  downloadCSV('grilling-cheese-'+localDateStr()+'.csv', out);
}

// La forma oficial sale en PDF, lista para imprimir. Eso vive en
// js/integrations/grilling-pdf.js.
