// ===== METAL DETECTOR CHECK =====
function initMetal(){
  document.getElementById('md-date').value = localDateStr();
  if(currentUser) document.getElementById('md-completed').value = currentUser.name;
  renderMetalQuestions();
}

function renderMetalQuestions(){
  document.getElementById('md-questions').innerHTML = MD_QUESTIONS.map(function(q,i){
    var v = metalAnswers[i];
    return '<div class="check-item'+(v==='yes'?' pass':v==='no'?' fail':'')+'">' +
      '<div class="check-label" style="flex:1;padding-right:12px;font-size:13px;line-height:1.4">'+(i+1)+'. '+q+'</div>' +
      '<div class="toggle-wrap">' +
        '<button class="tog'+(v==='yes'?' pass-active':'')+'" data-mi="'+i+'" data-mv="yes" onclick="setMetalItem(this)">YES</button>' +
        '<button class="tog'+(v==='no'?' fail-active':'')+'" data-mi="'+i+'" data-mv="no" onclick="setMetalItem(this)">NO</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setMetalItem(btn){
  metalAnswers[parseInt(btn.getAttribute('data-mi'))] = btn.getAttribute('data-mv');
  renderMetalQuestions();
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
    id: Date.now(), date: document.getElementById('md-date').value,
    line: line,
    startTime: document.getElementById('md-start').value,
    endTime: document.getElementById('md-end').value,
    answers: Object.assign({}, metalAnswers),
    corrective: document.getElementById('md-corrective').value,
    completedBy: document.getElementById('md-completed').value,
    verifiedBy: document.getElementById('md-verified').value
  };
  db.metal.push(rec);
  saveDB(db);
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
