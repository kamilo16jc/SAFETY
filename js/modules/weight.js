// ===== WEIGHT =====
function initWeight(){
  document.getElementById('wm-line').textContent=st.line||'—';
  document.getElementById('wm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  var wd=document.getElementById('w-date');
  if(wd){ wd.value=localDateStr(); wd.onchange=updateDupHint; }
  var ct=document.getElementById('check-time'); if(ct) ct.onchange=updateDupHint;
  setNow();
  if(!st.shift) selectShift(expectedShift());   // turno por defecto según la hora
  renderPkgChips();
  buildSamples();
  if(currentUser) document.getElementById('w-initials').value = getInitials();
  renderProductOptions('w-product-list');
  onProductInput('weight');
  var ws=document.getElementById('w-status'); if(ws) ws.value='running';
  setWeightStatus('running');   // arranca en modo normal (llama a updateDupHint)
  if(typeof wpPintar==='function'){ wpPintar(); wpAviso(); }
}

// ===== LINE STATUS (Running / Labeling / On break / Line down) =====
// Con un issue no se toman pesos: se ocultan los campos de peso y se registra
// la hora + un comentario por defecto.
function setWeightStatus(v){
  st.wIssue = (v==='running') ? null : v;
  var isIssue = !!st.wIssue;
  var top = document.getElementById('w-weight-top');
  var bot = document.getElementById('w-weight-bottom');
  if(top) top.style.display = isIssue ? 'none' : '';
  if(bot) bot.style.display = isIssue ? 'none' : '';
  // Que la linea esta parada lo dicen ya el propio selector y la nota que
  // aparece sola en Comments. Un recuadro de color repitiendolo quitaba sitio
  // y competia con el aviso que si hay que leer, el de duplicidad.
  var btn = document.getElementById('w-save-label') ||
            document.querySelector('#screen-weight .main-btn');
  if(isIssue){
    var c = document.getElementById('w-comments');
    if(c) c.value = weightIssueComment(st.wIssue, document.getElementById('check-time').value);
    if(btn) btn.textContent = 'Log issue';
    var dh = document.getElementById('w-dup-hint'); if(dh) dh.style.display='none';
  } else {
    var c2 = document.getElementById('w-comments'); if(c2) c2.value='';
    if(btn) btn.textContent = 'Save record';
    updateDupHint();
  }
  syncUnitLabel();
}

// Peso activo: uno de la lista PKGS o el del producto si no está en la lista.
// Puede no tener target (productos nuevos sin rango definido todavía).
function activePkg(){
  if(st.customPkg) return st.customPkg;
  if(st.pkg!=null && PKGS[st.pkg]) return PKGS[st.pkg];
  return null;
}

function renderPkgChips(){
  var opts='<option value="">Select package size</option>'+PKGS.map(function(p,i){
    return '<option value="'+i+'"'+(st.pkg===i && !st.customPkg?' selected':'')+'>'+p.label+'</option>';
  }).join('');
  if(st.customPkg){
    opts+='<option value="custom" selected>'+st.customPkg.label+' (from product)</option>';
  }
  document.getElementById('pkg-select').innerHTML=opts;
}

function targetText(p){
  if(!p) return 'Select package size';
  if(p.min==null || p.max==null) return p.label+' · no target set';
  return p.min+' – '+p.max+' '+unitLabel(pkgUnit(p));
}

// Ajusta la etiqueta "Samples (LBS/OZ)" según la unidad del paquete activo.
// Con la línea parada no hay muestras y en esa tarjeta solo queda el
// comentario, así que el título dice lo que de verdad hay debajo.
function syncUnitLabel(){
  var el = document.getElementById('w-samples-label');
  if(!el) return;
  if(st.wIssue){ el.textContent = 'Note'; return; }
  var p = activePkg();
  el.textContent = 'Samples ('+unitLabel(p?pkgUnit(p):'lb').toUpperCase()+')';
}

// Limpia estado Y pantalla: antes se borraba st.samples pero los números
// seguían escritos en los campos, y el registro salía vacío.
function clearSamples(){
  st.samples=['','','','',''];
  document.getElementById('samples-wrap').innerHTML='';
  buildSamples();
}

// Acepta '' | '0'..'9' | 'custom' | número | null
function selectPkg(v){
  if(v==='custom' && st.customPkg){
    if(st.pkg===null){ // ya estaba puesto: no borres lo que el operador escribió
      document.getElementById('pkg-select').value='custom';
      document.getElementById('target-val').textContent=targetText(activePkg());
      return;
    }
    st.pkg=null;
  } else {
    var i = (v===null||v===''||v===undefined) ? null : parseInt(v);
    if(i===null||isNaN(i)){
      if(st.pkg===null && !st.customPkg) return;
      st.pkg=null; st.customPkg=null;
      renderPkgChips();
      document.getElementById('target-val').textContent='Select package size';
      clearSamples();
      updateStats();
      return;
    }
    if(st.pkg===i && !st.customPkg) return;   // sin cambios
    st.pkg=i; st.customPkg=null;
  }
  renderPkgChips();
  document.getElementById('pkg-select').value = st.customPkg ? 'custom' : String(st.pkg);
  document.getElementById('target-val').textContent=targetText(activePkg());
  clearSamples();
  updateStats();
}

// Peso que viene de un producto del catálogo y no está en PKGS
function selectCustomPkg(prod){
  var same = st.customPkg && st.customPkg.label===prod.pkgLabel;
  st.pkg=null;
  st.customPkg={label:prod.pkgLabel,
                min:(prod.target?prod.target.min:null),
                max:(prod.target?prod.target.max:null)};
  renderPkgChips();
  document.getElementById('pkg-select').value='custom';
  document.getElementById('target-val').textContent=targetText(activePkg());
  if(!same){ clearSamples(); }
  updateStats();
}
function buildSamples(){
  var wrap=document.getElementById('samples-wrap');
  if(wrap.children.length===0){
    wrap.innerHTML=st.samples.map(function(v,i){
      return '<div class="sample-row" id="sr-'+i+'">' +
        '<span class="snum">Sample '+(i+1)+'</span>' +
        '<input class="sinput" type="text" inputmode="decimal" id="si-'+i+'" placeholder="0.00" autocomplete="off" oninput="onSample('+i+',this.value)">' +
        '<span class="sicon" id="sico-'+i+'">\u2014</span>' +
      '</div>';
    }).join('');
  }
}
function onSample(i,v){
  st.samples[i]=v.replace(',','.');
  updateSampleUI(i);
  updateStats();
}
function updateSampleUI(i){
  var row=document.getElementById('sr-'+i);
  var ico=document.getElementById('sico-'+i);
  if(!row||!ico) return;
  row.className='sample-row';
  ico.className='sicon';
  ico.textContent='\u2014';
  var p=activePkg();
  // Sin target (producto nuevo sin rango) sólo se registra el peso, sin pass/fail
  if(p && p.min!=null && st.samples[i]!==''){
    var num=parseFloat(st.samples[i]);
    if(!isNaN(num)){
      // La palabra dice si se paso o se quedo corto; el color solo lo repite,
      // que en una hoja impresa en blanco y negro es lo unico que queda.
      if(num < p.min){ row.classList.add('fail'); ico.classList.add('low');  ico.textContent='Low'; }
      else if(num > p.max){ row.classList.add('fail'); ico.classList.add('high'); ico.textContent='High'; }
      else { row.classList.add('pass'); ico.classList.add('ok'); ico.textContent='OK'; }
    }
  }
}
function updateStats(){
  syncUnitLabel();
  var p=activePkg();
  var cv=document.getElementById('comp-val');
  if(!p){ document.getElementById('avg-val').textContent='—'; cv.textContent='—'; return; }
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){
    document.getElementById('avg-val').textContent='—';
    cv.textContent='—';
    return;
  }
  var avg=vals.reduce(function(a,b){return a+b},0)/vals.length;
  var av=document.getElementById('avg-val');
  av.textContent=avg.toFixed(3);
  av.className='ns-v';
  if(p.min==null){
    cv.textContent='—';
    cv.className='ns-v';
    weightOutMsg(0, vals.length);
    return;
  }
  av.classList.add(avg>=p.min&&avg<=p.max ? 'ok' : 'bad');
  var pass=vals.filter(function(v){return v>=p.min&&v<=p.max}).length;
  var fuera=vals.length-pass;
  var comp=Math.round((pass/vals.length)*100);
  cv.textContent=comp+'%';
  cv.className='ns-v'+(fuera ? ' bad' : ' ok');
  weightOutMsg(fuera, vals.length);
}

// El aviso de lo que se sale: dice cuantas y que hacer, y se va solo cuando
// deja de haber motivo.
function weightOutMsg(fuera, total){
  var caja=document.getElementById('w-outmsg');
  if(!caja) return;
  var txt=document.getElementById('w-outmsg-text');
  if(fuera>0 && txt){
    txt.textContent=fuera+' of '+total+' sample'+(total===1?'':'s')+
      ' out of range. Add a corrective action in Comments.';
  }
  caja.classList.toggle('show', fuera>0);
}

// Guardar y seguir: el mismo guardado, pero deja la hoja lista para la
// siguiente revision —muestras en blanco y la hora puesta—, que es como se
// trabaja una linea corriendo.
// Guardar puede pasar por el aviso de duplicidad y volver mas tarde, asi que
// se apunta que boton se pulso y lo consume quien escribe el registro. Se
// apunta al entrar: si el aviso corta el guardado, la proxima vez no se
// confirma en el boton equivocado.
var weightSaveBtn = 'w-save-btn';

function saveWeightNext(){
  var antes=(getDB().weights||[]).length;
  saveWeight('w-next-btn');
  if((getDB().weights||[]).length>antes){
    clearSamples();
    setNow();
    var primero=document.getElementById('si-0');
    if(primero) primero.focus();
  }
}
function setNow(){
  var now=new Date();
  var t=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  document.getElementById('check-time').value=t;
  document.getElementById('time-val').textContent=t;
  updateDupHint();
}

// ===== DUPLICATE LINE GUARD (ver js/core/dup-guard.js) =====
function weightCheckTime(){
  var d=document.getElementById('w-date');
  var t=document.getElementById('check-time');
  return isoFromDateTime(d?d.value:'', t?t.value:'');
}

function findRecentWeight(){
  // Los issues no son pesos: no deben disparar la alerta de duplicidad
  var real = getDB().weights.filter(function(r){ return !r.issue; });
  return findRecentForLine(real, st.line, weightCheckTime());
}

function dupWeightTitle(d){
  return 'Line '+d.rec.line+' was already checked '+dupAgoLabel(d.minutes);
}

function dupWeightDetail(d){
  var r=d.rec;
  return (r.time||'—')+' · '+(r.pkgLabel||'—')+' · '+(r.compliance!=null?r.compliance+'%':'—')+
         (r.lot?' · LOT '+r.lot:'')+(r.product?' · #'+r.product:'')+(r.initials?' · '+r.initials:'');
}

function updateDupHint(){
  // En modo issue no hay chequeo de duplicidad; refresca el comentario con la hora
  if(st.wIssue){
    var c=document.getElementById('w-comments');
    if(c) c.value = weightIssueComment(st.wIssue, document.getElementById('check-time').value);
    return;
  }
  var d=findRecentWeight();
  renderDupHint('w-dup-hint', d?dupWeightTitle(d):'', d?dupWeightDetail(d):'');
}

function saveWeight(cual){
  weightSaveBtn = cual || 'w-save-btn';
  if(st.wIssue){ commitWeightIssue(); return; }   // línea parada: registra el issue
  if(!st.line||!st.shift){toast('Select line & shift first');return}
  if(!activePkg()){toast('Select package size');return}
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){toast('Enter at least one sample');return}
  // Lot de la bolsa distinto al de la etiqueta: se guarda, pero con comentario
  if(typeof wpLotBloquea==='function' && wpLotBloquea()) return;
  var d=findRecentWeight();
  if(d){
    showDupModal({title:dupWeightTitle(d), detail:dupWeightDetail(d),
                  commit:commitWeight, screen:'screen-weight'});
    return;
  }
  commitWeight();
}

function commitWeight(){
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  var p=activePkg();
  var hasTarget = p.min!=null && p.max!=null;
  var pass = hasTarget ? vals.filter(function(v){return v>=p.min&&v<=p.max}).length : null;
  var db=getDB();
  var nuevo = {
    id:newRecordId(), date:isoFromDateTime(document.getElementById('w-date').value, document.getElementById('check-time').value),
    line:st.line, shift:st.shift,
    pkg:st.pkg, pkgLabel:p.label, unit:pkgUnit(p),
    vals:vals, avg:vals.reduce(function(a,b){return a+b},0)/vals.length,
    pass:pass, total:vals.length,
    compliance: hasTarget ? Math.round((pass/vals.length)*100) : null,
    time:document.getElementById('check-time').value,
    lot:document.getElementById('w-lot').value,
    product:document.getElementById('w-product').value,
    productName: currentProduct ? currentProduct.name : '',
    bagsPerCase: currentProduct ? currentProduct.bagsPerCase : null,
    comments:document.getElementById('w-comments').value,
    initials:document.getElementById('w-initials').value,
    target:{min:hasTarget?p.min:null, max:hasTarget?p.max:null}
  };
  // La foto (si se tomo) se lleva su nombre; el archivo espera en el telefono
  if(typeof wpAdjuntar==='function') wpAdjuntar(nuevo);
  db.weights.push(nuevo);
  saveDB(db,'weights');
  if(window.saveToFirebase) window.saveToFirebase('weights', db.weights[db.weights.length-1]);
  st.samples=['','','','',''];
  document.getElementById('samples-wrap').innerHTML='';
  buildSamples();
  updateStats();
  document.getElementById('w-lot').value='';
  document.getElementById('w-comments').value='';
  document.getElementById('w-initials').value='';
  clearProductSelection('weight');
  if(typeof lotRefresh==='function') lotRefresh('weight');
  var rec = db.weights[db.weights.length-1];
  var compliance = rec.compliance!=null
    ? rec.compliance + '% (' + rec.pass + '/' + rec.total + ')'
    : 'n/a (no target)';
  logActivity('weight','Weight record saved',
    'Line '+rec.line+' · '+rec.pkgLabel+(rec.product?' · #'+rec.product:'')+
    ' · LOT: '+(rec.lot||'—')+' · Compliance: '+compliance+
    dupOverrideNote(),
    rec.initials||(currentUser?currentUser.name:'—'));
  // Play sound based on compliance
  if(rec.pass!=null && rec.pass < rec.total) playAlert('fail'); else playAlert('pass');
  cbtnSaved(weightSaveBtn);
  toast('Record saved!');
  updateDupHint();
  // Si ese producto está en el schedule y debe muestra de lab, ofrecer marcarla.
  // Con un respiro para que cierre el modal de duplicidad si venía de ahí.
  if(typeof offerRunCollect==='function') setTimeout(function(){ offerRunCollect(rec); }, 200);
}

// Registra un issue de línea (Labeling / On break / Line down) en vez de un peso.
// "Issue" va en el campo de package (arriba), la hora en time y el comentario
// (con la hora) abajo. No cuenta para compliance ni aparece en el Dashboard.
function commitWeightIssue(){
  if(!st.line||!st.shift){ toast('Select line & shift first'); return; }
  var issue = st.wIssue;
  var info  = WEIGHT_ISSUES[issue];
  var timeVal = document.getElementById('check-time').value;
  var comment = document.getElementById('w-comments').value.trim() || weightIssueComment(issue, timeVal);
  var db = getDB();
  var nuevo = {
    id: newRecordId(),
    date: isoFromDateTime(document.getElementById('w-date').value, timeVal),
    line: st.line, shift: st.shift,
    issue: issue,
    pkg: null, pkgLabel: 'Issue',
    vals: [], avg: null, pass: null, total: 0, compliance: null,
    time: timeVal,
    lot: '', product: '', productName: '', bagsPerCase: null,
    comments: comment,
    initials: document.getElementById('w-initials').value,
    target: {min:null, max:null}
  };
  // Una linea parada tambien puede llevar foto (de lo que la paro)
  if(typeof wpAdjuntar==='function') wpAdjuntar(nuevo);
  db.weights.push(nuevo);
  saveDB(db);
  var rec = db.weights[db.weights.length-1];
  if(window.saveToFirebase) window.saveToFirebase('weights', rec);
  logActivity('weight','Line issue logged',
    'Line '+rec.line+' · '+info.label+' · '+(rec.time||'—'),
    rec.initials||(currentUser?currentUser.name:'—'));
  document.getElementById('w-comments').value='';
  document.getElementById('w-initials').value='';
  playAlert('pass');
  toast(info.label+' logged');
  // vuelve a modo normal para el próximo registro
  var ws=document.getElementById('w-status'); if(ws) ws.value='running';
  setWeightStatus('running');
  // de ultima: setWeightStatus reescribe el rotulo del boton
  cbtnSaved(weightSaveBtn, 'Logged');
}

