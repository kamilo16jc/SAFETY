// ===== DAILY PRE-OPERATIONAL INSPECTION · 2nd SHIFT (SQF # 11.2.E.A.1, 1945) =====
// Se hace a diario, despues de la limpieza y antes de la siguiente produccion,
// y siempre en el departamento 1945 (PREOP_AREA). Cada dia se guarda un
// registro en db.preop + coleccion Firestore 'preop'. La forma oficial es
// SEMANAL (lunes a sabado): la arma js/integrations/preop-pdf.js.
//
// Un registro ya guardado no se sobreescribe aqui: se corrige en Search, igual
// que las temperaturas.

function initPreop(){
  var d = document.getElementById('po-date');
  // El 2o turno termina despues de medianoche: a la 1:30 AM la fecha por
  // defecto sigue siendo la del dia en que empezo el turno
  if(d && !d.value) d.value = (typeof lotDiaProduccion === 'function') ? lotDiaProduccion(localDateStr(), 2) : localDateStr();
  var c = document.getElementById('po-completed');
  if(c && !c.value && currentUser) c.value = currentUser.name;
  var a = document.getElementById('po-area');
  if(a) a.value = PREOP_AREA;
  renderPreopItems();
  renderPreopWeek();
}

function _poVal(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; }

// Los puntos, en la misma caja de verificaciones que el GMP y el metal
// detector. El 5 se califica de 1 a 10; los demas son si / no / N/A.
function renderPreopItems(){
  var caja = document.getElementById('po-items');
  if(!caja) return;
  caja.innerHTML = PREOP_ITEMS.map(function(item, i){
    var v = preopAnswers[i] || '';
    var control;
    if(i === PREOP_RATE){
      var ops = '<option value="">—</option>';
      for(var n = 10; n >= 1; n--) ops += '<option value="'+n+'"'+(v===String(n)?' selected':'')+'>'+n+'</option>';
      ops += '<option value="na"'+(v==='na'?' selected':'')+'>N/A</option>';
      control = '<select class="field po-rate" aria-label="Rating, 1 to 10" onchange="setPreopRate(this.value)">'+ops+'</select>';
    } else {
      var b = function(val, txt, cls){
        return '<button class="tog'+(v===val?' '+cls:'')+'" data-pi="'+i+'" data-pv="'+val+'" onclick="setPreopItem(this)">'+txt+'</button>';
      };
      control = '<div class="toggle-wrap">'+b('yes','YES','pass-active')+b('no','NO','fail-active')+b('na','N/A','na-active')+'</div>';
    }
    var cls = v==='no' ? ' fail' : (v && v!=='na') ? ' pass' : '';
    return '<div class="check-item'+cls+'">' +
      '<span class="check-label"><b class="chk-n">'+(i+1)+'</b>'+esc(item)+'</span>' + control +
      // lo que no es aceptable lleva su accion: sale en ese renglon de la forma
      (v==='no' ? '<label class="gmp-note-box"><span class="gmp-note-lbl">Observation / corrective action</span>'+
                  '<input type="text" class="ninput gmp-note" placeholder="What was found and what was done" '+
                  'aria-label="Corrective action for item '+(i+1)+'" value="'+esc(preopNotes[i]||'')+'" '+
                  'oninput="preopNotes['+i+']=this.value"></label>' : '') +
    '</div>';
  }).join('');
  preopSummary();
}

function setPreopItem(btn){
  var i = parseInt(btn.getAttribute('data-pi'));
  preopAnswers[i] = btn.getAttribute('data-pv');
  if(preopAnswers[i] !== 'no') delete preopNotes[i];
  renderPreopItems();
  if(preopAnswers[i] === 'no'){
    var n = document.querySelector('#po-items .check-item:nth-child('+(i+1)+') .gmp-note');
    if(n) n.focus();
  }
}
function setPreopRate(v){
  if(v) preopAnswers[PREOP_RATE] = v; else delete preopAnswers[PREOP_RATE];
  renderPreopItems();
}

// Cuantos van, cuantos no son aceptables y la calificacion del punto 5
function preopSummary(){
  var hechas = 0, malas = 0;
  PREOP_ITEMS.forEach(function(_, i){
    if(preopAnswers[i]) hechas++;
    if(preopAnswers[i] === 'no') malas++;
  });
  var set = function(id, txt, cls){ var e = document.getElementById(id); if(e){ e.textContent = txt; e.className = 'ns-v' + (cls ? ' '+cls : ''); } };
  set('po-done', hechas + ' / ' + PREOP_ITEMS.length, hechas === PREOP_ITEMS.length ? 'ok' : '');
  set('po-no', String(malas), malas ? 'bad' : hechas ? 'ok' : '');
  var r = preopAnswers[PREOP_RATE];
  set('po-rate', r ? (r === 'na' ? 'N/A' : r + ' / 10') : '—', '');
  var n = document.getElementById('po-count');
  if(n) n.textContent = hechas ? hechas + ' of ' + PREOP_ITEMS.length + ' answered' : '';

  var caja = document.getElementById('po-outmsg');
  if(caja){
    var t = document.getElementById('po-outmsg-text');
    caja.classList.toggle('show', !!malas);
    if(malas && t) t.textContent = malas === 1
      ? '1 item not acceptable — write the corrective action before saving'
      : malas + ' items not acceptable — write the corrective action before saving';
  }
}

// Solo las acciones de los puntos que siguen en "No", sin espacios sobrantes
function preopNotasLimpias(){
  var out = {};
  Object.keys(preopNotes).forEach(function(k){
    var t = String(preopNotes[k] || '').trim();
    if(t && preopAnswers[k] === 'no') out[k] = t;
  });
  return out;
}

function clearPreop(){
  preopAnswers = {};
  preopNotes = {};
  var c = document.getElementById('po-comments'); if(c) c.value = '';
  renderPreopItems();
  toast('Answers cleared');
}

// ---- La semana: que dias ya estan y cuales faltan ----
function renderPreopWeek(){
  var el = document.getElementById('po-week');
  if(!el) return;
  var fecha = _poVal('po-date');
  if(!fecha){ el.innerHTML = ''; return; }
  var lunes = preopLunes(fecha);
  var recs = getDB().preop || [];
  el.innerHTML = '<div class="po-week">' + PREOP_DIAS.map(function(d, j){
    var iso = lotMasDias(lunes, j);
    var r = recs.filter(function(x){ return String(x.date || '').slice(0,10) === iso; })[0];
    var malas = r ? PREOP_ITEMS.filter(function(_, i){ return (r.answers || {})[i] === 'no'; }).length : 0;
    var cls = !r ? '' : malas ? ' bad' : ' ok';
    return '<div class="po-day'+cls+(iso === fecha ? ' on' : '')+'" title="'+pdfFecha(iso)+'">'+
      '<span class="po-d">'+d.label+'</span>'+
      '<span class="po-s">'+(!r ? '—' : malas ? malas+' NO' : '✓')+'</span></div>';
  }).join('') + '</div>' +
  '<div class="ncard-sub">Week of '+pdfFecha(lunes)+' · '+esc(PREOP_AREA)+'</div>';
}

// Ya hay inspeccion de ese dia
function preopExistente(fecha){
  return (getDB().preop || []).filter(function(r){ return String(r.date || '').slice(0,10) === fecha; })[0] || null;
}

// Corregir una inspeccion ya guardada se hace en Search
function preopOpenInSearch(fecha){
  if(typeof closeDupModal === 'function') closeDupModal();
  openTodayLog('preop', fecha || _poVal('po-date'));
}

function savePreop(){
  var fecha = _poVal('po-date'), area = PREOP_AREA;
  if(!fecha){ toast('Select the date'); return; }
  var hechas = PREOP_ITEMS.filter(function(_, i){ return preopAnswers[i]; }).length;
  if(hechas < PREOP_ITEMS.length){ toast('Answer all ' + PREOP_ITEMS.length + ' items (use N/A if it does not apply)'); return; }
  var notas = preopNotasLimpias();
  var sinNota = PREOP_ITEMS.filter(function(_, i){ return preopAnswers[i] === 'no' && !notas[i]; }).length;
  if(sinNota){ toast('Write the corrective action for every item not acceptable'); return; }

  var ya = preopExistente(fecha);
  if(ya){
    showGuardModal({
      title: 'Pre-Op is already recorded on ' + pdfFecha(fecha),
      detail: 'Completed by ' + (ya.completedBy || '—'),
      ask: 'Check the date. To correct the saved inspection, open it in Search.',
      primaryLabel: 'Change the date', onPrimary: closeDupModal,
      secondaryLabel: 'Correct it in Search', onSecondary: function(){ preopOpenInSearch(fecha); }
    });
    return;
  }
  if(preopDiaCol(fecha) < 0 &&
     !confirm('This date is a Sunday. The weekly form only has Monday to Saturday, so this inspection will not appear on it. Save anyway?')) return;

  var db = getDB();
  if(!db.preop) db.preop = [];
  var rec = {
    id: newRecordId(), date: fecha, shift: 2, area: area,
    answers: Object.assign({}, preopAnswers), notes: notas,
    comments: _poVal('po-comments'),
    completedBy: _poVal('po-completed'), verifiedBy: _poVal('po-verified'),
    createdBy: currentUser ? currentUser.name : '—', createdAt: localISOStr()
  };
  db.preop.push(rec);
  saveDB(db, 'preop');
  cbtnSaved('po-save-btn');
  if(window.saveToFirebase) window.saveToFirebase('preop', rec);

  var malas = PREOP_ITEMS.filter(function(_, i){ return rec.answers[i] === 'no'; }).length;
  logActivity('preop', 'Pre-Op inspection saved',
    fecha + ' · ' + (malas ? malas + ' item(s) not acceptable' : 'all acceptable'),
    rec.completedBy || (currentUser ? currentUser.name : '—'));
  if(typeof playAlert === 'function') playAlert(malas ? 'fail' : 'pass');

  // La fecha y quien la hizo se quedan: la siguiente suele ser de la misma
  // persona. Las respuestas y las iniciales de QA vuelven a empezar.
  preopAnswers = {}; preopNotes = {};
  ['po-comments', 'po-verified'].forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
  renderPreopItems();
  renderPreopWeek();
  toast('Pre-Op inspection saved');
}
