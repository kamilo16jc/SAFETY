// ===== METAL DETECTOR CHECK =====
function initMetal(){
  document.getElementById('md-date').value = localDateStr();
  if(currentUser) document.getElementById('md-completed').value = currentUser.name;
  renderMetalQuestions();
}

// Las preguntas conservan su numero: en esta hoja el orden importa y asi se
// sigue leyendo igual que en el papel.
function renderMetalQuestions(){
  document.getElementById('md-questions').innerHTML = MD_QUESTIONS.map(function(q,i){
    var v = metalAnswers[i];
    return '<div class="check-item'+(v==='yes'?' pass':v==='no'?' fail':'')+'">' +
      '<span class="check-label"><b class="chk-n">'+(i+1)+'</b>'+esc(q)+'</span>' +
      '<div class="toggle-wrap">' +
        '<button class="tog'+(v==='yes'?' pass-active':'')+'" data-mi="'+i+'" data-mv="yes" onclick="setMetalItem(this)">YES</button>' +
        '<button class="tog'+(v==='no'?' fail-active':'')+'" data-mi="'+i+'" data-mv="no" onclick="setMetalItem(this)">NO</button>' +
      '</div>' +
    '</div>';
  }).join('');
  metalSummary();
}

// Cuantas van y cuantas salieron que no. Son nueve preguntas: sin esto se
// guarda con una sin contestar y el aviso llega al pulsar, no antes.
function metalSummary(){
  var hechas = 0, malas = 0;
  MD_QUESTIONS.forEach(function(_,i){
    if(metalAnswers[i]) hechas++;
    if(metalAnswers[i] === 'no') malas++;
  });
  var d = document.getElementById('md-done');
  if(d){
    d.textContent = hechas + ' / ' + MD_QUESTIONS.length;
    d.className = 'ns-v' + (hechas === MD_QUESTIONS.length ? ' ok' : '');
  }
  var f = document.getElementById('md-no');
  if(f){
    f.textContent = malas;
    f.className = 'ns-v' + (malas ? ' bad' : hechas ? ' ok' : '');
  }
  var n = document.getElementById('md-count');
  if(n) n.textContent = hechas ? hechas + ' of ' + MD_QUESTIONS.length + ' answered' : '';

  var caja = document.getElementById('md-outmsg');
  if(caja){
    var t = document.getElementById('md-outmsg-text');
    if(malas){
      caja.classList.add('show');
      if(t) t.textContent = malas === 1
        ? '1 question answered no \u2014 write the corrective action before saving'
        : malas + ' questions answered no \u2014 write the corrective action before saving';
    } else {
      caja.classList.remove('show');
    }
  }
}

function setMetalItem(btn){
  metalAnswers[parseInt(btn.getAttribute('data-mi'))] = btn.getAttribute('data-mv');
  renderMetalQuestions();
}

// Dejar la hoja en blanco sin salir de la pantalla
function clearMetal(){
  metalAnswers = {};
  renderMetalQuestions();
  var c = document.getElementById('md-corrective'); if(c) c.value = '';
  toast('Answers cleared');
}

function setMdNow(id){
  var d = new Date();
  document.getElementById(id).value = ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
}

function saveMetal(){
  var line = document.getElementById('md-line').value.trim();
  if(!line){ toast('Enter Line and Metal Detector'); return; }
  var answered = Object.keys(metalAnswers).length;
  if(answered < MD_QUESTIONS.length){ toast('Answer all '+MD_QUESTIONS.length+' questions'); return; }

  var db = getDB();
  if(!db.metal) db.metal = [];
  var rec = {
    id: newRecordId(), date: document.getElementById('md-date').value,
    line: line,
    startTime: document.getElementById('md-start').value,
    endTime: document.getElementById('md-end').value,
    answers: Object.assign({}, metalAnswers),
    corrective: document.getElementById('md-corrective').value,
    completedBy: document.getElementById('md-completed').value,
    verifiedBy: document.getElementById('md-verified').value
  };
  db.metal.push(rec);
  saveDB(db,'metal');
  cbtnSaved('md-save-btn');
  if(window.saveToFirebase) window.saveToFirebase('metal', rec);

  var fails = MD_QUESTIONS.filter(function(q,i){ return metalAnswers[i]==='no'; }).length;
  logActivity('metal','Metal detector check saved',
    'Line/MD: '+line+' · '+(fails? fails+' item(s) NO':'all pass'),
    rec.completedBy||(currentUser?currentUser.name:'—'));
  if(fails) playAlert('fail'); else playAlert('pass');

  metalAnswers = {};
  document.getElementById('md-line').value = '';
  document.getElementById('md-start').value = '';
  document.getElementById('md-end').value = '';
  document.getElementById('md-corrective').value = '';
  document.getElementById('md-verified').value = '';
  renderMetalQuestions();
  toast('Metal detector check saved!');
}
