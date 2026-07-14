// ===== POWER AUTOMATE — OFFICIAL FORMS =====
// Firebase remains the data store. This module only sends form-fill
// requests to a Power Automate HTTP flow when the user explicitly asks
// for an official Excel/Word form (Reports screen). Requests are queued
// locally and retried if the device is offline.

function paGetUrl(){ return localStorage.getItem('safety_flow_url') || ''; }
function paSetUrl(u){ localStorage.setItem('safety_flow_url', (u||'').trim()); }
function paQueue(){ try{ return JSON.parse(localStorage.getItem('safety_pa_queue')||'[]'); }catch(e){ return []; } }
function paSaveQueue(q){ localStorage.setItem('safety_pa_queue', JSON.stringify(q)); }

function paSendForm(formType, data){
  var url = paGetUrl();
  if(!url){ toast('Set the Power Automate URL in Admin first'); return; }
  var payload = {
    source: 'SAFETY',
    client: 'Caputo Foods',
    formType: formType,
    requestedBy: (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '',
    sentAt: new Date().toISOString(),
    data: data
  };
  var q = paQueue(); q.push(payload); paSaveQueue(q);
  logActivity('form', 'Official form requested', formType + ' · ' + (data.date||''), payload.requestedBy);
  paFlush();
}

function paFlush(){
  var url = paGetUrl();
  var q = paQueue();
  if(!url || !q.length) return;
  if(!navigator.onLine){ toast('Offline — request queued ('+q.length+' pending)'); paRefreshStatus(); return; }
  var item = q[0];
  // mode no-cors: el trigger HTTP de Power Automate no responde preflights CORS,
  // asi que la respuesta es opaca. La confirmacion real se ve en el
  // historial de ejecuciones del flow.
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {'Content-Type': 'text/plain;charset=UTF-8'},
    body: JSON.stringify(item)
  }).then(function(){
    var q2 = paQueue(); q2.shift(); paSaveQueue(q2);
    toast('Form request sent ✓');
    paRefreshStatus();
    if(q2.length) setTimeout(paFlush, 800);
  }).catch(function(){
    toast('Send failed — kept in queue');
    paRefreshStatus();
  });
}
window.addEventListener('online', function(){ if(paQueue().length) paFlush(); });

// ---- Form builders: package the filtered data each official form needs ----

// SQF 2.4.D.1.1 — Weight Monitoring & LeakPointer log (Word)
function sendWeightSealForm(){
  if(!rptWeightResults.length && !rptSealResults.length){ toast('No records for the selected filters'); return; }
  var db = getDB();
  var temps = (db.temps||[]).filter(function(t){ return !rptFilters.date || (t.date||'').startsWith(rptFilters.date); });

  // Campos pre-calculados para que el mapeo del Word template sea directo
  var weights = rptWeightResults.map(function(r){
    var sum = (r.vals||[]).reduce(function(a,b){ return a + (parseFloat(b)||0); }, 0);
    return Object.assign({}, r, {
      sum:  Math.round(sum*100)/100,
      avgR: Math.round((r.avg||0)*100)/100
    });
  });
  var mark = function(v){ return v==='pass' ? 'PASS' : v==='fail' ? 'FAIL' : ''; };
  var seals = rptSealResults.map(function(r){
    var c = r.checks||{};
    return Object.assign({}, r, {
      visual: mark(c['Visual']), dunk: mark(c['Dunk Tank']), printing: mark(c['Printing'])
    });
  });
  var notes = rptWeightResults.concat(rptSealResults)
    .map(function(r){ return (r.comments||'').trim(); })
    .filter(function(x){ return x; })
    .join(' · ');

  var payload = {
    date: rptFilters.date, line: rptFilters.line, shift: rptFilters.shift,
    shiftLabel: rptFilters.shift==='1' ? '1st' : rptFilters.shift==='2' ? '2nd' : '',
    lineLabel: rptFilters.line==='all' ? '' : rptFilters.line,
    notes: notes,
    weights: weights, seals: seals, temps: temps
  };

  // Rellena el Word en el navegador y lo descarga en el PC (sin flow, sin premium).
  toast('Building form...');
  downloadWeightDoc(payload).then(function(filename){
    toast('Downloaded: ' + filename);
    logActivity('form', 'Official form generated', filename, (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : '');
  }).catch(function(e){
    console.error('downloadWeightDoc:', e);
    toast('Could not build the form: ' + e.message);
  });
}

// SQF 2.5.D.A — Daily GMP Facility Audit (Excel/Word)
function sendGmpForm(){
  if(!rptGmpResults.length){ toast('No GMP audits for the selected date'); return; }
  paSendForm('gmp', { date: rptFilters.date, gmps: rptGmpResults });
}

// ---- Admin panel ----
function paSaveUrlFromAdmin(){
  var v = document.getElementById('pa-url').value.trim();
  if(v && v.indexOf('https://') !== 0){ toast('URL must start with https://'); return; }
  paSetUrl(v);
  toast(v ? 'Flow URL saved ✓' : 'Flow URL cleared');
  paRefreshStatus();
}

function paTest(){
  var url = paGetUrl();
  if(!url){ toast('Save the flow URL first'); return; }
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {'Content-Type': 'text/plain;charset=UTF-8'},
    body: JSON.stringify({
      source:'SAFETY', client:'Caputo Foods', formType:'test',
      requestedBy:(typeof currentUser!=='undefined' && currentUser)?currentUser.name:'',
      sentAt:new Date().toISOString(),
      data:{ message:'Connection test from SAFETY app' }
    })
  }).then(function(){ toast('Test sent — check the flow run history'); })
    .catch(function(){ toast('Could not reach the flow URL'); });
}

function paClearQueue(){
  if(!confirm('Discard '+paQueue().length+' pending form request(s)?')) return;
  paSaveQueue([]);
  paRefreshStatus();
  toast('Queue cleared');
}

function paRefreshStatus(){
  var el = document.getElementById('pa-status');
  if(!el) return;
  var url = paGetUrl(); var q = paQueue();
  var txt = url ? 'Flow URL configured ✓' : 'No flow URL configured';
  if(q.length) txt += ' · ' + q.length + ' request(s) pending — will retry when online';
  el.textContent = txt;
}
