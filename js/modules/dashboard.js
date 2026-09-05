// ===== DASHBOARD =====
// Analítica sobre pesos, bag seal, GMP, temperaturas, metal detector y holds,
// con filtros de periodo, producto, línea y turno.
var dashDays = 30;
var dashReady = false;
var dashF = {from:'', to:'', product:'all', line:'all', shift:'all'};

function dashQuickRange(days, btn){
  dashDays = days;
  document.querySelectorAll('[data-dashrange]').forEach(function(b){ b.classList.remove('selected'); });
  if(btn) btn.classList.add('selected');
  var to = localDateStr(), from = '';
  if(days){
    var d = new Date(); d.setDate(d.getDate()-days+1);
    from = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  var f=document.getElementById('dash-from'), t=document.getElementById('dash-to');
  if(f) f.value = from;
  if(t) t.value = days ? to : '';
  initDash();
}

function readDashFilters(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  dashF.from = g('dash-from'); dashF.to = g('dash-to');
  dashF.product = g('dash-product')||'all';
  dashF.line = g('dash-line')||'all';
  dashF.shift = g('dash-shift')||'all';
}

function dashInRange(iso){
  var d = String(iso||'').slice(0,10);
  if(!d) return false;
  if(dashF.from && d < dashF.from) return false;
  if(dashF.to   && d > dashF.to)   return false;
  return true;
}

// Filtro común para pesos y sellos
function dashKeep(r){
  if(!dashInRange(r.date)) return false;
  if(dashF.line!=='all'  && String(r.line||'')  !== dashF.line)  return false;
  if(dashF.shift!=='all' && String(r.shift||'') !== dashF.shift) return false;
  if(dashF.product!=='all' && String(r.product||'') !== dashF.product) return false;
  return true;
}

function filterByDays(records){          // lo usan los export
  return (records||[]).filter(function(r){ return dashInRange(r.date); });
}

function mkBar(pct, color){
  return '<div class="dbar"><div class="dbar-fill" style="width:'+Math.min(pct,100)+'%;background:'+(color||'var(--accent)')+'"></div></div>';
}

function pctOf(n,d){ return d ? Math.round((n/d)*100) : 0; }
function compClass(p){ return p>=90?'ok':p>=80?'warn':'bad'; }

// Lista de barras: [{label, value, sub, pct, cls, color}]
function barList(items, empty){
  if(!items.length) return '<div class="cd-empty" style="padding:18px">'+(empty||'No data')+'</div>';
  return items.map(function(i){
    return '<div class="drow">'+
      '<div class="drow-top"><span class="drow-lbl">'+i.label+'</span>'+
        '<span class="drow-val '+(i.cls||'')+'">'+i.value+'</span></div>'+
      mkBar(i.pct, i.color)+
      (i.sub ? '<div class="drow-sub">'+i.sub+'</div>' : '')+
    '</div>';
  }).join('');
}


// ---------- Agregados compartidos por la pantalla y el PDF ----------
// Desglose por clave con bolsas, compliance, desviacion y sobrellenado.
function dashBreakdown(list, keyFn){
  var m = {};
  list.forEach(function(r){
    var k = keyFn(r); if(k===''||k==null) return;
    k = String(k);
    if(!m[k]) m[k] = {key:k,n:0,bags:0,pass:0,devSum:0,devN:0,over:0,under:0,overSum:0};
    var g = m[k];
    g.n++; g.bags += r.total; g.pass += r.pass;
    var t = recTarget(r); if(!t) return;
    var mid = (t.min+t.max)/2;
    (r.vals||[]).forEach(function(v){
      var x = parseFloat(v); if(isNaN(x)) return;
      g.devSum += (x-mid); g.devN++;
      if(x>t.max){ g.over++; g.overSum += (x-t.max); }
      else if(x<t.min){ g.under++; }
    });
  });
  return Object.keys(m).map(function(k){
    var g = m[k];
    g.fail = g.bags - g.pass;
    g.comp = pctOf(g.pass, g.bags);
    g.avgDev = g.devN ? g.devSum/g.devN : null;
    return g;
  });
}

// Totales de llenado del conjunto completo
function dashFill(list){
  var o = {bags:0, pass:0, fail:0, comp:0, devSum:0, devN:0, avgDev:null, over:0, under:0, overSum:0, underSum:0};
  list.forEach(function(r){
    o.bags += r.total; o.pass += r.pass;
    var t = recTarget(r); if(!t) return;
    var mid = (t.min+t.max)/2;
    (r.vals||[]).forEach(function(v){
      var x = parseFloat(v); if(isNaN(x)) return;
      o.devSum += (x-mid); o.devN++;
      if(x>t.max){ o.over++; o.overSum += (x-t.max); }
      else if(x<t.min){ o.under++; o.underSum += (t.min-x); }
    });
  });
  o.fail = o.bags - o.pass;
  o.comp = pctOf(o.pass, o.bags);
  o.avgDev = o.devN ? o.devSum/o.devN : null;
  return o;
}

function initDash(){
  // Primera apertura: aplica el rango por defecto que ya viene marcado
  if(!dashReady){
    dashReady = true;
    dashQuickRange(dashDays, document.querySelector('[data-dashrange].selected'));
    return;
  }
  readDashFilters();
  // Si el rango pedido es más viejo que la ventana en vivo (90 días), trae ese
  // historial de Firestore una sola vez y luego pinta. Para rangos recientes
  // loadHistory no hace ninguna lectura (ya está en memoria).
  var need = dashF.from ? dashF.from : (dashDays===0 ? '1970-01-01' : '');
  if(need && window.loadHistory){ window.loadHistory(need, renderDash); return; }
  renderDash();
}

function renderDash(){
  readDashFilters();
  var db = getDB();

  // El selector de producto se llena con el catálogo
  var sel = document.getElementById('dash-product');
  if(sel && sel.options.length<=1){
    sel.innerHTML = '<option value="all">All products</option>'+
      getProducts().map(function(p){
        return '<option value="'+p.number+'">'+p.number+(p.name?' — '+p.name:'')+'</option>';
      }).join('');
    sel.value = dashF.product;
  }

  var w     = (db.weights||[]).filter(dashKeep);
  var seals = (db.seals||[]).filter(dashKeep);
  var gmps  = (db.gmps||[]).filter(function(r){ return dashInRange(r.date) &&
                (dashF.shift==='all' || String(r.shift||'')===dashF.shift); });
  var temps = (db.temps||[]).filter(function(r){ return dashInRange(r.date) &&
                (dashF.shift==='all' || String(r.shift||'')===dashF.shift); });
  var metal = (db.metal||[]).filter(function(r){ return dashInRange(r.date); });
  var holds = (db.holds||[]).filter(function(h){ return dashInRange(h.createdAt); });

  // ---------- KPIs ----------
  var scored = w.filter(function(r){ return r.compliance!=null; });
  var tBags  = scored.reduce(function(a,r){ return a+r.total; },0);
  var tPass  = scored.reduce(function(a,r){ return a+r.pass; },0);
  var tFail  = tBags - tPass;
  var comp   = pctOf(tPass, tBags);

  // Desviación respecto al centro del rango, y sobrellenado por encima del máximo
  var fill = dashFill(scored);
  var over = fill.over, under = fill.under, overSum = fill.overSum, avgDev = fill.avgDev;
  var openHolds = holds.filter(function(h){ return h.status!=='released' && h.status!=='destroyed'; }).length;

  var kpi = function(label, value, note, cls){
    return '<div class="tile"><div class="t-top"><span class="t-lbl">'+label+'</span></div>'+
      '<div class="t-val'+(cls?' '+cls:'')+'">'+value+'</div>'+
      '<div class="t-note">'+note+'</div></div>';
  };
  document.getElementById('dash-kpis').innerHTML =
    kpi('Compliance', tBags?comp+'<small>%</small>':'—', tPass+' of '+tBags+' bags in target', compClass(comp)) +
    kpi('Weight checks', w.length, scored.length+' scored · '+(w.length-scored.length)+' without target') +
    kpi('Out of target', tFail, under+' under · '+over+' over', tFail?'bad':'') +
    kpi('Avg deviation', avgDev==null?'—':(avgDev>0?'+':'')+avgDev.toFixed(3), 'lbs from target centre') +
    kpi('Overfill', overSum?overSum.toFixed(1):'0', 'lbs above the max limit') +
    kpi('Open holds', openHolds, holds.length+' case(s) in the period', openHolds?'bad':'');

  // ---------- Tendencia diaria ----------
  var byDay = {};
  scored.forEach(function(r){
    var d = String(r.date).slice(0,10);
    if(!byDay[d]) byDay[d] = {pass:0,total:0};
    byDay[d].pass += r.pass; byDay[d].total += r.total;
  });
  var days = Object.keys(byDay).sort();
  drawTrend(days, days.map(function(d){ return pctOf(byDay[d].pass, byDay[d].total); }));

  // ---------- Cortes por línea, producto, formato y turno ----------
  var group = function(list, keyFn, labelFn){
    var m = {};
    list.forEach(function(r){
      var k = keyFn(r); if(k===''||k==null) return;
      k = String(k);
      if(!m[k]) m[k] = {pass:0,total:0,n:0};
      m[k].pass += r.pass; m[k].total += r.total; m[k].n++;
    });
    return Object.keys(m).map(function(k){
      var p = pctOf(m[k].pass, m[k].total);
      return {key:k, label:labelFn?labelFn(k):k, value:p+'%', pct:p, n:m[k].n,
              sub:m[k].total+' bags · '+m[k].n+' checks',
              cls:compClass(p), color:p>=90?'var(--pass)':p>=80?'var(--warn)':'var(--fail)'};
    }).sort(function(a,b){ return a.pct-b.pct; });
  };

  document.getElementById('dash-by-line').innerHTML =
    barList(group(scored, function(r){ return r.line; }, function(k){ return 'Line '+k; }), 'No weight records');

  document.getElementById('dash-by-product').innerHTML =
    barList(group(scored, function(r){ return r.product||''; }, function(k){
      var p = findProduct(k);
      return esc(k) + (p&&p.name ? ' · '+esc(p.name) : '');
    }).slice(0,8), 'No product numbers on these records');

  document.getElementById('dash-by-pkg').innerHTML =
    barList(group(scored, function(r){ return r.pkgLabel||''; }), 'No package sizes');

  document.getElementById('dash-by-shift').innerHTML =
    barList(group(scored, function(r){ return r.shift; }, function(k){ return (k==='1'?'1st':'2nd')+' shift'; }), 'No shifts');

  // ---------- Bag seal ----------
  var sealRows = SEAL_CHECKS.map(function(chk){
    var done = seals.filter(function(s){ return (s.checks||{})[chk]; });
    var ok   = done.filter(function(s){ return s.checks[chk]==='pass'; }).length;
    var p    = pctOf(ok, done.length);
    return {label:chk, value:done.length?p+'%':'—', pct:p, sub:ok+' passed of '+done.length,
            cls:compClass(p), color:p>=90?'var(--pass)':p>=80?'var(--warn)':'var(--fail)'};
  });
  document.getElementById('dash-seal').innerHTML =
    '<div class="dash-mini">'+seals.length+' bag seal check'+(seals.length===1?'':'s')+' in the period</div>'+
    barList(sealRows, 'No bag seal records');

  // ---------- Temperatura y humedad (desde db.temps) ----------
  var pick = function(cp, field){
    return temps.filter(function(t){ return t.checkpoint===cp; })
                .map(function(t){ return parseFloat(t[field]); })
                .filter(function(n){ return !isNaN(n); });
  };
  var avg = function(a){ return a.length ? (a.reduce(function(x,y){return x+y},0)/a.length) : null; };
  var fmt = function(v, unit){ return v==null ? '—' : v.toFixed(1)+(unit||''); };

  var tCell = function(cp, label){
    var vals = pick(cp,'temp');
    return '<div class="tcell"><div class="tcell-lbl">'+label+'</div>'+
      '<div class="tcell-val">'+fmt(avg(vals),'°')+'</div>'+
      '<div class="tcell-sub">'+vals.length+' reading(s)</div></div>';
  };
  var hum = function(field, label){
    var a = temps.map(function(t){ return parseFloat(t[field]); }).filter(function(n){ return !isNaN(n); });
    var v = avg(a);
    return {label:label, value:fmt(v,'%'), pct:v||0, sub:a.length+' reading(s)', color:'var(--accent)'};
  };
  // Cobertura: de los 3 checkpoints por fecha y turno, cuántos se tomaron
  var slots = {};
  temps.forEach(function(t){ slots[t.date+'|'+t.shift] = 1; });
  var shiftCount = Object.keys(slots).length;
  var expected = shiftCount*3;
  var coverage = pctOf(temps.length, expected);

  document.getElementById('dash-temp').innerHTML =
    '<div class="tgrid">'+tCell('begin','BEGINNING')+tCell('mid','MIDDLE')+tCell('end','END')+'</div>'+
    barList([hum('chop','Chopping area humidity'), hum('plat','Under platform humidity'), hum('line6','Line 6 & grilling humidity')],
            'No humidity readings')+
    (shiftCount ? '<div class="dash-mini">Checkpoint coverage: <b>'+coverage+'%</b> — '+temps.length+
      ' of '+expected+' expected across '+shiftCount+' shift(s)</div>' : '');

  // ---------- Metal detector ----------
  var mdFails = {}, mdClean = 0;
  metal.forEach(function(r){
    var bad = 0;
    MD_QUESTIONS.forEach(function(q,i){
      if((r.answers||{})[i]==='no'){ bad++; mdFails[i] = (mdFails[i]||0)+1; }
    });
    if(!bad) mdClean++;
  });
  var mdTop = Object.keys(mdFails).sort(function(a,b){ return mdFails[b]-mdFails[a]; }).slice(0,3);
  document.getElementById('dash-metal').innerHTML = metal.length
    ? '<div class="tgrid two">'+
        '<div class="tcell"><div class="tcell-lbl">CHECKS</div><div class="tcell-val">'+metal.length+'</div><div class="tcell-sub">in the period</div></div>'+
        '<div class="tcell"><div class="tcell-lbl">ALL YES</div><div class="tcell-val '+(mdClean===metal.length?'ok':'warn')+'">'+pctOf(mdClean,metal.length)+'%</div><div class="tcell-sub">'+mdClean+' of '+metal.length+'</div></div>'+
      '</div>'+
      (mdTop.length ? barList(mdTop.map(function(i){
        var c = mdFails[i];
        return {label:(Number(i)+1)+'. '+MD_QUESTIONS[i], value:c+'x', pct:pctOf(c,metal.length),
                sub:'marked NO', color:'var(--fail)', cls:'bad'};
      })) : '<div class="dash-mini">No question was ever marked NO.</div>')
    : '<div class="cd-empty" style="padding:18px">No metal detector checks</div>';

  // ---------- GMP ----------
  var gmpYes=0, gmpNo=0, itemFails={};
  gmps.forEach(function(r){
    GMP_ITEMS.forEach(function(item,i){
      var v = (r.answers||{})[i];
      if(v==='yes') gmpYes++;
      else if(v==='no'){ gmpNo++; itemFails[item] = (itemFails[item]||0)+1; }
    });
  });
  var gmpRate = pctOf(gmpYes, gmpYes+gmpNo);
  var topFails = Object.keys(itemFails).sort(function(a,b){ return itemFails[b]-itemFails[a]; }).slice(0,5);
  document.getElementById('dash-gmp').innerHTML =
    '<div class="tgrid two">'+
      '<div class="tcell"><div class="tcell-lbl">AUDITS</div><div class="tcell-val">'+gmps.length+'</div><div class="tcell-sub">in the period</div></div>'+
      '<div class="tcell"><div class="tcell-lbl">ACCEPTABLE</div><div class="tcell-val '+compClass(gmpRate)+'">'+((gmpYes+gmpNo)?gmpRate+'%':'—')+'</div><div class="tcell-sub">'+gmpYes+' yes · '+gmpNo+' no</div></div>'+
    '</div>'+
    (topFails.length ? barList(topFails.map(function(item){
      return {label:item, value:itemFails[item]+'x', pct:pctOf(itemFails[item], gmps.length||1),
              sub:'marked NO', color:'var(--fail)', cls:'bad'};
    })) : '<div class="dash-mini">No GMP item was marked NO in this period.</div>');

  // ---------- Registros recientes ----------
  var list = document.getElementById('records-list');
  list.innerHTML = w.length
    ? w.slice().sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }).slice(0,12).map(function(r){
        var cls = r.compliance==null?'mi':r.compliance>=90?'hi':r.compliance>=80?'mi':'lo';
        var dt  = new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        return '<div class="rec-item"><div><div class="rec-line">Line '+r.line+' · '+r.pkgLabel+
          (r.product?' · #'+esc(r.product):'')+'</div>'+
          '<div class="rec-meta">'+dt+' · '+(r.shift===1?'1st':'2nd')+' shift · '+r.time+(r.lot?' · LOT '+esc(r.lot):'')+'</div></div>'+
          '<div class="rec-comp '+cls+'">'+compLabel(r.compliance)+'</div></div>';
      }).join('')
    : '<div class="cd-empty" style="padding:18px">No weight records for these filters</div>';

  drawDonut(tPass, tFail);
}

// ---------- Gráficas ----------
function drawTrend(labels, values){
  var cv = document.getElementById('chart-trend');
  if(!cv || typeof Chart==='undefined') return;
  if(trendChart) trendChart.destroy();
  var css = getComputedStyle(document.body);
  var accent = css.getPropertyValue('--accent').trim() || '#005339';
  var grid   = css.getPropertyValue('--border').trim() || '#d7dcd7';
  var muted  = css.getPropertyValue('--muted').trim() || '#5f6d65';
  trendChart = new Chart(cv, {
    type:'line',
    data:{ labels:labels.map(function(d){ return d.slice(5); }),
      datasets:[{ data:values, borderColor:accent, backgroundColor:'rgba(0,83,57,0.08)',
        fill:true, tension:0.3, pointRadius:2, pointBackgroundColor:accent, borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ y:{ min:0, max:100, ticks:{color:muted, font:{size:10}, callback:function(v){return v+'%'} },
                   grid:{color:grid} },
               x:{ ticks:{color:muted, font:{size:10}, maxTicksLimit:10}, grid:{display:false} } } }
  });
}

function drawDonut(pass, fail){
  var cv = document.getElementById('chart-donut');
  if(!cv || typeof Chart==='undefined') return;
  if(donutChart) donutChart.destroy();
  var css = getComputedStyle(document.body);
  donutChart = new Chart(cv, {
    type:'doughnut',
    data:{ labels:['In target','Out of target'], datasets:[{ data:[pass,fail],
      backgroundColor:[css.getPropertyValue('--pass').trim()||'#1a8656', css.getPropertyValue('--fail').trim()||'#e7000b'],
      borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:11},
        color:css.getPropertyValue('--muted').trim()||'#5f6d65' } } } }
  });
}

function clearData(){
  if(confirm('Delete all records?')){localStorage.removeItem('safety_db');localStorage.removeItem('caputo_db');if(window.clearFirebase)window.clearFirebase();initDash();toast('Data cleared')}
}

// ===== GMP =====
function initGmp(){
  document.getElementById('gmp-date').value=localDateStr();
  renderGmpList();
}
function renderGmpList(){
  document.getElementById('gmp-list').innerHTML=GMP_ITEMS.map(function(item,i){
    var v=gmpAnswers[i];
    return '<div class="gmp-row">' +
      '<div class="gmp-item-lbl">'+item+'</div>' +
      '<div class="gmp-btns">' +
        '<button class="gmp-tog'+(v==='yes'?' yes-on':'')+'" data-i="'+i+'" data-v="yes" onclick="setGmpItem(this)">YES</button>' +
        '<button class="gmp-tog'+(v==='no'?' no-on':'')+'" data-i="'+i+'" data-v="no" onclick="setGmpItem(this)">NO</button>' +
      '</div>' +
    '</div>';
  }).join('');
}
function setGmpItem(btn){
  gmpAnswers[parseInt(btn.getAttribute('data-i'))]=btn.getAttribute('data-v');
  renderGmpList();
}
function setGmpShift(n){
  gmpShift=n;
  document.getElementById('gmp-s1').className='gmp-tog'+(n===1?' yes-on':'');
  document.getElementById('gmp-s2').className='gmp-tog'+(n===2?' yes-on':'');
}
function gv(id){var e=document.getElementById(id);return e?e.value:'';}
function saveGmp(){
  var db=getDB();
  db.gmps.push({
    id:Date.now(), date:gv('gmp-date'), location:gv('gmp-loc'),
    shift:gmpShift, answers:Object.assign({},gmpAnswers),
    // temp now in separate db.temps
    comments:gv('gmp-comments'), completedBy:gv('gmp-completed'), verifiedBy:gv('gmp-verified')
  });
  saveDB(db);
  if(window.saveToFirebase) window.saveToFirebase('gmps', db.gmps[db.gmps.length-1]);
  var grec = db.gmps[db.gmps.length-1];
  logActivity('gmp','GMP Audit completed',
    'Location: '+(grec.location||'—')+' · Shift: '+(grec.shift||'—')+' · Completed by: '+(grec.completedBy||'—'),
    grec.completedBy||(currentUser?currentUser.name:'—'));
  gmpAnswers={}; gmpShift=null;
  ['gmp-loc','gmp-comments','gmp-completed','gmp-verified'].forEach(function(id){document.getElementById(id).value='';});
  // temp fields now in Temp & Humidity module
  setGmpShift(0);
  renderGmpList();
  toast('GMP record saved!');
}

// ===== TEMP & HUMIDITY =====
var thShift = null;
var thCheckpoint = null; // 'begin' | 'mid' | 'end'
var thEditing = false;   // true sólo si el usuario pidió corregir un checkpoint ya guardado

var TH_FIELDS = ['th-time','th-temp','th-chop','th-plat','th-line6','th-comments','th-completed'];
var TH_CP_LABEL = {begin:'Beginning', mid:'Middle', end:'End'};
var TH_CP_BTN   = {begin:'th-cp1', mid:'th-cp2', end:'th-cp3'};


function initTempScreen(){
  // Fecha LOCAL: con toISOString() la app saltaba al día siguiente por la tarde
  document.getElementById('th-date').value = localDateStr();
  var d = document.getElementById('th-date');
  d.onchange = function(){ thCheckpoint=null; thEditing=false; clearThFields(); renderThUI(); };
  thShift = null; thCheckpoint = null; thEditing = false;
  document.getElementById('th-s1').className='gmp-tog';
  document.getElementById('th-s2').className='gmp-tog';
  clearThFields();
  renderThUI();
}

function clearThFields(){
  TH_FIELDS.forEach(function(id){ document.getElementById(id).value=''; });
}

function thFieldsDisabled(on){
  TH_FIELDS.forEach(function(id){ document.getElementById(id).disabled = !!on; });
}

// Registro ya guardado para la fecha/turno/checkpoint indicados
function thRecordFor(cp){
  var date = document.getElementById('th-date').value;
  if(!date || !thShift || !cp) return null;
  return (getDB().temps||[]).find(function(t){
    return t.date===date && t.shift===thShift && t.checkpoint===cp;
  }) || null;
}

// Checkpoints guardados de una fecha (y turno, si se indica). Lo usan los PDF.
function tempsFor(date, shift){
  var out = {begin:null, mid:null, end:null};
  (getDB().temps||[]).forEach(function(t){
    if(t.date!==date) return;
    if(shift && String(t.shift)!==String(shift)) return;
    if(!out[t.checkpoint]) out[t.checkpoint] = t;
  });
  return out;
}

function thRecordSummary(r){
  return (r.time||'—')+' · '+(r.temp?r.temp+'°F':'—°F')+
         (r.chop?' · Chop '+r.chop+'%':'')+(r.plat?' · Plat '+r.plat+'%':'')+
         (r.line6?' · L6 '+r.line6+'%':'')+(r.completedBy?' · '+r.completedBy:'');
}

function setThShift(n){
  thShift = n;
  thCheckpoint = null; thEditing = false;
  document.getElementById('th-s1').className='gmp-tog'+(n===1?' yes-on':'');
  document.getElementById('th-s2').className='gmp-tog'+(n===2?' yes-on':'');
  clearThFields();
  renderThUI();
}

function setThCheckpoint(cp){
  thCheckpoint = cp;
  thEditing = false;
  var existing = thRecordFor(cp);
  if(existing){
    // Ya registrado: se muestra en solo lectura, no se puede sobreescribir sin pedirlo
    document.getElementById('th-time').value      = existing.time   || '';
    document.getElementById('th-temp').value      = existing.temp   || '';
    document.getElementById('th-chop').value      = existing.chop   || '';
    document.getElementById('th-plat').value      = existing.plat   || '';
    document.getElementById('th-line6').value     = existing.line6  || '';
    document.getElementById('th-comments').value  = existing.comments||'';
    document.getElementById('th-completed').value = existing.completedBy||'';
  } else {
    clearThFields();
    var now = new Date();
    document.getElementById('th-time').value =
      String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  }
  renderThUI();
}

// Pinta selección, checkpoints ya guardados, banner de estado y el botón de guardar
function renderThUI(){
  ['begin','mid','end'].forEach(function(cp){
    var btn = document.getElementById(TH_CP_BTN[cp]);
    if(!btn) return;
    var saved = !!thRecordFor(cp);
    btn.className = 'gmp-tog'+(thCheckpoint===cp?' yes-on':'')+(saved?' done':'');
    btn.innerHTML = TH_CP_LABEL[cp]+(saved?' <span class="cp-done">•</span>':'');
  });

  var locked = !!(thCheckpoint && thRecordFor(thCheckpoint) && !thEditing);
  thFieldsDisabled(locked);

  var note = document.getElementById('th-lock-note');
  if(note){
    if(locked){
      note.className = 'dup-hint';
      note.innerHTML = '<div class="dup-hint-title">'+TH_CP_LABEL[thCheckpoint]+' is already recorded — locked</div>'+
        '<div class="dup-hint-detail">'+thRecordSummary(thRecordFor(thCheckpoint))+'</div>';
      note.style.display='block';
    } else if(thEditing && thCheckpoint){
      note.className = 'th-edit-note';
      note.innerHTML = '<div class="dup-hint-title">Editing '+TH_CP_LABEL[thCheckpoint]+' — this replaces the saved values</div>'+
        '<div class="dup-hint-detail">Save to update the record</div>';
      note.style.display='block';
    } else {
      note.style.display='none'; note.innerHTML='';
    }
  }

  var btn = document.getElementById('th-save-btn');
  if(btn){
    btn.textContent = thEditing ? 'Update Checkpoint' : 'Save Checkpoint';
    btn.disabled = locked;
  }
  renderThSummary();
}

// Desbloquea un checkpoint ya guardado para corregirlo (desde el modal)
function thEditExisting(){
  closeDupModal();
  thEditing = true;
  renderThUI();
  toast('Editing '+TH_CP_LABEL[thCheckpoint]+' — save to update');
}

function thPickAnother(){
  closeDupModal();
  var btn = document.getElementById(TH_CP_BTN[thCheckpoint]);
  if(btn && btn.scrollIntoView) btn.scrollIntoView({block:'center'});
}

function renderThSummary(){
  var el = document.getElementById('th-summary');
  if(!el) return;
  var date = document.getElementById('th-date').value;
  if(!date || !thShift){ el.innerHTML=''; return; }
  var db = getDB();
  var recs = (db.temps||[]).filter(function(t){ return t.date===date && t.shift===thShift; });
  if(!recs.length){ el.innerHTML=''; return; }

  var cpLabel = {begin:'Beginning', mid:'Middle', end:'End'};
  var rows = ['begin','mid','end'].map(function(cp){
    var r = recs.find(function(t){ return t.checkpoint===cp; });
    var saved = r ? 'Recorded' : '—';
    var color = r ? '#2d6a4f' : '#aaa';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:'+(r?'#d8f3dc':'#f5f5f7')+';border-radius:8px;margin-bottom:6px">'+
      '<span style="font-size:12px;font-weight:700;color:'+color+'">'+cpLabel[cp]+'</span>'+
      '<span style="font-size:11px;color:'+color+'">'+(r ? r.temp+'°F · '+r.time : 'Not recorded')+'</span>'+
      '<span style="font-size:14px;font-weight:900;color:'+color+'">'+saved+'</span>'+
    '</div>';
  }).join('');

  el.innerHTML = '<div style="background:white;border:1px solid #e0e0e0;border-radius:10px;padding:10px;margin-bottom:4px">'+
    '<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Checkpoints this shift</div>'+
    rows+'</div>';
}

function saveTempHumidity(){
  if(!thShift){ toast('Select a shift'); return; }
  if(!thCheckpoint){ toast('Select a checkpoint (Beginning / Middle / End)'); return; }
  var date = document.getElementById('th-date').value;
  if(!date){ toast('Select a date'); return; }

  // No sobreescribir un checkpoint ya guardado salvo que se pida explícitamente
  var existing = thRecordFor(thCheckpoint);
  if(existing && !thEditing){
    showGuardModal({
      title: TH_CP_LABEL[thCheckpoint]+' is already recorded for '+(thShift===1?'1st':'2nd')+' shift',
      detail: thRecordSummary(existing),
      ask: 'Pick the checkpoint you are actually taking, or edit the saved one.',
      primaryLabel:'Pick another checkpoint', onPrimary:thPickAnother,
      secondaryLabel:'Edit this record',      onSecondary:thEditExisting
    });
    return;
  }

  commitTempHumidity(date, existing);
}

function commitTempHumidity(date, existing){
  var db = getDB();
  if(!db.temps) db.temps = [];

  // Remove existing record for same date+shift+checkpoint (update it)
  db.temps = db.temps.filter(function(t){
    return !(t.date===date && t.shift===thShift && t.checkpoint===thCheckpoint);
  });

  var cpLabel = TH_CP_LABEL;
  var rec = {
    id: Date.now(),
    date: date,
    shift: thShift,
    checkpoint: thCheckpoint,
    time:  document.getElementById('th-time').value,
    temp:  document.getElementById('th-temp').value,
    chop:  document.getElementById('th-chop').value,
    plat:  document.getElementById('th-plat').value,
    line6: document.getElementById('th-line6').value,
    comments:    document.getElementById('th-comments').value,
    completedBy: document.getElementById('th-completed').value
  };
  db.temps.push(rec);
  // Al corregir, se reescribe el MISMO documento en Firestore; si no, el viejo
  // volvería en la próxima sincronización y desharía la corrección.
  if(existing && existing._fbId && window.saveToFirebaseAt){
    rec._fbId = existing._fbId;
    saveDB(db);
    window.saveToFirebaseAt('temps', existing._fbId, rec);
  } else {
    saveDB(db);
    if(window.saveToFirebase) window.saveToFirebase('temps', rec);
  }
  var wasEdit = !!existing;
  logActivity('temp', wasEdit ? 'Temp & Humidity updated' : 'Temp & Humidity recorded',
    cpLabel[thCheckpoint]+' · Shift '+(thShift===1?'1st':'2nd')+' · '+date+
    (wasEdit?' · corrected an existing checkpoint':''),
    rec.completedBy||(currentUser?currentUser.name:'—'));

  toast(cpLabel[thCheckpoint]+(wasEdit?' checkpoint updated':' checkpoint saved'));

  // El checkpoint queda sin seleccionar a propósito: así el siguiente registro
  // obliga a elegir cuál se está tomando y no cae sobre el anterior.
  thCheckpoint = null;
  thEditing = false;
  clearThFields();
  renderThUI();
}


