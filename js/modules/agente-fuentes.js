// ===== EL ASISTENTE: LO QUE SABE DE CADA MODULO =====
// Pedido del usuario (20 nov 2026): un agente que sepa todo lo del sistema y
// conteste desde la app, sin conexiones externas (fase 1). En la fase 2 una IA
// solo TRADUCIRA la pregunta a la misma orden que arma js/modules/agente-entender.js;
// los datos nunca salen: los busca y los muestra este archivo, en el equipo.
//
// La orden (consulta) es siempre la misma forma, para todo el sistema:
//   {fuente, accion, filtros:{linea, turno, desde, hasta, producto, lot, orden,
//    cliente, estado}, campo, limite, lang}
//   accion: ultimo | lista | contar | porcentaje | promedio | sumar | peor | mejor
// Cada fuente dice de donde salen sus registros, como se lee su fecha, linea,
// turno, producto, LOT, resultado... y como se abre el registro.
// Solo lee: el asistente no cambia nada. Y solo busca en lo que el rol ve.

// ---- Textos en los dos idiomas (contesta en el de la pregunta) ----
var agLang = 'en';
function agT(es, en){ return agLang === 'es' ? es : en; }

// ---- Lectura comun ----
function agN(s){
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9#%\/\.\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function agDia(v){ var s = String(v == null ? '' : v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; }
function agLinea(v){
  var s = String(v == null ? '' : v);
  if(/chop/i.test(s)) return 'chopped';
  if(/fork/i.test(s)) return 'forklift';
  var m = /\d+/.exec(s);
  return m ? String(+m[0]) : '';
}
function agLineaTxt(l){
  if(!l) return '—';
  if(l === 'chopped') return agT('Área de chopped', 'Chopped area');
  if(l === 'forklift') return 'Forklift';
  return agT('Línea ', 'Line ') + l;
}
function agTurnoTxt(t){ return String(t) === '1' ? agT('1er turno', '1st shift') : String(t) === '2' ? agT('2º turno', '2nd shift') : '—'; }
function agLotLimpio(v){ return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function agFecha(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString(agLang === 'es' ? 'es-US' : 'en-US', {month:'short', day:'numeric', year:'numeric'});
}
function agHora12(h){ return (typeof opsHora12 === 'function' && h) ? opsHora12(h) : (h || ''); }
// "hace 3 dias", "today"
function agHace(iso){
  var d = agDia(iso);
  if(!d) return '';
  var dias = Math.round((new Date(localDateStr() + 'T12:00:00') - new Date(d + 'T12:00:00')) / 864e5);
  if(dias <= 0) return agT('hoy', 'today');
  if(dias === 1) return agT('ayer', 'yesterday');
  return agT('hace ' + dias + ' días', dias + ' days ago');
}
// Respuestas si / no de una forma: los NO son los que fallaron
function agNos(r){
  var a = r.answers;
  var vals = Array.isArray(r.items) ? r.items : (a && typeof a === 'object') ? Object.keys(a).map(function(k){ return a[k]; }) : [];
  return vals.filter(function(v){ return String(v).toLowerCase() === 'no' || String(v).toLowerCase() === 'fail'; }).length;
}
function agTieneRespuestas(r){
  return (Array.isArray(r.items) && r.items.length) || (r.answers && typeof r.answers === 'object' && Object.keys(r.answers).length);
}
function agEsc(s){ return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s); }
function agNum(v){ var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; }
function agFmt(n, dec){
  if(n == null || isNaN(n)) return '—';
  var d = dec == null ? (Math.abs(n) >= 100 ? 0 : 2) : dec;
  return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-US');
}
// Fuera de los rangos de laboratorio del producto
function agFueraLab(a){
  var p = (typeof findProduct === 'function') ? findProduct(a.product) : null;
  var t = p && p.labTargets;
  if(!t) return [];
  var out = [];
  ['moisture', 'fat', 'ph'].forEach(function(k){
    var v = agNum(a[k]), r = t[k];
    if(v == null || !r) return;
    if((r.min != null && v < r.min) || (r.max != null && v > r.max)) out.push(k);
  });
  return out;
}
var AG_CAMPO = {
  moisture:['Humedad', 'Moisture'], fat:['Grasa', 'Fat'], ph:['pH', 'pH'], yeast:['Levadura', 'Yeast'], mold:['Moho', 'Mold'],
  temp:['Temperatura', 'Temperature'], humidity:['Humedad relativa', 'Humidity'], avg:['Peso promedio', 'Average weight'],
  compliance:['Cumplimiento', 'Compliance'], cases:['Cajas', 'Cases'], lbs:['Libras', 'Lbs'], minutes:['Minutos', 'Minutes']
};
function agCampoTxt(k){ var x = AG_CAMPO[k]; return x ? agT(x[0], x[1]) : k; }
var AG_ESTADO = {
  pass:['pasó', 'passed'], fail:['falló', 'failed'], open:['abierto', 'open'], closed:['cerrado', 'closed'],
  overdue:['vencido', 'overdue'], hold:['en hold', 'on hold'], released:['liberado', 'released'], issue:['con issue', 'with an issue'],
  pending:['pendiente', 'pending'], done:['completo', 'done'], absent:['ausente', 'absent'], late:['tarde', 'late'],
  present:['presente', 'present'], down:['parada ahora', 'down now'], coa:['con COA', 'with COA'], cancelled:['cancelada', 'cancelled'],
  sincoa:['sin COA', 'without COA'], ready:['para leer', 'ready to read'], waiting:['esperando', 'waiting'], unplated:['sin placa', 'not plated'],
  left:['se fue antes', 'left early'], excused:['excusado', 'excused']
};
function agEstadoTxt(k){ var x = AG_ESTADO[k]; return x ? agT(x[0], x[1]) : k; }

// ------------------------------------------------------------------
// LAS FUENTES
// ------------------------------------------------------------------
function agCol(c){ var db = getDB() || {}; return db[c] || []; }
var AG_FUENTES = [
  {k:'weights', es:'Pesos', en:'Weights', pantalla:'screen-weight', mod:'qa', serie:true,
   lista:function(){ return agCol('weights'); },
   fecha:function(r){ return agDia(r.date); }, hora:function(r){ return r.time || String(r.date || '').slice(11, 16); },
   linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ if(r.issue) return 'issue'; if(r.pass == null || !r.total) return ''; return r.pass >= r.total ? 'pass' : 'fail'; },
   numero:function(r, c){ if(c === 'compliance') return r.total ? r.pass / r.total * 100 : null; return agNum(r.avg); },
   campoDef:'avg',
   // el cumplimiento de los pesos es por MUESTRA, no por revision
   pct:function(l){ var ok = 0, n = 0; l.forEach(function(r){ if(r.pass != null && r.total){ ok += +r.pass; n += +r.total; } }); return {ok:ok, n:n}; },
   titulo:function(r){ return agLineaTxt(agLinea(r.line)) + ' · ' + (r.product || '—'); },
   campos:function(r){
     if(r.issue) return [[agT('Estado de la línea', 'Line status'), r.issue], [agT('Comentario', 'Comment'), r.comments]];
     return [[agT('Producto', 'Product'), (r.product || '') + (r.productName ? ' · ' + r.productName : '')], ['LOT', r.lot],
       [agT('Promedio', 'Average'), r.avg != null ? agFmt(r.avg, 3) + ' ' + (r.unit || '') : ''],
       [agT('Muestras en rango', 'Samples in range'), r.pass != null ? r.pass + ' / ' + r.total : agT('sin rango', 'no target')],
       [agT('Iniciales', 'Initials'), r.initials || r.operator], [agT('Comentario', 'Comment'), r.comments]];
   },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Product', function(r){ return r.product; }],
     ['Avg', function(r){ return r.issue ? r.issue : agFmt(r.avg, 3); }], ['OK', function(r){ return r.pass != null ? r.pass + '/' + r.total : '—'; }]],
   ver:function(r){ if(typeof viewWeightRecord === 'function') viewWeightRecord(r.id); }},

  {k:'seals', es:'Sellado de bolsas', en:'Seal bags', pantalla:'screen-seal', mod:'qa', serie:true,
   lista:function(){ return agCol('seals'); },
   fecha:function(r){ return agDia(r.date); }, hora:function(r){ return r.time || String(r.date || '').slice(11, 16); },
   linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ var c = r.checks || {}, ks = Object.keys(c); if(!ks.length) return ''; return ks.some(function(k){ return c[k] === 'fail'; }) ? 'fail' : 'pass'; },
   titulo:function(r){ return agLineaTxt(agLinea(r.line)) + ' · ' + (r.product || '—'); },
   campos:function(r){
     var c = r.checks || {};
     return [[agT('Producto', 'Product'), r.product], ['LOT', r.lot]].concat(Object.keys(c).map(function(k){ return [k, c[k] === 'fail' ? '✕ fail' : '✓ pass']; }))
       .concat([[agT('Iniciales', 'Initials'), r.initials || r.operator]]);
   },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Product', function(r){ return r.product; }],
     ['Result', function(r){ var c = r.checks || {}; var f = Object.keys(c).filter(function(k){ return c[k] === 'fail'; }); return f.length ? '✕ ' + f.join(', ') : '✓'; }]],
   ver:function(r){ if(typeof viewSealRecord === 'function') viewSealRecord(r.id); }},

  {k:'temps', es:'Temperaturas', en:'Temperatures', pantalla:'screen-temp', mod:'qa', serie:true,
   lista:function(){ return agCol('temps'); },
   fecha:function(r){ return agDia(r.date); }, hora:function(r){ return r.time || ''; },
   turno:function(r){ return r.shift; },
   numero:function(r, c){ return agNum(c === 'humidity' ? r.humidity : r.temp); }, campoDef:'temp',
   titulo:function(r){
     var cp = {begin:agT('Inicio', 'Beginning'), mid:agT('Mitad', 'Middle'), end:agT('Final', 'End'), 1:agT('Inicio', 'Beginning'), 2:agT('Mitad', 'Middle'), 3:agT('Final', 'End')}[r.checkpoint] || r.checkpoint || '';
     return agT('Temperatura · ', 'Temperature · ') + cp + ' · ' + agTurnoTxt(r.shift);
   },
   campos:function(r){
     var out = [];
     [['temp', agT('Temperatura', 'Temperature')], ['humidity', agT('Humedad', 'Humidity')], ['chop', 'Chopped'], ['plat', agT('Plataforma', 'Platform')],
      ['line6', agT('Línea 6', 'Line 6')], ['area', agT('Área', 'Area')], ['comments', agT('Comentario', 'Comment')], ['completedBy', agT('Hecho por', 'Done by')], ['operator', agT('Hecho por', 'Done by')]]
       .forEach(function(x){ if(r[x[0]] != null && r[x[0]] !== '') out.push([x[1], r[x[0]]]); });
     return out;
   },
   columnas:[['Checkpoint', function(r){ return r.checkpoint; }], ['Shift', function(r){ return agTurnoTxt(r.shift); }], ['Temp', function(r){ return r.temp; }]],
   ver:function(r){ if(typeof viewTempRecord === 'function') viewTempRecord(r.id); }},

  {k:'gmps', es:'Auditoría GMP', en:'GMP audit', pantalla:'screen-gmp', mod:'qa', serie:true,
   lista:function(){ return agCol('gmps'); },
   fecha:function(r){ return agDia(r.date); }, turno:function(r){ return r.shift; },
   estado:function(r){ if(!agTieneRespuestas(r)) return ''; return agNos(r) ? 'fail' : 'pass'; },
   titulo:function(r){ return 'GMP · ' + agTurnoTxt(r.shift) + (r.location ? ' · ' + r.location : ''); },
   campos:function(r){ return [[agT('Respuestas NO', 'NO answers'), agNos(r)], [agT('Ubicación', 'Location'), r.location],
     [agT('Hecho por', 'Completed by'), r.completedBy || r.operator], [agT('Verificó', 'Verified by'), r.verifiedBy], [agT('Comentarios', 'Comments'), r.comments]]; },
   columnas:[['Shift', function(r){ return agTurnoTxt(r.shift); }], ['NO', function(r){ return agNos(r); }], ['By', function(r){ return r.completedBy || r.operator; }]]},

  {k:'metal', es:'Detector de metales', en:'Metal detector', pantalla:'screen-metal', mod:'qa', serie:true,
   lista:function(){ return agCol('metal'); },
   fecha:function(r){ return agDia(r.date); }, hora:function(r){ return r.startTime || ''; },
   linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   estado:function(r){ if(!agTieneRespuestas(r)) return ''; return agNos(r) ? 'fail' : 'pass'; },
   titulo:function(r){ return agT('Detector de metales · ', 'Metal detector · ') + agLineaTxt(agLinea(r.line)); },
   campos:function(r){
     var n = agNos(r);
     return [[agT('Resultado', 'Result'), n ? '✕ ' + n + agT(' respuesta(s) NO', ' NO answer(s)') : agT('✓ todo pasó', '✓ all passed')],
       [agT('Hora', 'Time'), (agHora12(r.startTime) || '') + (r.endTime ? ' – ' + agHora12(r.endTime) : '')],
       [agT('Línea / MD', 'Line / MD'), r.line], [agT('Acción correctiva', 'Corrective action'), r.corrective],
       [agT('Hecho por', 'Completed by'), r.completedBy], [agT('Verificó', 'Verified by'), r.verifiedBy]];
   },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Result', function(r){ return agNos(r) ? '✕ ' + agNos(r) + ' NO' : '✓'; }], ['By', function(r){ return r.completedBy; }]],
   ver:function(r){ if(typeof viewMetalRecord === 'function') viewMetalRecord(r.id); }},

  {k:'preop', es:'Pre-Op', en:'Pre-Op', pantalla:'screen-preop', mod:'qa', serie:true,
   lista:function(){ return agCol('preop'); },
   fecha:function(r){ return agDia(r.date); }, turno:function(r){ return r.shift; },
   estado:function(r){ if(!agTieneRespuestas(r)) return ''; return agNos(r) ? 'fail' : 'pass'; },
   titulo:function(r){ return 'Pre-Op · ' + (r.area || ''); },
   campos:function(r){ return [[agT('Respuestas NO', 'NO answers'), agNos(r)], [agT('Hecho por', 'Completed by'), r.completedBy],
     [agT('Verificó', 'Verified by'), r.verifiedBy], [agT('Comentarios', 'Comments'), r.comments]]; },
   columnas:[['Area', function(r){ return r.area; }], ['NO', function(r){ return agNos(r); }], ['By', function(r){ return r.completedBy; }]],
   ver:function(r){ if(typeof viewPreopRecord === 'function') viewPreopRecord(r.id); }},

  {k:'capa', es:'CAPA', en:'CAPA', pantalla:'screen-capa', mod:'qa', serie:false,
   lista:function(){ return typeof getCapa === 'function' ? getCapa() : agCol('capa'); },
   fecha:function(r){ return agDia(r.capaDate || r.createdAt); },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ return String(r.status || '').toLowerCase() === 'closed' ? 'closed' : 'open'; },
   vencido:function(r){ return typeof capaOverdue === 'function' && String(r.status) !== 'closed' && capaOverdue(r); },
   titulo:function(r){ return 'CAPA ' + (r.reportNumber || ''); },
   campos:function(r){ return [[agT('Problema', 'Problem'), r.problem], [agT('Severidad', 'Severity'), r.severity],
     [agT('Estado', 'Status'), (r.status || '') + (this.vencido(r) ? agT(' · vencido', ' · overdue') : '')],
     [agT('Producto', 'Product'), r.product], ['LOT', r.lot], [agT('Hecho por', 'Completed by'), r.completedBy]]; },
   columnas:[['Report', function(r){ return r.reportNumber; }], ['Problem', function(r){ return r.problem; }], ['Status', function(r){ return r.status; }]],
   ver:function(r){ if(typeof viewCapaReport === 'function') viewCapaReport(r.id); }},

  {k:'holds', es:'Holds', en:'Holds', pantalla:'screen-hold', mod:'qa', serie:false,
   lista:function(){ return typeof getHolds === 'function' ? getHolds() : agCol('holds'); },
   fecha:function(r){ return agDia(r.createdAt || r.date); },
   linea:function(r){ return agLinea(r.line); }, producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ var s = String(r.status || '').toLowerCase(); return s === 'hold' ? 'hold' : s === 'released' ? 'released' : s; },
   titulo:function(r){ return 'Hold ' + (r.caseNumber || r.holdNumber || ''); },
   campos:function(r){ return [[agT('Producto', 'Product'), r.product], ['LOT', r.lot], [agT('Cantidad', 'Quantity'), r.quantity],
     [agT('Motivo', 'Reason'), r.reason], [agT('Estado', 'Status'), r.status], [agT('Inició', 'Initiated by'), r.initiatedBy]]; },
   columnas:[['Case', function(r){ return r.caseNumber || r.holdNumber; }], ['Product', function(r){ return r.product; }], ['Status', function(r){ return r.status; }]],
   ver:function(r){ if(typeof viewHoldCase === 'function') viewHoldCase(r.id); }},

  {k:'shifts', es:'Shift reports', en:'Shift reports', pantalla:'screen-shift', mod:'qa', serie:false,
   lista:function(){ return typeof getShifts === 'function' ? getShifts() : agCol('shifts'); },
   fecha:function(r){ return agDia(r.date); }, linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ var s = String(r.status || ''); return s === 'resolved' ? 'closed' : s === 'na' ? '' : 'open'; },
   titulo:function(r){ return (r.reportNumber || 'Shift report') + (r.area ? ' · ' + r.area : ''); },
   campos:function(r){ return [[agT('Categoría', 'Category'), r.category], [agT('Qué pasó', 'What happened'), r.notes], [agT('Acción', 'Action'), r.action],
     [agT('Estado', 'Status'), typeof shiftStatusLabel === 'function' ? shiftStatusLabel(r.status) : r.status], [agT('Reportó', 'Reported by'), r.reportedBy]]; },
   columnas:[['Report', function(r){ return r.reportNumber; }], ['Area', function(r){ return r.area; }], ['Status', function(r){ return r.status; }]],
   ver:function(r){ if(typeof viewShiftReport === 'function') viewShiftReport(r.id); }},

  {k:'runs', es:'Production schedule', en:'Production schedule', pantalla:'screen-production', mod:'production', serie:true,
   lista:function(){ return agCol('runs'); },
   fecha:function(r){ return agDia(r.date); }, linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; },
   estado:function(r){ return r.cancelled ? 'cancelled' : r.collected ? 'done' : 'pending'; },
   titulo:function(r){ return agLineaTxt(agLinea(r.line)) + ' · ' + (r.product || '') + (r.productName ? ' · ' + r.productName : ''); },
   campos:function(r){ return [[agT('Turno', 'Shift'), agTurnoTxt(r.shift)], ['LOT', r.lot], [agT('Muestras de lab', 'Lab samples'), r.labSamples],
     [agT('Recogida', 'Collected'), r.collected ? '✓' : '—'], [agT('Enviada al lab', 'Sent to lab'), r.labSent ? '✓' : '—'], [agT('Cancelada', 'Cancelled'), r.cancelled ? '✓' : '']]; },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Product', function(r){ return r.product; }], ['LOT', function(r){ return r.lot; }]]},

  {k:'analysis', es:'Sample analysis', en:'Sample analysis', pantalla:'screen-analysis', mod:'lab', serie:true,
   lista:function(){ return typeof getAnalyses === 'function' ? getAnalyses() : agCol('analysis'); },
   fecha:function(r){ return agDia(r.prodDate || r.date); }, linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return typeof analysisLot === 'function' ? analysisLot(r) : r.lot; },
   orden:function(r){ return r.order; }, po:function(r){ return r.po; }, cliente:function(r){ return r.customerKey || ''; },
   estado:function(r){
     if(r.coaNo) return 'coa';
     var tiene = ['moisture', 'fat', 'ph'].some(function(k){ return String(r[k] || '').trim(); });
     if(!tiene) return 'pending';
     return agFueraLab(r).length ? 'fail' : 'pass';
   },
   numero:function(r, c){ return agNum(r[c || 'moisture']); }, campoDef:'moisture',
   titulo:function(r){ return '#' + (r.seq || '') + ' · ' + (r.product || '') + (r.cheese ? ' · ' + r.cheese : ''); },
   campos:function(r){
     var f = agFueraLab(r);
     var pr = typeof findProduct === 'function' ? findProduct(r.product) : null, lt = (pr && pr.labTargets) || {};
     var rango = function(k){ var x = lt[k]; return x ? ' (' + [x.min, x.max].map(function(v){ return v == null ? '' : v; }).join(' – ') + ')' : ''; };
     var v = function(k){ return r[k] ? r[k] + (f.indexOf(k) >= 0 ? agT(' ✕ fuera de rango', ' ✕ out of range') + rango(k) : '') : ''; };
     return [[agT('Cliente', 'Customer'), r.customer], ['LOT', this.lot(r)], ['Order / PO', [r.order, r.po].filter(Boolean).join(' / ')],
       [agT('Humedad', 'Moisture'), v('moisture')], [agT('Grasa', 'Fat'), v('fat')], ['pH', v('ph')],
       [agT('Levadura / moho', 'Yeast / mold'), [r.yeast, r.mold].filter(Boolean).join(' / ')], ['COA', r.coaNo]];
   },
   columnas:[['#', function(r){ return r.seq; }], ['Product', function(r){ return r.product; }], ['Moist.', function(r){ return r.moisture; }],
     ['Fat', function(r){ return r.fat; }], ['pH', function(r){ return r.ph; }]],
   ver:function(r){ if(typeof viewAnalysisRecord === 'function') viewAnalysisRecord(r.id); }},

  // Las placas de levadura y moho: se leen 5 dias despues del test (js/modules/yeast.js)
  {k:'plates', es:'Placas (Yeast & Mold)', en:'Plates (Yeast & Mold)', pantalla:'screen-yeast', mod:'lab', serie:true,
   lista:function(){
     var l = typeof getAnalyses === 'function' ? getAnalyses() : agCol('analysis');
     return l.filter(function(a){ return typeof ymPlateDay === 'function' && ymPlateDay(a) && (typeof ymPlate !== 'function' || ymPlate(a.product) !== false); });
   },
   fecha:function(r){ return typeof ymDueDate === 'function' ? ymDueDate(r) : ''; },
   producto:function(r){ return r.product; }, lot:function(r){ return typeof analysisLot === 'function' ? analysisLot(r) : r.lot; },
   cliente:function(r){ return r.customerKey || ''; },
   estado:function(r){ return typeof ymState === 'function' ? ymState(r) : ''; },
   numero:function(r, c){ return agNum(r[c === 'mold' ? 'mold' : 'yeast']); }, campoDef:'yeast',
   titulo:function(r){ return '#' + (r.seq || '') + ' · ' + (r.product || '') + (r.cheese ? ' · ' + r.cheese : ''); },
   campos:function(r){ return [[agT('Se lee', 'Read on'), agFecha(this.fecha(r))], [agT('Placa del', 'Plated'), agFecha(typeof ymPlateDay === 'function' ? ymPlateDay(r) : '')],
     ['LOT', this.lot(r)], [agT('Cliente', 'Customer'), r.customer], [agT('Levadura', 'Yeast'), r.yeast], [agT('Moho', 'Mold'), r.mold]]; },
   columnas:[['#', function(r){ return r.seq; }], ['Product', function(r){ return r.product; }], ['Y / M', function(r){ return [r.yeast, r.mold].filter(Boolean).join(' / ') || '—'; }]],
   ver:function(r){ if(typeof viewAnalysisRecord === 'function') viewAnalysisRecord(r.id); }},

  {k:'raw', es:'Raw analysis', en:'Raw analysis', pantalla:'screen-raw', mod:'lab', serie:true,
   lista:function(){ return agCol('raw'); },
   fecha:function(r){ return agDia(r.date); }, lot:function(r){ return r.lot || r.code; },
   numero:function(r, c){ return agNum(r[c || 'moisture']); }, campoDef:'moisture',
   titulo:function(r){ return (r.sample || r.code || '') + (r.material ? ' · ' + r.material : ''); },
   campos:function(r){
     var out = [];
     [['section', agT('Sección', 'Section')], ['supplier', agT('Proveedor', 'Supplier')], ['code', agT('Código', 'Code')], ['moisture', agT('Humedad', 'Moisture')],
      ['fat', agT('Grasa', 'Fat')], ['ph', 'pH'], ['yeast', agT('Levadura', 'Yeast')], ['mold', agT('Moho', 'Mold')], ['notes', agT('Notas', 'Notes')]]
       .forEach(function(x){ if(r[x[0]] != null && String(r[x[0]]).trim()) out.push([x[1], r[x[0]]]); });
     return out;
   },
   columnas:[['Sample', function(r){ return r.sample || r.code; }], ['Material', function(r){ return r.material; }], ['Moist.', function(r){ return r.moisture; }]]},

  {k:'orders', es:'COA orders', en:'COA orders', pantalla:'screen-orders', mod:'production', serie:false,
   lista:function(){ return typeof getOrders === 'function' ? getOrders() : agCol('orders'); },
   fecha:function(r){ return agDia(r.prodDate || r.createdAt); }, lot:function(r){ return r.lot; },
   orden:function(r){ return r.order; }, po:function(r){ return r.po; }, cliente:function(r){ return r.customerKey || ''; },
   producto:function(r){ return (r.products || []).join(' '); },
   estado:function(r){ if(r.closed) return 'closed'; var p = typeof orProgreso === 'function' ? orProgreso(r) : null; return p && p.completa ? 'done' : 'open'; },
   titulo:function(r){ return 'Order ' + (r.order || '') + (r.po ? ' · PO ' + r.po : ''); },
   campos:function(r){
     var p = typeof orProgreso === 'function' ? orProgreso(r) : null;
     return [[agT('Cliente', 'Customer'), r.customer], [agT('Productos', 'Products'), (r.products || []).join(', ')], ['LOT', r.lot],
       [agT('Producción', 'Production'), typeof orFechasTexto === 'function' ? orFechasTexto(r) : r.prodDate],
       [agT('Testeados', 'Tested'), p ? p.hechos + ' / ' + p.total : '']];
   },
   columnas:[['Order', function(r){ return r.order; }], ['PO', function(r){ return r.po; }], ['Products', function(r){ return (r.products || []).length; }]]},

  {k:'attendance', es:'Asistencia', en:'Attendance', pantalla:'screen-attendance', mod:'operations', serie:true,
   lista:function(){ return agCol('attendance').filter(function(r){ return r.status; }); },
   fecha:function(r){ return agDia(r.date); }, turno:function(r){ return r.shift; },
   linea:function(r){ return typeof attLineaDe === 'function' ? agLinea(attLineaDe(r)) : agLinea(r.line); },
   estado:function(r){ return r.status; },
   titulo:function(r){ return r.name || ''; },
   campos:function(r){ return [[agT('Estado', 'Status'), agEstadoTxt(r.status)], [agT('Entrada / salida', 'In / out'), [agHora12(r.timeIn), agHora12(r.timeOut)].filter(Boolean).join(' – ')],
     [agT('Área', 'Area'), r.area], ['#', r.empNo], [agT('Nota', 'Note'), r.notes]]; },
   columnas:[['Name', function(r){ return r.name; }], ['Status', function(r){ return agEstadoTxt(r.status); }], ['Area', function(r){ return r.area; }]]},

  {k:'output', es:'Output (producción)', en:'Output', pantalla:'screen-output', mod:'operations', serie:true,
   lista:function(){ return agCol('output'); },
   fecha:function(r){ return agDia(r.date); }, linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   producto:function(r){ return r.product; }, lot:function(r){ return r.lot; }, orden:function(r){ return r.order; },
   estado:function(r){ return r.completed ? 'done' : 'open'; },
   numero:function(r, c){ if(c === 'lbs') return typeof outLbs === 'function' ? outLbs(r) : null; return typeof outCases === 'function' ? outCases(r) : agNum(r.produced); },
   campoDef:'cases', suma:true,
   titulo:function(r){ return agLineaTxt(agLinea(r.line)) + ' · ' + (r.product || ''); },
   campos:function(r){ return [[agT('Producto', 'Product'), (r.product || '') + (r.productName ? ' · ' + r.productName : '')],
     [agT('Ordenado', 'Ordered'), r.ordered ? r.ordered + ' ' + (r.unit || '') : ''], [agT('Producido', 'Produced'), r.produced ? r.produced + ' ' + (r.unit || '') : ''],
     [agT('Cajas', 'Cases'), agFmt(this.numero(r, 'cases'), 0)], ['LOT', r.lot], ['Order', r.order], [agT('Completa', 'Completed'), r.completed ? '✓' : '—']]; },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Product', function(r){ return r.product; }], ['Cases', function(r){ return agFmt(typeof outCases === 'function' ? outCases(r) : null, 0); }]]},

  {k:'downtime', es:'Downtime (paros)', en:'Downtime', pantalla:'screen-downtime', mod:'operations', serie:true,
   lista:function(){ return agCol('downtime'); },
   fecha:function(r){ return agDia(r.date); }, hora:function(r){ return r.start || ''; },
   linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; }, producto:function(r){ return r.product; },
   estado:function(r){ return !r.end ? 'down' : 'closed'; },
   numero:function(r){ return typeof dtMinutos === 'function' ? dtMinutos(r) : null; }, campoDef:'minutes', suma:true,
   titulo:function(r){ return agLineaTxt(agLinea(r.line)) + ' · ' + (r.cause || ''); },
   campos:function(r){ return [[agT('Causa', 'Cause'), r.cause], [agT('Hora', 'Time'), agHora12(r.start) + (r.end ? ' – ' + agHora12(r.end) : agT(' · sigue parada', ' · still down'))],
     [agT('Minutos', 'Minutes'), this.numero(r)], [agT('Qué pasó', 'What happened'), r.what], [agT('Qué se hizo', 'Action'), r.action], [agT('Arregló', 'Fixed by'), r.fixedBy]]; },
   columnas:[['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Cause', function(r){ return r.cause; }], ['Min', function(r){ return typeof dtMinutos === 'function' ? dtMinutos(r) : ''; }]]},

  {k:'employees', es:'Empleados', en:'Employees', pantalla:'screen-attendance', mod:'operations', serie:false,
   lista:function(){ return agCol('employees').filter(function(e){ return e.active !== false; }); },
   linea:function(r){ return agLinea(r.line); }, turno:function(r){ return r.shift; },
   titulo:function(r){ return r.name || ''; },
   campos:function(r){ return [['#', r.empNo], [agT('Turno', 'Shift'), r.shift === 'any' ? agT('Los dos', 'Both') : agTurnoTxt(r.shift)],
     [agT('Línea', 'Line'), agLineaTxt(agLinea(r.line))], [agT('Área', 'Area'), r.area]]; },
   columnas:[['Name', function(r){ return r.name; }], ['Line', function(r){ return agLineaTxt(agLinea(r.line)); }], ['Area', function(r){ return r.area; }]]},

  {k:'products', es:'Productos', en:'Products', pantalla:'screen-products', mod:'products', serie:false,
   lista:function(){ return typeof getProducts === 'function' ? getProducts() : agCol('products'); },
   producto:function(r){ return r.number; },
   cliente:function(r){ var c = typeof productCustomer === 'function' ? productCustomer(r) : null; return c && typeof custKey === 'function' ? custKey(c) : ''; },
   titulo:function(r){ return (r.number || '') + (r.name ? ' · ' + r.name : ''); },
   campos:function(r){
     var c = typeof productCustomer === 'function' ? productCustomer(r) : null, t = r.target, lt = r.labTargets || {};
     var rango = function(x){ return x ? [x.min, x.max].map(function(v){ return v == null ? '' : v; }).join(' – ') : ''; };
     return [[agT('Tamaño', 'Size'), r.pkgLabel], [agT('Rango de peso', 'Weight range'), t ? t.min + ' – ' + t.max : ''], [agT('Bolsas por caja', 'Bags per case'), r.bagsPerCase],
       [agT('Cliente', 'Customer'), c ? c.company : ''], [agT('Humedad', 'Moisture'), rango(lt.moisture)], [agT('Grasa', 'Fat'), rango(lt.fat)], ['pH', rango(lt.ph)],
       [agT('Formato de LOT', 'LOT format'), typeof lotFormatoProducto === 'function' ? lotFormatoProducto(r).toUpperCase() : '']];
   },
   columnas:[['Number', function(r){ return r.number; }], ['Name', function(r){ return r.name; }], ['Size', function(r){ return r.pkgLabel; }]],
   ver:function(r){ if(typeof snavGo === 'function') snavGo('products', 'screen-products'); if(typeof openCatalogCard === 'function') setTimeout(function(){ openCatalogCard(r.number); }, 150); }}
];
function agFuente(k){ return AG_FUENTES.filter(function(f){ return f.k === k; })[0] || null; }
// ¿Puede verla este rol? (en cualquiera de los modulos donde esta su pantalla)
function agPuedeVer(f){ return typeof canSeeScreen !== 'function' || canSeeScreen(f.pantalla); }

// ------------------------------------------------------------------
// LA BUSQUEDA (siempre en el equipo)
// ------------------------------------------------------------------
function agTs(f, r){ return (f.fecha ? f.fecha(r) : '') + 'T' + ((f.hora && f.hora(r)) || String(r.createdAt || '').slice(11, 16) || '00:00'); }
function agFiltrar(f, q){
  var x = q.filtros || {};
  return f.lista().filter(function(r){
    if(!r) return false;
    if((x.desde || x.hasta) && f.fecha){
      var d = f.fecha(r);
      if(!d || (x.desde && d < x.desde) || (x.hasta && d > x.hasta)) return false;
    }
    if(x.linea && (!f.linea || f.linea(r) !== x.linea)) return false;
    if(x.turno && (!f.turno || String(f.turno(r)) !== String(x.turno))) return false;
    if(x.producto){
      if(!f.producto) return false;
      var p = String(f.producto(r) || '');
      var n = typeof normNumber === 'function' ? normNumber : function(v){ return String(v).toUpperCase(); };
      if(p.split(/\s+/).map(n).indexOf(n(x.producto)) < 0 && agN(p).indexOf(agN(x.producto)) < 0) return false;
    }
    if(x.lot){
      if(!f.lot) return false;
      var l = agLotLimpio(f.lot(r)), b = agLotLimpio(x.lot);
      if(!l || (l !== b && l.indexOf(b) < 0)) return false;
    }
    if(x.orden){
      if(!f.orden) return false;
      var on = function(v){ return String(v || '').trim().toUpperCase().replace(/^0+(?=\d)/, ''); };
      if(on(f.orden(r)) !== on(x.orden)) return false;
    }
    if(x.cliente && (!f.cliente || f.cliente(r) !== x.cliente)) return false;
    if(x.po){
      if(!f.po) return false;
      if(String(f.po(r) || '').trim().toUpperCase() !== String(x.po).toUpperCase()) return false;
    }
    if(x.estado){
      if(x.estado === 'overdue'){ if(!f.vencido || !f.vencido(r)) return false; }
      else if(!f.estado || !agEstadoCoincide(f.estado(r), x.estado)) return false;
    }
    return true;
  }).sort(function(a, b){ return agTs(f, b).localeCompare(agTs(f, a)); });
}
// "Abierto" incluye lo que sigue pendiente (muestra sin resultados, corrida sin
// recoger, linea parada, producto en hold); "cerrado", lo hecho o liberado
function agEstadoCoincide(e, quiero){
  if(e === quiero) return true;
  if(quiero === 'sincoa') return e !== 'coa';
  if(quiero === 'open') return ['pending', 'down', 'hold'].indexOf(e) >= 0;
  if(quiero === 'closed') return ['done', 'released'].indexOf(e) >= 0;
  return false;
}
// El primer dia que hay en el equipo (para decir hasta donde se busco)
function agDesdeCuando(f){
  if(!f.fecha) return '';
  var min = '';
  f.lista().forEach(function(r){ var d = f.fecha(r); if(d && (!min || d < min)) min = d; });
  return min;
}

// Lo que contesta: {tipo:'tarjeta'|'tabla'|'numero'|'nada'|'sinPermiso', ...}
function agEjecutar(q){
  var f = agFuente(q.fuente);
  if(!f) return {tipo:'nada'};
  if(!agPuedeVer(f)) return {tipo:'sinPermiso', f:f};
  var l = agFiltrar(f, q);
  var base = {f:f, total:l.length, desde:agDesdeCuando(f)};
  if(!l.length) return Object.assign(base, {tipo:'nada'});
  var a = q.accion || 'lista';
  if(a === 'ultimo') return Object.assign(base, {tipo:'tarjeta', r:l[0]});
  // "por linea / por causa / cada dia": antes que el resto (tambien el total o el % por grupo)
  if(q.agrupar && a !== 'maximo' && a !== 'minimo') a = (a === 'sumar' || a === 'promedio') ? a : 'agrupar';
  if(a === 'agrupar' || (q.agrupar && (a === 'sumar' || a === 'promedio'))) return agAgrupar(f, l, q, a, base);
  if(a === 'contar'){
    var porEstado = {};
    if(f.estado) l.forEach(function(r){ var e = f.estado(r) || '—'; porEstado[e] = (porEstado[e] || 0) + 1; });
    return Object.assign(base, {tipo:'numero', valor:l.length, partes:porEstado, lista:l.slice(0, 5)});
  }
  if(a === 'porcentaje'){
    var pc = f.pct ? f.pct(l) : (function(){
      var ok = 0, n = 0;
      l.forEach(function(r){ var e = f.estado ? f.estado(r) : ''; if(e === 'pass' || e === 'fail'){ n++; if(e === 'pass') ok++; } });
      return {ok:ok, n:n};
    })();
    return Object.assign(base, {tipo:'numero', valor:pc.n ? pc.ok / pc.n * 100 : null, unidad:'%', ok:pc.ok, n:pc.n});
  }
  if(a === 'promedio' || a === 'sumar'){
    var c = q.campo || f.campoDef, vals = [];
    if(f.numero) l.forEach(function(r){ var v = f.numero(r, c); if(v != null && !isNaN(v)) vals.push(v); });
    if(!vals.length) return Object.assign(base, {tipo:'nada', sinNumeros:true});
    var suma = vals.reduce(function(s, v){ return s + v; }, 0);
    var porLinea = {};
    if(f.linea) l.forEach(function(r){ var v = f.numero(r, c); if(v == null) return; var k = f.linea(r) || '—'; porLinea[k] = (porLinea[k] || 0) + v; });
    return Object.assign(base, {tipo:'numero', campo:c, valor: a === 'sumar' ? suma : suma / vals.length, n:vals.length,
      min:Math.min.apply(null, vals), max:Math.max.apply(null, vals), porLinea: a === 'sumar' ? porLinea : null, suma: a === 'sumar'});
  }
  if(a === 'maximo' || a === 'minimo'){
    var cm = q.campo || f.campoDef, sel = null, sv = null, cuantos = 0;
    if(f.numero) l.forEach(function(r){
      var v = f.numero(r, cm);
      if(v == null || isNaN(v)) return;
      cuantos++;
      if(sv == null || (a === 'maximo' ? v > sv : v < sv)){ sv = v; sel = r; }
    });
    if(!sel) return Object.assign(base, {tipo:'nada', sinNumeros:true});
    return Object.assign(base, {tipo:'tarjeta', r:sel, extremo:{campo:cm, valor:sv, de:cuantos, max: a === 'maximo'}});
  }
  if(a === 'peor' || a === 'mejor'){
    // por linea: el cumplimiento (o el promedio) de cada una
    if(!f.linea) return Object.assign(base, {tipo:'tabla', filas:l.slice(0, q.limite || 10)});
    var g = {};
    l.forEach(function(r){ var k = f.linea(r); if(!k) return; (g[k] = g[k] || []).push(r); });
    var filas = Object.keys(g).map(function(k){
      var v;
      if(f.pct || f.estado){ var pc2 = f.pct ? f.pct(g[k]) : null; if(!pc2){ var ok = 0, n = 0; g[k].forEach(function(r){ var e = f.estado(r); if(e === 'pass' || e === 'fail'){ n++; if(e === 'pass') ok++; } }); pc2 = {ok:ok, n:n}; } v = pc2.n ? pc2.ok / pc2.n * 100 : null; }
      return {linea:k, valor:v, n:g[k].length};
    }).filter(function(x){ return x.valor != null; }).sort(function(x, y){ return a === 'peor' ? x.valor - y.valor : y.valor - x.valor; });
    return Object.assign(base, {tipo:'ranking', filas:filas, unidad:'%'});
  }
  return Object.assign(base, {tipo:'tabla', filas:l.slice(0, q.limite || 10)});
}

// Agrupar: cuantos por grupo, y su % que pasa (o su total / promedio si se pidio)
function agAgrupar(f, l, q, a, base){
  var key = q.agrupar || 'linea', grupos = {};
  l.forEach(function(r){ var k = agClave(f, key, r); if(k === '' || k == null) k = '—'; (grupos[k] = grupos[k] || []).push(r); });
  var cg = q.campo || f.campoDef;
  var filasG = Object.keys(grupos).map(function(k){
    var gl = grupos[k], fila = {clave:k, n:gl.length, valor:null};
    if((a === 'sumar' || a === 'promedio') && f.numero){
      var vs = gl.map(function(r){ return f.numero(r, cg); }).filter(function(v){ return v != null && !isNaN(v); });
      if(vs.length){ var s = vs.reduce(function(p, v){ return p + v; }, 0); fila.valor = a === 'sumar' ? s : s / vs.length; }
    } else if(f.pct || f.estado){
      var pg = f.pct ? f.pct(gl) : null;
      if(!pg){ var ok = 0, n = 0; gl.forEach(function(r){ var e = f.estado(r); if(e === 'pass' || e === 'fail'){ n++; if(e === 'pass') ok++; } }); pg = {ok:ok, n:n}; }
      if(pg.n) fila.pct = pg.ok / pg.n * 100;
    }
    return fila;
  });
  var porClave = key === 'linea' || key === 'dia' || key === 'turno';
  filasG.sort(function(x, y){
    if(porClave) return key === 'dia' ? String(y.clave).localeCompare(String(x.clave)) : String(x.clave).localeCompare(String(y.clave), undefined, {numeric:true});
    return ((y.valor != null ? y.valor : y.n) - (x.valor != null ? x.valor : x.n));
  });
  return Object.assign(base, {tipo:'grupos', clave:key, filas:filasG, campo:(a === 'sumar' || a === 'promedio') ? cg : null, suma: a === 'sumar'});
}
// La llave para agrupar ("por linea", "por causa"...)
function agClave(f, key, r){
  if(key === 'linea') return f.linea ? f.linea(r) : '';
  if(key === 'dia') return f.fecha ? f.fecha(r) : '';
  if(key === 'turno') return f.turno ? String(f.turno(r) == null ? '' : f.turno(r)) : '';
  if(key === 'producto') return f.producto ? String(f.producto(r) || '') : '';
  if(key === 'estado') return f.estado ? f.estado(r) : '';
  if(key === 'causa') return r.cause || r.reason || r.category || r.problem || '';
  if(key === 'cliente'){
    if(r.customer) return r.customer;
    if(f.k === 'products'){ var c = typeof productCustomer === 'function' ? productCustomer(r) : null; return c ? c.company : ''; }
    return '';
  }
  if(key === 'area') return r.area || '';
  return '';
}
function agClaveTxt(key, v){
  if(v === '—' || v === '' || v == null) return '—';
  if(key === 'linea') return agLineaTxt(v);
  if(key === 'dia') return agFecha(v);
  if(key === 'turno') return agTurnoTxt(v);
  if(key === 'estado') return agEstadoTxt(v);
  return String(v);
}

// ---- Lo que no es de una sola fuente ----
// Todo lo de un producto: su ficha y lo ultimo de cada modulo donde aparece
function agProductoTodo(num){
  var p = typeof findProduct === 'function' ? findProduct(num) : null;
  var ultimos = [];
  ['analysis', 'plates', 'weights', 'seals', 'runs', 'output', 'orders', 'holds', 'capa', 'downtime', 'shifts'].forEach(function(k){
    var f = agFuente(k);
    if(!f || !f.producto || !agPuedeVer(f)) return;
    var l = agFiltrar(f, {filtros:{producto: p ? p.number : num}});
    if(l.length) ultimos.push({f:f, r:l[0], total:l.length});
  });
  return {p:p, ultimos:ultimos};
}
// Todo lo de un LOT, en todas partes (como Search, pero en una respuesta)
function agTraza(lot){
  var out = [];
  AG_FUENTES.forEach(function(f){
    if(!f.lot || !agPuedeVer(f)) return;
    var l = agFiltrar(f, {filtros:{lot:lot}});
    if(l.length) out.push({f:f, l:l});
  });
  return out;
}
// Lo que falta en el turno: el mismo motor de los avisos (js/core/avisos.js)
function agPendientes(){
  if(typeof NX_AVISOS === 'undefined') return null;
  var cfg = NX_AVISOS.config((getDB() || {}).reminders || null), d = new Date();
  var ctx = NX_AVISOS.turnoActual(localDateStr(d), d.getHours() * 60 + d.getMinutes(), cfg);
  if(!ctx) return {ctx:null, items:[]};
  var db = getDB() || {};
  return {ctx:ctx, items:NX_AVISOS.pendientes({weights:db.weights, temps:db.temps, gmps:db.gmps, preop:db.preop, metal:db.metal, runs:db.runs}, ctx, cfg)};
}
