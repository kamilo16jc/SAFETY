// ===== WEIGHT =====
function initWeight(){
  document.getElementById('wm-line').textContent=st.line||'—';
  document.getElementById('wm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  var wd=document.getElementById('w-date');
  if(wd){ wd.value=localDateStr(); wd.onchange=updateDupHint; }
  var ct=document.getElementById('check-time'); if(ct) ct.onchange=updateDupHint;
  setNow();
  renderPkgChips();
  buildSamples();
  if(currentUser) document.getElementById('w-initials').value = getInitials();
  updateDupHint();
}
function renderPkgChips(){
  document.getElementById('pkg-select').innerHTML='<option value="">Select package size</option>'+PKGS.map(function(p,i){
    return '<option value="'+i+'"'+(st.pkg===i?' selected':'')+'>'+p.label+'</option>';
  }).join('');
}
function selectPkg(i){
  if(i===null||isNaN(i)){
    st.pkg=null;
    document.getElementById('target-val').textContent='Select package size';
    return;
  }
  st.pkg=i;
  document.getElementById('pkg-select').value=String(i);
  var p=PKGS[i];
  document.getElementById('target-val').textContent=p.min+' – '+p.max+' lbs';
  st.samples=['','','','',''];
  buildSamples();
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
  if(st.pkg!==null && st.samples[i]!==''){
    var num=parseFloat(st.samples[i]);
    var p=PKGS[st.pkg];
    if(!isNaN(num)){
      if(num>=p.min&&num<=p.max){row.classList.add('pass');ico.textContent='✓';}
      else{row.classList.add('fail');ico.textContent='✗';}
    }
  }
}
function updateStats(){
  if(st.pkg===null) return;
  var p=PKGS[st.pkg];
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){
    document.getElementById('avg-val').textContent='—';
    document.getElementById('comp-val').textContent='—';
    return;
  }
  var avg=vals.reduce(function(a,b){return a+b},0)/vals.length;
  var pass=vals.filter(function(v){return v>=p.min&&v<=p.max}).length;
  var comp=Math.round((pass/vals.length)*100);
  document.getElementById('avg-val').textContent=avg.toFixed(3);
  var cv=document.getElementById('comp-val');
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

// ===== DUPLICATE LINE GUARD =====
// Catches the common mistake of leaving the previous line selected after moving
// to another one: two checks on the same line within DUP_WINDOW_MIN minutes.
var dupOverride = false;

function weightCheckTime(){
  var d=document.getElementById('w-date');
  var t=document.getElementById('check-time');
  return isoFromDateTime(d?d.value:'', t?t.value:'');
}

function findRecentWeight(line, whenISO){
  if(!line) return null;
  var t=new Date(whenISO).getTime();
  if(isNaN(t)) return null;
  var span=DUP_WINDOW_MIN*60*1000;
  var best=null, bestT=0;
  (getDB().weights||[]).forEach(function(r){
    if(String(r.line)!==String(line)) return;
    var rt=new Date(r.date).getTime();
    if(isNaN(rt) || Math.abs(t-rt)>span) return;
    if(!best || Math.abs(t-rt)<Math.abs(t-bestT)){ best=r; bestT=rt; }
  });
  return best ? {rec:best, minutes:Math.round((t-bestT)/60000)} : null;
}

function dupAgoLabel(mins){
  if(mins>0)  return mins===1 ? '1 minute ago' : mins+' minutes ago';
  if(mins<0)  return (-mins)===1 ? '1 minute later' : (-mins)+' minutes later';
  return 'just now';
}

function dupDetailLine(d){
  var r=d.rec;
  return (r.time||'—')+' · '+(r.pkgLabel||'—')+' · '+(r.compliance!=null?r.compliance+'%':'—')+
         (r.lot?' · LOT '+r.lot:'')+(r.product?' · #'+r.product:'')+(r.initials?' · '+r.initials:'');
}

function updateDupHint(){
  var el=document.getElementById('w-dup-hint');
  if(!el) return;
  var d=findRecentWeight(st.line, weightCheckTime());
  if(!d){ el.style.display='none'; el.innerHTML=''; return; }
  el.innerHTML='<div class="dup-hint-title">Line '+d.rec.line+' was already checked '+dupAgoLabel(d.minutes)+'</div>'+
               '<div class="dup-hint-detail">'+dupDetailLine(d)+'</div>';
  el.style.display='block';
}

function showDupModal(d){
  var m=document.getElementById('dup-modal');
  if(!m){
    if(confirm('Line '+d.rec.line+' was already checked '+dupAgoLabel(d.minutes)+
               ' ('+dupDetailLine(d)+').\n\nSave another record for Line '+d.rec.line+'?')) dupSaveAnyway();
    return;
  }
  document.getElementById('dup-modal-title').textContent =
    'Line '+d.rec.line+' was already checked '+dupAgoLabel(d.minutes);
  document.getElementById('dup-modal-detail').textContent = dupDetailLine(d);
  m.style.display='flex';
  document.body.style.overflow='hidden';
}

function closeDupModal(){
  var m=document.getElementById('dup-modal');
  if(m) m.style.display='none';
  document.body.style.overflow='';
}

// "Change line" → back to the form with the line selector ready
function dupChangeLine(){
  closeDupModal();
  var sel=document.querySelector('#screen-weight select.line-select');
  if(sel){ sel.focus(); if(sel.scrollIntoView) sel.scrollIntoView({block:'center'}); }
}

function dupSaveAnyway(){
  closeDupModal();
  dupOverride=true;
  commitWeight();
}

function saveWeight(){
  if(!st.line||!st.shift){toast('Select line & shift first');return}
  if(st.pkg===null){toast('Select package size');return}
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){toast('Enter at least one sample');return}
  var dup=findRecentWeight(st.line, weightCheckTime());
  if(dup){ showDupModal(dup); return; }
  commitWeight();
}

function commitWeight(){
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  var p=PKGS[st.pkg];
  var pass=vals.filter(function(v){return v>=p.min&&v<=p.max}).length;
  var db=getDB();
  db.weights.push({
    id:Date.now(), date:isoFromDateTime(document.getElementById('w-date').value, document.getElementById('check-time').value),
    line:st.line, shift:st.shift,
    pkg:st.pkg, pkgLabel:p.label,
    vals:vals, avg:vals.reduce(function(a,b){return a+b},0)/vals.length,
    pass:pass, total:vals.length,
    compliance:Math.round((pass/vals.length)*100),
    time:document.getElementById('check-time').value,
    lot:document.getElementById('w-lot').value,
    product:document.getElementById('w-product').value,
    comments:document.getElementById('w-comments').value,
    initials:document.getElementById('w-initials').value,
    target:{min:p.min,max:p.max}
  });
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('weights', db.weights[db.weights.length-1]);
  st.samples=['','','','',''];
  document.getElementById('samples-wrap').innerHTML='';
  buildSamples();
  updateStats();
  document.getElementById('w-lot').value='';
  document.getElementById('w-product').value='';
  document.getElementById('w-comments').value='';
  document.getElementById('w-initials').value='';
  var rec = db.weights[db.weights.length-1];
  var compliance = rec.compliance + '% (' + rec.pass + '/' + rec.total + ')';
  logActivity('weight','Weight record saved',
    'Line '+rec.line+' · '+rec.pkgLabel+' · LOT: '+(rec.lot||'—')+' · Compliance: '+compliance+
    (dupOverride?' · ⚠ saved over duplicate-line warning':''),
    rec.initials||(currentUser?currentUser.name:'—'));
  dupOverride=false;
  // Play sound based on compliance
  if(rec.pass < rec.total) playAlert('fail'); else playAlert('pass');
  toast('Record saved!');
  updateDupHint();
}

