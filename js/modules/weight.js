// ===== WEIGHT =====
function initWeight(){
  document.getElementById('wm-line').textContent=st.line||'—';
  document.getElementById('wm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  setNow();
  renderPkgChips();
  buildSamples();
  if(currentUser) document.getElementById('w-initials').value = getInitials();
}
function renderPkgChips(){
  document.getElementById('pkg-scroll').innerHTML=PKGS.map(function(p,i){
    return '<div class="pkg-chip'+(st.pkg===i?' selected':'')+'" onclick="selectPkg('+i+')">'+p.label+'</div>';
  }).join('');
}
function selectPkg(i){
  st.pkg=i;
  renderPkgChips();
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
}
function saveWeight(){
  if(!st.line||!st.shift){toast('Select line & shift first');return}
  if(st.pkg===null){toast('Select package size');return}
  var vals=st.samples.map(function(v){return parseFloat(v)}).filter(function(v){return !isNaN(v)});
  if(!vals.length){toast('Enter at least one sample');return}
  var p=PKGS[st.pkg];
  var pass=vals.filter(function(v){return v>=p.min&&v<=p.max}).length;
  var db=getDB();
  db.weights.push({
    id:Date.now(), date:localISOStr(),
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
    'Line '+rec.line+' · '+rec.pkgLabel+' · LOT: '+(rec.lot||'—')+' · Compliance: '+compliance,
    rec.initials||(currentUser?currentUser.name:'—'));
  // Play sound based on compliance
  if(rec.pass < rec.total) playAlert('fail'); else playAlert('pass');
  toast('Record saved!');
}

