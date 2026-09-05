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
  updateDupHint();
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
  return p.min+' – '+p.max+' lbs';
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
        '<span class="snum">SAMPLE '+(i+1)+'</span>' +
        '<input class="sinput" type="text" inputmode="decimal" id="si-'+i+'" placeholder="0.00" autocomplete="off" oninput="onSample('+i+',this.value)">' +
        '<span class="sicon" id="sico-'+i+'"></span>' +
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
  ico.textContent='';
  var p=activePkg();
  // Sin target (producto nuevo sin rango) sólo se registra el peso, sin pass/fail
  if(p && p.min!=null && st.samples[i]!==''){
    var num=parseFloat(st.samples[i]);
    if(!isNaN(num)){
      if(num>=p.min&&num<=p.max){row.classList.add('pass');ico.textContent='✓';}
      else{row.classList.add('fail');ico.textContent='✗';}
    }
  }
}
function updateStats(){
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
  document.getElementById('avg-val').textContent=avg.toFixed(3);
  if(p.min==null){
    cv.textContent='—';
    cv.style.color='var(--muted)';
    return;
  }
  var pass=vals.filter(function(v){return v>=p.min&&v<=p.max}).length;
  var comp=Math.round((pass/vals.length)*100);
  cv.textContent=comp+'%';
  cv.style.color=comp>=80?'var(--pass)':comp>=60?'var(--warn)':'var(--fail)';
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
  return findRecentForLine(getDB().weights, st.line, weightCheckTime());
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
  var d=findRecentWeight();
  renderDupHint('w-dup-hint', d?dupWeightTitle(d):'', d?dupWeightDetail(d):'');
}

function saveWeight(){
  if(!st.line||!st.shift){toast('Select line & shift first');return}
  if(!activePkg()){toast('Select package size');return}
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){toast('Enter at least one sample');return}
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
  db.weights.push({
    id:Date.now(), date:isoFromDateTime(document.getElementById('w-date').value, document.getElementById('check-time').value),
    line:st.line, shift:st.shift,
    pkg:st.pkg, pkgLabel:p.label,
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
  });
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('weights', db.weights[db.weights.length-1]);
  st.samples=['','','','',''];
  document.getElementById('samples-wrap').innerHTML='';
  buildSamples();
  updateStats();
  document.getElementById('w-lot').value='';
  document.getElementById('w-comments').value='';
  document.getElementById('w-initials').value='';
  clearProductSelection('weight');
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
  toast('Record saved!');
  updateDupHint();
}

