// ===== SEAL =====
function initSeal(){
  document.getElementById('sm-line').textContent=st.line||'—';
  document.getElementById('sm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  var sd=document.getElementById('s-date');
  if(sd){ sd.value=localDateStr(); sd.onchange=updateSealDupHint; }
  var stime=document.getElementById('seal-time'); if(stime) stime.onchange=updateSealDupHint;
  setSealNow();
  renderSealList();
  if(currentUser) document.getElementById('s-initials').value = getInitials();
  renderProductOptions('s-product-list');
  onProductInput('seal');
  updateSealDupHint();
}
function setSealNow(){
  var now=new Date();
  document.getElementById('seal-time').value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  updateSealDupHint();
}

// ===== DUPLICATE LINE GUARD (ver js/core/dup-guard.js) =====
function sealCheckTime(){
  var d=document.getElementById('s-date');
  var t=document.getElementById('seal-time');
  return isoFromDateTime(d?d.value:'', t?t.value:'');
}

function findRecentSeal(){
  return findRecentForLine(getDB().seals, st.line, sealCheckTime());
}

function dupSealTitle(d){
  return 'Line '+d.rec.line+' already has a bag seal check '+dupAgoLabel(d.minutes);
}

function dupSealDetail(d){
  var r=d.rec, c=r.checks||{};
  var res=SEAL_CHECKS.map(function(k){
    return k+': '+((c[k]||'—').toUpperCase());
  }).join(' · ');
  return (r.time||'—')+' · '+res+(r.lot?' · LOT '+r.lot:'')+(r.initials?' · '+r.initials:'');
}

function updateSealDupHint(){
  var d=findRecentSeal();
  renderDupHint('s-dup-hint', d?dupSealTitle(d):'', d?dupSealDetail(d):'');
}
function renderSealList(){
  document.getElementById('seal-list').innerHTML=SEAL_CHECKS.map(function(chk,i){
    var v=st.sealChecks[chk];
    return '<div class="check-item'+(v==='pass'?' pass':v==='fail'?' fail':'')+'" id="seal-row-'+i+'">' +
      '<span class="check-label">'+chk+'</span>' +
      '<div class="toggle-wrap">' +
        '<button class="tog'+(v==='pass'?' pass-active':'')+'" data-chk="'+chk+'" data-val="pass" onclick="setSeal(this)">PASS</button>' +
        '<button class="tog'+(v==='fail'?' fail-active':'')+'" data-chk="'+chk+'" data-val="fail" onclick="setSeal(this)">FAIL</button>' +
      '</div>' +
    '</div>';
  }).join('');
}
function setSeal(btn){
  var chk=btn.getAttribute('data-chk');
  var val=btn.getAttribute('data-val');
  st.sealChecks[chk]=val;
  renderSealList();
}
function saveSeal(){
  if(!st.line||!st.shift){toast('Select line & shift first');return}
  var d=findRecentSeal();
  if(d){
    showDupModal({title:dupSealTitle(d), detail:dupSealDetail(d),
                  commit:commitSeal, screen:'screen-seal'});
    return;
  }
  commitSeal();
}

function commitSeal(){
  var db=getDB();
  db.seals.push({
    id:Date.now(), date:isoFromDateTime(document.getElementById('s-date').value, document.getElementById('seal-time').value),
    line:st.line, shift:st.shift,
    checks:Object.assign({},st.sealChecks),
    time:document.getElementById('seal-time').value,
    lot:document.getElementById('s-lot').value,
    product:document.getElementById('s-product').value,
    productName: currentProduct ? currentProduct.name : '',
    bagsPerCase: currentProduct ? currentProduct.bagsPerCase : null,
    comments:document.getElementById('s-comments').value,
    initials:document.getElementById('s-initials').value
  });
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('seals', db.seals[db.seals.length-1]);
  var srec = db.seals[db.seals.length-1];
  logActivity('seal','Bag seal record saved',
    'Line '+srec.line+' · '+srec.shift+' shift · LOT: '+(srec.lot||'—')+' · Product: '+(srec.product||'—')+
    dupOverrideNote(),
    srec.initials||(currentUser?currentUser.name:'—'));
  st.sealChecks={};
  renderSealList();
  document.getElementById('s-lot').value='';
  document.getElementById('s-comments').value='';
  document.getElementById('s-initials').value='';
  toast('Seal record saved!');
  updateSealDupHint();
}

