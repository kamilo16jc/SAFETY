// ===== SEAL =====
function initSeal(){
  document.getElementById('sm-line').textContent=st.line||'—';
  document.getElementById('sm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  setSealNow();
  renderSealList();
  if(currentUser) document.getElementById('s-initials').value = getInitials();
}
function setSealNow(){
  var now=new Date();
  document.getElementById('seal-time').value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
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
  var db=getDB();
  db.seals.push({
    id:Date.now(), date:localISOStr(),
    line:st.line, shift:st.shift,
    checks:Object.assign({},st.sealChecks),
    time:document.getElementById('seal-time').value,
    lot:document.getElementById('s-lot').value,
    product:document.getElementById('s-product').value,
    comments:document.getElementById('s-comments').value,
    initials:document.getElementById('s-initials').value
  });
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('seals', db.seals[db.seals.length-1]);
  var srec = db.seals[db.seals.length-1];
  logActivity('seal','Bag seal record saved',
    'Line '+srec.line+' · '+srec.shift+' shift · LOT: '+(srec.lot||'—')+' · Product: '+(srec.product||'—'),
    srec.initials||(currentUser?currentUser.name:'—'));
  st.sealChecks={};
  renderSealList();
  document.getElementById('s-lot').value='';
  document.getElementById('s-product').value='';
  document.getElementById('s-comments').value='';
  document.getElementById('s-initials').value='';
  toast('Seal record saved!');
}

