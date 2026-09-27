// ===== YEAST & MOLD =====
// Segundo paso del laboratorio. La placa se siembra con la muestra y se lee
// CINCO DIAS despues, asi que esta pantalla no crea registros: arrastra los
// que ya se capturaron en Sample Analysis (Moisture / Fat / pH) y solo deja
// escribir el conteo de yeast y de mold. Todo lo demas —producto, queso,
// cliente, orden— viene de alla y no se toca aqui.
//
// A todos los productos se les hace placa, menos a los que en Products estan
// marcados sin placa o sin muestra de laboratorio: esos ni aparecen.
var YM_DAYS = 5;
var ymView = 'ready';        // ready | waiting | done | all
var ymFrom = '', ymTo = '', ymQuery = '';

function initYeast(){
  var f = document.getElementById('ym-from');
  if(f && !f.value){
    var d = new Date(); d.setDate(d.getDate() - 30);
    f.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  var t = document.getElementById('ym-to');
  if(t && !t.value) t.value = localDateStr();
  ymView = 'ready';
  ymDirty = false; renderYmDirty();
  showDateOrder(document.getElementById('screen-yeast'));
  echoDateRange('ym-date-echo','ym-from','ym-to');
  renderYeast();
}

// ---- Fechas: la lectura cae a los 5 dias de tomada la muestra ----
// La placa se lee a los 5 dias, pero el domingo no se lee: si cae domingo,
// pasa al lunes.
function ymDueDate(a){
  var d = new Date(String(a.date||'').slice(0,10)+'T12:00:00');
  if(isNaN(d)) return '';
  d.setDate(d.getDate() + YM_DAYS);
  if(d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ymDaysLeft(a){
  var due = ymDueDate(a);
  if(!due) return 0;
  var ms = new Date(due+'T12:00:00') - new Date(localDateStr()+'T12:00:00');
  return Math.round(ms / 86400000);
}
function ymHas(v){ return v!=null && String(v).trim()!==''; }
function ymDone(a){ return ymHas(a.yeast) && ymHas(a.mold); }
function ymState(a){
  if(ymDone(a)) return 'done';
  return ymDaysLeft(a) <= 0 ? 'ready' : 'waiting';
}

// ¿A este producto se le hace placa?
function ymPlate(number){
  var p = (typeof findProduct==='function') ? findProduct(number) : null;
  if(!p) return true;                        // si no esta en el catalogo, se asume que si
  if(p.plate === false) return false;        // marcado "sin placa" en Products
  if(typeof productSampleCount==='function' && productSampleCount(p)===0) return false;
  return true;                               // el resto lleva placa
}

// ---- Filtros ----
var ymDirty = false;
function markYmDirty(){
  echoDateRange('ym-date-echo','ym-from','ym-to');
  if(ymDirty) return;
  ymDirty = true;
  renderYmDirty();
}
function renderYmDirty(){
  var el = document.getElementById('ym-dirty');
  if(el) el.style.display = ymDirty ? 'block' : 'none';
  var b = document.getElementById('ym-go');
  if(b) b.classList.toggle('pending', ymDirty);
}
// El boton es el que manda: la fecha puede pedir historial a Firestore
function applyYmFilters(){
  ymDirty = false; renderYmDirty();
  var f = document.getElementById('ym-from');
  var from = f ? f.value : '';
  if(from && window.loadHistory){ window.loadHistory(from, renderYeast); return; }
  renderYeast();
}
function setYmView(v){ ymView = v; renderYeast(); }
function ymOnKey(e){ if(e.key==='Enter') applyYmFilters(); }

function ymRows(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value : ''; };
  ymFrom = g('ym-from'); ymTo = g('ym-to');
  ymQuery = (g('ym-search')||'').trim().toLowerCase();

  return (typeof getAnalyses==='function' ? getAnalyses() : []).filter(function(a){
    if(!ymPlate(a.product)) return false;
    var d = String(a.date||'').slice(0,10);
    if(ymFrom && d < ymFrom) return false;
    if(ymTo   && d > ymTo)   return false;
    if(ymQuery){
      var hay = (String(a.product||'')+' '+String(a.cheese||'')+' '+String(a.customer||'')+' '+
                 String(a.order||'')+' '+String(a.po||'')+' '+String(a.prodDate||'')+' '+
                 '#'+String(a.seq||'')).toLowerCase();
      if(hay.indexOf(ymQuery) < 0) return false;
    }
    return true;
  }).sort(function(a,b){
    // Lo que ya se puede leer va primero, y dentro de eso lo mas viejo
    var sa = ymState(a), sb = ymState(b);
    var rank = {ready:0, waiting:1, done:2};
    return (rank[sa]-rank[sb]) || String(a.date).localeCompare(String(b.date));
  });
}

function renderYeast(){
  var host = document.getElementById('ym-sheet');
  if(!host) return;
  var all = ymRows();

  var kp = document.getElementById('ym-kpis');
  if(kp){
    var n = function(k){ return k==='all' ? all.length
      : all.filter(function(a){ return ymState(a)===k; }).length; };
    kp.innerHTML = [
      ['ready',   n('ready'),   'ready to read', 'var(--fail)'],
      ['waiting', n('waiting'), 'still incubating', 'var(--dim)'],
      ['done',    n('done'),    'read', 'var(--pass)'],
      ['all',     all.length,   'plates in range', '']
    ].map(function(k){
      return '<button class="kpi'+(ymView===k[0]?' on':'')+'" onclick="setYmView(\''+k[0]+'\')">'+
        '<b>'+k[1]+'</b><span>'+
        (k[3] ? '<i class="dot" style="background:'+k[3]+'"></i>' : '')+k[2]+'</span></button>';
    }).join('');
  }

  var list = all.filter(function(a){ return ymView==='all' || ymState(a)===ymView; });

  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (all.length ? 'Nothing in this view for the dates selected.'
                  : 'No plates in range. A plate shows up here as soon as its Moisture / Fat / pH '+
                    'are captured in Sample Analysis, and can be read '+YM_DAYS+' days later.')+
      '</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>ID</th><th>Sampled</th><th>Reads on</th><th>Status</th>'+
      '<th>Product</th><th class="wide">Cheese</th><th>Customer</th><th>Prod. date</th><th>Order</th>'+
      '<th class="num">Yeast</th><th class="num">Mold</th><th>Read by</th><th>Save</th>'+
    '</tr></thead><tbody>'+
    list.map(function(a, i){ return ymRowHTML(a, i+1); }).join('')+
    '</tbody></table></div>';
}

function ymRowHTML(a, i){
  var cell = function(field, val){
    return '<input class="cell num" inputmode="decimal" placeholder="CFU/g" data-f="'+field+'" '+
      'value="'+esc(val==null?'':val)+'" '+
      'onchange="setYM('+a.id+',\''+field+'\',this.value)">';
  };
  return '<tr>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">#'+esc(a.seq||'—')+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td class="soft">'+esc(fmtDate(ymDueDate(a)))+'</td>'+
    '<td id="ym-st-'+a.id+'">'+ymStatusHTML(a)+'</td>'+
    '<td class="code">'+esc(a.product||'—')+'</td>'+
    '<td class="wide">'+esc(a.cheese||'—')+'</td>'+
    '<td class="soft">'+esc(a.customer||'—')+'</td>'+
    '<td class="soft">'+esc(a.prodDate||'—')+'</td>'+
    '<td class="soft">'+esc(a.order||'—')+'</td>'+
    '<td class="num">'+cell('yeast', a.yeast)+'</td>'+
    '<td class="num">'+cell('mold',  a.mold)+'</td>'+
    '<td class="soft" id="ym-by-'+a.id+'">'+esc(a.ymBy || '')+'</td>'+
    '<td><button class="sheet-btn" onclick="saveYmRow('+a.id+',this)">Save</button></td>'+
  '</tr>';
}

function ymStatusHTML(a){
  var st = ymState(a);
  if(st==='done'){
    return '<span class="pill ok">Read'+(a.ymAt ? ' · '+esc(fmtDate(a.ymAt)) : '')+'</span>';
  }
  // Mientras no este leida, la placa esta PENDIENTE; al lado, por que
  var left = ymDaysLeft(a);
  if(st==='ready'){
    return '<span class="pill bad">Pending'+
      (left<0 ? ' · '+Math.abs(left)+'d late' : ' · read today')+'</span>';
  }
  return '<span class="pill">Pending · '+left+' day'+(left===1?'':'s')+' left</span>';
}

// Guarda una celda. NO repinta la tabla entera: si lo hiciera, al pasar de
// Yeast a Mold se perderia el foco a media escritura. Solo se actualizan el
// estado de esa fila y los conteos de arriba.
function setYM(id, field, value){
  var db = getDB();
  var a = (db.analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(!a) return;
  var before = ymDone(a);
  var nv = String(value==null?'':value).trim();
  if(typeof logAnalysisChange==='function') logAnalysisChange(a, field, a[field], nv);
  a[field] = nv;
  if(ymDone(a)){
    if(!a.ymAt) a.ymAt = localISOStr();
    if(!a.ymBy && currentUser && typeof getInitials==='function') a.ymBy = getInitials();
  }
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('analysis', a);

  if(!before && ymDone(a)){
    logActivity('analysis','Yeast & mold plate read',
      'Analysis #'+(a.seq||'—')+' · Product '+(a.product||'—')+
      ' · Yeast '+(a.yeast||'—')+' · Mold '+(a.mold||'—'),
      a.ymBy || (currentUser?currentUser.name:'—'));
  }

  var cellEl = document.getElementById('ym-st-'+a.id);
  if(cellEl) cellEl.innerHTML = ymStatusHTML(a);
  var byEl = document.getElementById('ym-by-'+a.id);
  if(byEl) byEl.textContent = a.ymBy || '';
  ymRefreshCounts();
}

// Guarda la lectura de la placa completa, a la vista
function saveYmRow(id, btn){
  var vals = readRowFields(btn);
  if(!vals) return;
  var before = false;
  var a0 = (getDB().analysis||[]).filter(function(x){ return x.id===id; })[0];
  if(a0) before = ymDone(a0);
  var a = (typeof saveAnalysisFields==='function') ? saveAnalysisFields(id, vals) : null;
  if(a){
    if(ymDone(a)){
      var db = getDB();
      var rec = (db.analysis||[]).filter(function(x){ return x.id===id; })[0];
      if(rec){
        if(!rec.ymAt) rec.ymAt = localISOStr();
        if(!rec.ymBy && currentUser && typeof getInitials==='function') rec.ymBy = getInitials();
        saveDB(db);
        if(window.saveToFirebase) window.saveToFirebase('analysis', rec);
        a = rec;
      }
    }
    if(!before && ymDone(a)){
      logActivity('analysis','Yeast & mold plate read',
        'Analysis #'+(a.seq||'\u2014')+' \u00b7 Product '+(a.product||'\u2014')+
        ' \u00b7 Yeast '+(a.yeast||'\u2014')+' \u00b7 Mold '+(a.mold||'\u2014'),
        a.ymBy || (currentUser?currentUser.name:'\u2014'));
    }
    var cellEl = document.getElementById('ym-st-'+id);
    if(cellEl) cellEl.innerHTML = ymStatusHTML(a);
    var byEl = document.getElementById('ym-by-'+id);
    if(byEl) byEl.textContent = a.ymBy || '';
  }
  ymRefreshCounts();
  flashSaved(btn);
}

// Repinta solo los conteos del menu, sin tocar la tabla
function ymRefreshCounts(){
  var kp = document.getElementById('ym-kpis');
  if(!kp) return;
  var all = ymRows();
  var vals = {
    ready:   all.filter(function(a){ return ymState(a)==='ready'; }).length,
    waiting: all.filter(function(a){ return ymState(a)==='waiting'; }).length,
    done:    all.filter(function(a){ return ymState(a)==='done'; }).length,
    all:     all.length
  };
  ['ready','waiting','done','all'].forEach(function(k, i){
    var b = kp.children[i];
    if(b) b.querySelector('b').textContent = vals[k];
  });
}

// ---- Exportar la hoja tal como se ve ----
function exportYeastCSV(){
  var list = ymRows().filter(function(a){ return ymView==='all' || ymState(a)===ymView; });
  if(!list.length){ toast('Nothing to export for this view'); return; }
  var out = [['ID','Sampled','Reads on','Status','Product','Cheese','Customer',
              'Prod. date','Order','Yeast','Mold','Read by','Read on']];
  list.forEach(function(a){
    out.push([a.seq||'', String(a.date||'').slice(0,10), ymDueDate(a),
      {ready:'Ready to read', waiting:'Incubating', done:'Read'}[ymState(a)],
      a.product||'', a.cheese||'', a.customer||'', a.prodDate||'', a.order||'',
      a.yeast||'', a.mold||'', a.ymBy||'', String(a.ymAt||'').slice(0,10)]);
  });
  downloadCSV('yeast-mold-'+localDateStr()+'.csv', out);
}
