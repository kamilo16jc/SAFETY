// ===== SEAL =====
function initSeal(){
  document.getElementById('sm-line').textContent=st.line||'—';
  document.getElementById('sm-shift').textContent=st.shift?(st.shift===1?'1st':'2nd'):'—';
  var sd=document.getElementById('s-date');
  if(sd){ sd.value=localDateStr(); sd.onchange=updateSealDupHint; }
  var stime=document.getElementById('seal-time'); if(stime) stime.onchange=updateSealDupHint;
  setSealNow();
  if(!st.shift) selectShift(expectedShift());   // turno por defecto según la hora
  renderSealList();
  renderSealToday();
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
  sealSummary();
}

// Como va la hoja: cuantas revisiones llevas y cuales fallaron. Lo mismo que
// en Weight Log, por el mismo motivo: que el estado se lea sin contar a mano.
function sealSummary(){
  var hechas  = SEAL_CHECKS.filter(function(c){ return st.sealChecks[c]; });
  var fallan  = SEAL_CHECKS.filter(function(c){ return st.sealChecks[c] === 'fail'; });

  var d = document.getElementById('s-done');
  if(d){
    d.textContent = hechas.length + ' / ' + SEAL_CHECKS.length;
    d.className = 'ns-v' + (hechas.length === SEAL_CHECKS.length ? ' ok' : '');
  }
  var f = document.getElementById('s-failed');
  if(f){
    f.textContent = String(fallan.length);
    f.className = 'ns-v' + (fallan.length ? ' bad' : (hechas.length ? ' ok' : ''));
  }

  var caja = document.getElementById('s-outmsg');
  if(!caja) return;
  var txt = document.getElementById('s-outmsg-text');
  if(fallan.length && txt){
    // Con tres revisiones, decir cual fallo sirve mas que decir cuantas
    txt.textContent = (fallan.length === 1 ? fallan[0] + ' failed.'
                                           : fallan.length + ' checks failed.') +
                      ' Add a corrective action in Comments.';
  }
  caja.classList.toggle('show', fallan.length > 0);
}

// Lo revisado hoy, lo ultimo arriba. No es un informe: es lo justo para no
// repetir una linea ni olvidarse de otra.
var SEAL_HOY_MAX = 8;

function renderSealToday(){
  var host = document.getElementById('seal-today');
  if(!host) return;
  var hoy = localDateStr();
  var todas = (getDB().seals || []).filter(function(r){
    return String(r.date || '').slice(0, 10) === hoy;
  }).sort(function(a, b){
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  if(!todas.length){
    host.innerHTML = '<div class="dl-empty">No bag seal checks recorded today.</div>';
    return;
  }

  var list = todas.slice(0, SEAL_HOY_MAX);
  host.innerHTML =
    '<div class="daylist">'+
      '<div class="dl-row dl-head"><span>Time</span><span>Line</span>'+
        '<span>LOT</span><span>Result</span></div>'+
      list.map(sealTodayRow).join('')+
    '</div>'+
    (todas.length > list.length
      ? '<div class="dl-more">Showing the last '+list.length+' of '+todas.length+' today.</div>'
      : '');
}

function sealTodayRow(r){
  var c = r.checks || {};
  var fallan = SEAL_CHECKS.filter(function(k){ return c[k] === 'fail'; });
  var hechas = SEAL_CHECKS.filter(function(k){ return c[k]; }).length;
  var etiqueta, clase;
  if(fallan.length){
    // Con una sola, el nombre dice mas que el numero
    etiqueta = (fallan.length === 1) ? fallan[0] : fallan.length + ' failed';
    clase = 'bad';
  } else if(hechas === SEAL_CHECKS.length){
    etiqueta = 'All pass';
    clase = 'ok';
  } else {
    etiqueta = hechas + ' / ' + SEAL_CHECKS.length;
    clase = '';
  }
  return '<div class="dl-row">'+
    '<span class="dl-t">'+esc(r.time || '\u2014')+'</span>'+
    '<span>Line '+esc(String(r.line || '\u2014'))+'</span>'+
    '<span class="dl-soft">'+esc(r.lot || r.product || '\u2014')+'</span>'+
    '<span class="dl-badge '+clase+'">'+esc(etiqueta)+'</span>'+
  '</div>';
}

// Vaciar las revisiones sin tocar el resto del registro: la linea cambia de
// producto y se vuelve a revisar, pero el lote y la hora siguen siendo los
// mismos.
function clearSealChecks(){
  st.sealChecks = {};
  renderSealList();
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
    id:newRecordId(), date:isoFromDateTime(document.getElementById('s-date').value, document.getElementById('seal-time').value),
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
  saveDB(db,'seals');
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
  clearProductSelection('seal');
  document.getElementById('s-initials').value='';
  renderSealToday();
  toast('Seal record saved!');
  updateSealDupHint();
}

