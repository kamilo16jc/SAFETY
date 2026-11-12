// ===== BITACORA DE UNA MUESTRA (COA › Status) =====
// Pedido del usuario (11 nov 2026): en vez de tener la informacion regada en
// celdas, cada fila de Status lleva una lupa que abre la bitacora completa de
// la muestra, en orden: la orden (COA Orders), la corrida del schedule, cuando
// se recogio, cuando fue al laboratorio, cuando y quien la testeo, la placa,
// el reporte del laboratorio y el COA, que se descarga desde aqui si ya esta.
// Lo que falta va al final, con su fecha y en rojo si ya se paso.
//
// "Expected" = 5 dias despues de que se hizo la orden (si no hay orden de COA
// Orders, despues de la fecha de la muestra): para saber si el producto ya
// deberia estar listo.

var ST_ESPERA_DIAS = 5;
var stLogId = null;

// ---- De donde sale cada cosa ----
function stOrderOf(a){
  if(!a) return null;
  var o = (a.orderId != null && typeof orderById === 'function') ? orderById(a.orderId) : null;
  if(!o && a.order && typeof orderByNumber === 'function') o = orderByNumber(a.order, a.product);
  return o || null;
}
function stRunOf(a){
  if(!a || typeof getRuns !== 'function') return null;
  var runs = getRuns();
  if(a.runId != null){
    var r = runs.filter(function(x){ return String(x.id) === String(a.runId); })[0];
    if(r) return r;
  }
  var dia = String(a.date || '').slice(0, 10);
  return runs.filter(function(x){
    return !x.cancelled && String(x.product || '') === String(a.product || '') && String(x.date || '').slice(0, 10) === dia;
  })[0] || null;
}
function stIsoMas(iso, n){
  var d = new Date(String(iso).slice(0, 10)+'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2, '0')+'-'+String(d.getDate()).padStart(2, '0');
}
function stDiasHasta(iso){
  return Math.round((new Date(String(iso).slice(0, 10)+'T12:00:00') - new Date(localDateStr()+'T12:00:00')) / 864e5);
}
// El dia esperado: 5 dias despues de la orden (o de la muestra)
function stExpected(a){
  var o = stOrderOf(a);
  var base = (o && o.createdAt) ? String(o.createdAt).slice(0, 10) : String(a.date || '').slice(0, 10);
  // Orden de varios dias: lo que se hizo despues de la orden cuenta desde su dia
  var dm = String(a.date || '').slice(0, 10), porMuestra = false;
  if(o && typeof orEsRango === 'function' && orEsRango(o) && /^\d{4}-\d{2}-\d{2}$/.test(dm) && dm > base){
    base = dm; porMuestra = true;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(base)) return null;
  var f = stIsoMas(base, ST_ESPERA_DIAS);
  return {fecha:f, base:base, dias:stDiasHasta(f), deOrden:!!(o && o.createdAt) && !porMuestra, porMuestra:porMuestra};
}
// En que va el certificado
function stCoaEstado(a){
  if(a.coaNo) return 'issued';
  return (typeof coaReady === 'function' && coaReady(a)) ? 'ready' : 'waiting';
}
// El "cuando" con hora, como se lee en la planta
function stCuando(at){
  if(!at) return '';
  var s = String(at), t = s.indexOf('T') > 0 ? s.slice(11, 16) : '';
  return fmtDate(s.slice(0, 10)) + (t ? ' · '+fmtTime12(t) : '');
}
// El primer / ultimo cambio de unos campos (cuando se pusieron los resultados)
function stCambio(a, campos, ultimo){
  var l = (a.changes || []).filter(function(c){ return campos.indexOf(c.field) >= 0 && String(c.to || '').trim(); });
  if(!l.length) return null;
  return ultimo ? l[l.length - 1] : l[0];
}

// ---- Lo que paso y lo que falta ----
function stEventos(a){
  var hechos = [], falta = [];
  var o = stOrderOf(a), run = stRunOf(a);
  var poner = function(e){ if(e.at) hechos.push(e); };

  if(o) poner({at:o.createdAt, icon:'doc', t:'Order '+o.order+' created',
    d:[o.po ? 'PO '+o.po : '', (o.products || []).length+' product'+((o.products || []).length === 1 ? '' : 's'),
       o.prodDate ? 'Production '+((typeof orFechasTexto === 'function') ? orFechasTexto(o) : fmtDate(o.prodDate)) : ''], by:o.createdBy});
  if(run){
    poner({at:run.createdAt, icon:'calendar', t:'Scheduled',
      d:['Line '+(run.line || '—'), (String(run.shift) === '1' ? '1st' : '2nd')+' shift', fmtDate(String(run.date).slice(0, 10))],
      by:run.createdBy});
    if(run.collected) poner({at:run.collectedAt, icon:'droplet', t:'Sample collected',
      d:[run.lot ? 'LOT '+run.lot : '', run.sampleFrom ? 'Samples '+run.sampleFrom+'–'+run.sampleTo : '']});
    if(run.labSent) poner({at:run.labSentAt, icon:'factory', t:'Sent to the external lab'});
  }
  poner({at:a.createdAt, icon:'clipboard', t:'Registered in Sample Analysis'+(a.seq ? ' #'+a.seq : ''), by:a.createdBy});
  // si se le cambio el numero (js/modules/renumber.js), tambien se ve
  (a.changes || []).filter(function(c){ return c.field === 'seq'; }).forEach(function(c){
    poner({at:c.at, icon:'history', t:'Analysis number changed', d:['#'+(c.from || '\u2014')+' \u2192 #'+c.to], by:c.by});
  });

  // Moisture / Fat / pH: cuando se puso el primer resultado (pudo ser despues)
  var medidas = [a.moisture ? 'Moisture '+a.moisture+'%' : '', a.fat ? 'Fat '+a.fat+'%' : '', a.ph ? 'pH '+a.ph : ''];
  var sinTest = (typeof analysisNoTests === 'function') && analysisNoTests(a);
  if(typeof anHasResults === 'function' ? anHasResults(a) : !!(a.moisture || a.fat || a.ph)){
    var c1 = stCambio(a, ['moisture', 'fat', 'ph']);
    poner({at:c1 ? c1.at : a.createdAt, icon:'check', t:'Tested', d:medidas, by:a.testedBy || (c1 && c1.by)});
  } else if(sinTest){
    poner({at:a.createdAt, icon:'note', t:'No Moisture, Fat or pH', d:['The product has no plate: not tested']});
  } else {
    falta.push({icon:'check', t:'Moisture, Fat and pH', d:['Not tested yet']});
  }

  // La placa de yeast & mold (si el producto la lleva)
  var lleva = (typeof ymPlate === 'function') ? ymPlate(a.product) : true;
  if(lleva){
    if(typeof stPlateDone === 'function' && stPlateDone(a)){
      poner({at:a.ymAt, icon:'droplet', t:'Yeast & mold plate read',
        d:[a.yeast !== '' && a.yeast != null ? 'Yeast '+a.yeast : '', a.mold !== '' && a.mold != null ? 'Mold '+a.mold : ''], by:a.ymBy});
    } else {
      var due = (typeof ymDueDate === 'function') ? ymDueDate(a) : '';
      var left = due ? stDiasHasta(due) : 0;
      // la placa se hace al testear Moisture / Fat / pH: antes no hay fecha
      falta.push({icon:'clock', t:'Yeast & mold plate', tarde:due && left < 0,
        d:due ? ['Due '+fmtDate(due), left > 0 ? 'in '+left+' day'+(left === 1 ? '' : 's') : left === 0 ? 'today' : Math.abs(left)+' days late']
              : ['Made when Moisture, Fat and pH are tested']});
    }
  }

  // El reporte del laboratorio de fuera
  var necesitaLab = (typeof coaNeedsLab === 'function') ? coaNeedsLab(a) : false;
  if(a.result && String(a.result).trim()){
    var cr = stCambio(a, ['result'], true);
    poner({at:cr ? cr.at : (a.editedAt || a.createdAt), icon:'doc', t:'Lab report in',
      d:['Verdict: '+a.result], by:a.resultBy || (cr && cr.by)});
  } else if(necesitaLab){
    falta.push({icon:'doc', t:'Lab report', d:['Waiting for the external lab']});
  }

  // El certificado: cada emision o revision
  var emisiones = (a.changes || []).filter(function(c){ return c.field === 'COA'; });
  if(emisiones.length){
    emisiones.forEach(function(c){
      poner({at:c.at, icon:'pdf', t:'COA issued', d:[String(c.to || '')], by:c.by, ok:true});
    });
  } else if(a.coaNo){
    poner({at:a.coaAt, icon:'pdf', t:'COA issued', d:[a.coaNo+(a.coaRev ? ' R'+a.coaRev : '')], by:a.coaBy, ok:true});
  }
  // Lo que se cambio despues de emitir: se dice
  (a.changes || []).filter(function(c){ return c.afterCoa; }).forEach(function(c){
    poner({at:c.at, icon:'alert', t:'Changed after the COA', warn:true,
      d:[c.field+': '+(c.from || '—')+' → '+(c.to || '—')], by:c.by});
  });
  if(!a.coaNo){
    var listo = stCoaEstado(a) === 'ready';
    falta.push({icon:'pdf', t:'Certificate (COA)',
      d:[listo ? 'Ready to issue' : ((typeof coaMissing === 'function') ? 'Missing: '+coaMissing(a) : 'Not ready yet')]});
  }

  hechos.sort(function(x, y){ return String(x.at).localeCompare(String(y.at)); });
  return {hechos:hechos, falta:falta};
}

// ---- La celda "Expected" de la tabla ----
function stExpectedHTML(a){
  var e = stExpected(a), est = stCoaEstado(a);
  if(!e) return '—';
  var fecha = '<span class="st-exp-f">'+esc(fmtDate(e.fecha))+'</span>';
  if(est === 'issued') return fecha+' <span class="pill ok">COA issued</span>';
  if(est === 'ready')  return fecha+' <span class="pill ok">Ready</span>';
  if(e.dias > 0)  return fecha+' <span class="pill">in '+e.dias+'d</span>';
  if(e.dias === 0) return fecha+' <span class="pill warn">today</span>';
  return fecha+' <span class="pill bad">'+Math.abs(e.dias)+'d late</span>';
}

// ---- El panel ----
function stLogMontar(){
  var ov = document.getElementById('st-log');
  if(ov) return ov;
  ov = document.createElement('div');
  ov.id = 'st-log'; ov.className = 'nx-log-ov'; ov.hidden = true;
  ov.innerHTML = '<div class="nx-log-scrim" onclick="stLogClose()"></div>'+
    '<aside class="nx-log" role="dialog" aria-modal="true" aria-labelledby="st-log-t" id="st-log-panel" tabindex="-1"></aside>';
  document.body.appendChild(ov);
  // la ayuda del "?" se cierra al tocar cualquier otra parte del panel
  document.getElementById('st-log-panel').addEventListener('click', function(e){
    if(!e.target.closest('.nx-log-help') && !e.target.closest('.nx-log-q')) stLogAyuda(false);
  });
  return ov;
}
function stLogOpen(id){
  var a = (typeof getAnalyses === 'function' ? getAnalyses() : []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(!a) return;
  stLogId = a.id;
  var ov = stLogMontar();
  document.getElementById('st-log-panel').innerHTML = stLogHTML(a);
  if(typeof renderIcons === 'function') renderIcons(ov);
  ov.hidden = false;
  document.body.classList.add('nx-log-abierto');
  var pn = document.getElementById('st-log-panel'); if(pn) pn.focus({preventScroll:true});
}
function stLogClose(){
  var ov = document.getElementById('st-log');
  if(ov) ov.hidden = true;
  document.body.classList.remove('nx-log-abierto');
  stLogId = null;
}
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape' || stLogId == null) return;
  var h = document.getElementById('st-log-help');
  if(h && !h.hidden) stLogAyuda(false); else stLogClose();
});
// El "?": abre o cierra la explicacion (sin argumento = cambiar)
function stLogAyuda(abrir){
  var h = document.getElementById('st-log-help'), q = document.getElementById('st-log-q');
  if(!h) return;
  var ver = (abrir === true || abrir === false) ? abrir : h.hidden;
  h.hidden = !ver;
  if(q) q.setAttribute('aria-expanded', ver ? 'true' : 'false');
}

function stLogHTML(a){
  var o = stOrderOf(a), e = stExpected(a), ev = stEventos(a);
  var st = (typeof stState === 'function') ? stState(a) : '';
  var coa = stCoaEstado(a);
  var lot = (typeof analysisLot === 'function') ? analysisLot(a) : (a.lot || '');
  var chip = function(r, v){ return v ? '<span>'+r+' <b>'+esc(v)+'</b></span>' : ''; };
  var stTxt = {qa:['Pending QA lab', 'warn'], lab:['Pending lab', 'bad'], done:['Complete', 'ok']}[st] || ['—', ''];
  var expCard = !e ? '<b>—</b>'
    : '<b>'+esc(fmtDate(e.fecha))+'</b>'+(coa !== 'waiting' ? '' : '<em>'+
        (e.dias > 0 ? 'in '+e.dias+' day'+(e.dias === 1 ? '' : 's') : e.dias === 0 ? 'today' : Math.abs(e.dias)+' days late')+'</em>');
  var expTono = !e ? '' : coa !== 'waiting' ? 'ok' : e.dias < 0 ? 'bad' : e.dias === 0 ? 'warn' : '';
  var coaCard = coa === 'issued' ? ['<b>'+esc(a.coaNo)+(a.coaRev ? ' R'+esc(a.coaRev) : '')+'</b><em>'+esc(stCuando(a.coaAt))+'</em>', 'ok']
              : coa === 'ready'  ? ['<b>Ready to issue</b>', 'ok']
              : ['<b>Not ready</b><em>'+esc((typeof coaMissing === 'function') ? coaMissing(a) : '')+'</em>', ''];

  // Lo que se puede hacer con el certificado: solo los botones. Lo que lo
  // explica va detras del "?" (pedido del usuario, 11 nov 2026: minimalismo)
  var acciones = '', ayudaCoa;
  if(coa === 'issued'){
    acciones = '<button class="nx-log-btn pri" type="button" onclick="stLogDescargar('+a.id+')"><span data-icon="download"></span>Download COA</button>'+
      '<button class="nx-log-btn" type="button" onclick="reprintCoa('+a.id+')"><span data-icon="pdf"></span>PDF</button>';
    ayudaCoa = 'The COA is ready. Download the customer’s form or the PDF.';
  } else if(coa === 'ready'){
    acciones = '<button class="nx-log-btn pri" type="button" onclick="stLogEmitir('+a.id+')"><span data-icon="pdf"></span>Issue COA</button>';
    ayudaCoa = 'Everything is in. Issue the certificate and it downloads right away.';
  } else {
    ayudaCoa = 'The COA is not ready yet. '+((typeof coaMissing === 'function') ? 'Missing: '+coaMissing(a)+'. ' : '')+
      'It will download from here once it is issued.';
  }
  var ayuda = '<div class="nx-log-help" id="st-log-help" role="note" hidden>'+
      '<p><b>COA</b>'+esc(ayudaCoa)+'</p>'+
      (e ? '<p><b>Expected</b>5 days after the '+(e.deOrden ? 'order was created' : 'sample date')+'.'+
        (e.porMuestra ? ' Order '+esc(o.order)+' is made over several days, so it counts from the day this sample was made.' : '')+
        (!o && a.order ? ' Order '+esc(a.order)+' is not in COA Orders, so its creation date is unknown.' : '')+'</p>' : '')+
      '<div class="nx-log-ley"><span class="ok">Done</span><span class="pend">Waiting</span><span class="late">Late</span></div>'+
    '</div>';

  var item = function(x, pend, n){
    var cls = pend ? (x.tarde ? 'pend late' : 'pend') : (x.warn ? 'warn' : (x.ok ? 'ok' : ''));
    var det = (x.d || []).filter(Boolean).map(function(s){ return '<span>'+esc(s)+'</span>'; }).join('');
    var meta = pend ? '' : [stCuando(x.at), x.by ? 'by '+x.by : ''].filter(Boolean).join(' · ');
    // --i: el destello baja en ola, un icono tras otro
    return '<li class="'+cls+'" style="--i:'+(n || 0)+'"><span class="nx-tl-dot"><span data-icon="'+x.icon+'"></span></span>'+
      '<div class="nx-tl-t">'+esc(x.t)+'</div>'+
      (meta ? '<div class="nx-tl-m">'+esc(meta)+'</div>' : '')+
      (det ? '<div class="nx-tl-d">'+det+'</div>' : '')+'</li>';
  };

  return '<header class="nx-log-head">'+
      '<div class="nx-log-who">'+
        '<div class="nx-log-eyebrow">Sample log'+(a.seq ? ' · #'+esc(a.seq) : '')+'</div>'+
        '<h2 id="st-log-t">'+esc(a.product || '—')+(a.cheese ? ' <small>'+esc(a.cheese)+'</small>' : '')+'</h2>'+
        '<div class="nx-log-chips">'+chip('LOT', lot)+chip('Customer', a.customer)+chip('PO', a.po)+chip('Order', a.order)+'</div>'+
      '</div>'+
      '<div class="nx-log-tools">'+
        '<button class="nx-log-q" id="st-log-q" type="button" onclick="stLogAyuda()" aria-label="What does this mean?" '+
          'aria-expanded="false" aria-controls="st-log-help">?</button>'+
        '<button class="nx-log-x" type="button" onclick="stLogClose()" aria-label="Close the log">×</button>'+
      '</div>'+
      ayuda+
    '</header>'+
    '<div class="nx-log-body">'+
      '<div class="nx-log-sum">'+
        '<div class="nx-log-card '+stTxt[1]+'"><small>Status</small><b>'+stTxt[0]+'</b></div>'+
        '<div class="nx-log-card '+expTono+'"><small>Expected</small>'+expCard+'</div>'+
        '<div class="nx-log-card '+coaCard[1]+'"><small>COA</small>'+coaCard[0]+'</div>'+
      '</div>'+
      (acciones ? '<div class="nx-log-coa">'+acciones+'</div>' : '')+
      '<div class="nx-log-h">Timeline</div>'+
      '<ol class="nx-tl">'+(ev.hechos.length ? ev.hechos.map(function(x, n){ return item(x, false, n); }).join('')
                                             : '<li class="pend"><div class="nx-tl-t">No events yet</div></li>')+'</ol>'+
      (ev.falta.length ? '<div class="nx-log-h">Still to come</div><ol class="nx-tl">'+
        ev.falta.map(function(x, n){ return item(x, true, n); }).join('')+'</ol>' : '')+
    '</div>';
}

// El COA del cliente (su forma llena); si la plantilla falla, la vista PDF
function stLogDescargar(id){
  var a = (getDB().analysis || []).filter(function(x){ return x.id === id; })[0];
  if(!a) return;
  if(typeof downloadCoaXlsx !== 'function'){ reprintCoa(id); return; }
  toast('Preparing the COA…');
  downloadCoaXlsx(a).catch(function(e){
    toast('The customer form could not be filled: opening the PDF');
    reprintCoa(id);
  });
}
function stLogEmitir(id){
  if(typeof issueOne !== 'function') return;
  issueOne(id);
  setTimeout(function(){
    if(typeof renderCoaStatus === 'function') renderCoaStatus();
    if(stLogId != null) stLogOpen(id);
  }, 500);
}
