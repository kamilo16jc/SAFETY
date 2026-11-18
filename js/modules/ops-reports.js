// ===== OPERATIONS › SEARCH (antes Reports) =====
// 17 nov 2026: se llama Search y trae TODO lo de Operations, cada cosa por
// separado: Attendance, Output, Downtime y los Shift reports (cada reporte
// con su PDF y su impresora en la fila, y la lista entera en PDF y Excel).
//
// Tres reportes SEPARADOS (pedido del usuario, 16 nov 2026: "los reportes los
// quiero separados, no unidos como solo uno"): Attendance, Output y Downtime,
// cada uno con su PDF, su impresora y su Excel. Las tarjetas de arriba escogen
// cual se ve; el rango de fechas, el turno y la linea son los mismos para los
// tres. Sin fechas = solo hoy. Los filtros esperan a la lupa.

var opsRep = null;      // filtros aplicados

function initOpsReports(){
  if(!opsRep) opsRep = {from:'', to:'', shift:'', line:'', what:'attendance'};
  var set = function(id, v){ var e = document.getElementById(id); if(e) e.value = v; };
  set('rep-from', opsRep.from); set('rep-to', opsRep.to); set('rep-shift', opsRep.shift);
  set('rep-line', opsRep.line);
  opsSucio('rep', false);
  renderOpsReports();
}
function repAplicar(){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value : ''; };
  opsRep = {from:g('rep-from'), to:g('rep-to'), shift:g('rep-shift'), line:g('rep-line'), what:(opsRep && opsRep.what) || 'attendance'};
  if(opsRep.from && opsRep.to && opsRep.to < opsRep.from){ toast('"To" is before "From"'); return; }
  opsSucio('rep', false);
  var desde = opsRep.from || opsRep.to;
  if(desde && window.loadHistory) window.loadHistory(desde, renderOpsReports); else renderOpsReports();
}
function repTecla(e){ if(e.key === 'Enter') repAplicar(); }
// Cambiar de reporte no consulta nada: los datos del rango ya estan cargados
function setRepView(k){
  if(!opsRep) opsRep = {from:'', to:'', shift:'', line:'', what:k};
  opsRep.what = k;
  opsRepintar('screen-opsreports', renderOpsReports);
}
var REP_NOMBRES = {attendance:'Attendance report', output:'Output report', downtime:'Downtime report', shifts:'Shift reports'};

function repEnRango(r, f){
  var d = String(r.date || '').slice(0, 10);
  var from = f.from || (f.to ? '' : localDateStr()), to = f.to || (f.from ? '' : localDateStr());
  if(from && d < from) return false;
  if(to && d > to) return false;
  if(f.shift && String(r.shift) !== String(f.shift)) return false;
  return true;
}
function repTexto(f){
  var from = f.from || f.to, to = f.to || f.from;
  var fechas = !from ? opsFechaTxt(localDateStr()) : from === to ? opsFechaTxt(from) : opsFechaTxt(from)+' – '+opsFechaTxt(to);
  // la asistencia no va por linea
  var linea = (f.line ? ' · '+opsLineaTxt(f.line) : ' · All lines');
  return fechas+' · '+opsTurno(f.shift)+linea;
}
function repIncluye(f, k){ return (f.what || 'attendance') === k; }

// ===== LOS DATOS DEL REPORTE =====
function repDatos(f){
  var ordenar = function(a, b){
    return String(a.date || '').localeCompare(String(b.date || '')) || String(a.shift).localeCompare(String(b.shift));
  };
  // Asistencia: no tiene linea; se filtra por fecha y turno
  var att = opsLista('attendance').filter(function(r){
    return repEnRango(r, f) && r.status && (!f.line || attLineaDe(r) === String(f.line));
  }).sort(ordenar);
  var porEmp = {};
  att.forEach(function(r){
    var k = String(r.employeeId);
    var e = attEmp(r.employeeId);
    if(!porEmp[k]) porEmp[k] = {name:(e && e.name) || r.name || '', empNo:(e && e.empNo) || r.empNo || '', area:(e && e.area) || r.area || '',
                                dias:0, present:0, late:0, left:0, absent:0, excused:0, min:0, lineas:{}};
    var x = porEmp[k];
    x.dias++; x[r.status] = (x[r.status] || 0) + 1;
    var ln = attLineaDe(r, e);
    if(ln) x.lineas[ln] = 1;
    x.min += attHorasMin(r) || 0;
  });
  var empleados = Object.keys(porEmp).map(function(k){ return porEmp[k]; })
    .sort(function(a, b){ return String(a.name).localeCompare(String(b.name), undefined, {numeric:true}); });

  var enLinea = function(r){ return !f.line || String(r.line) === String(f.line); };
  var out = opsLista('output').filter(function(r){ return repEnRango(r, f) && enLinea(r); }).sort(function(a, b){
    return ordenar(a, b) || (parseInt(a.line, 10) || 99) - (parseInt(b.line, 10) || 99);
  });
  // Por LINEA y producto (pedido del usuario, 17 nov 2026), con libras y cajas
  var porProd = {};
  out.forEach(function(r){
    var k = String(r.line || '')+'|'+normNumber(r.product)+'|'+(r.unit || OUT_UNIT_DEF);
    if(!porProd[k]) porProd[k] = {line:String(r.line || ''), product:r.product, name:r.productName || '', unit:r.unit || OUT_UNIT_DEF, runs:0, ordered:0, conOrden:false,
                                  produced:0, balance:0, done:0, lots:{}, lbs:0, conLbs:false, cases:0, conCases:false};
    var x = porProd[k];
    x.runs++;
    var o = opsNum(r.ordered), p = opsNum(r.produced), b = outBalance(r);
    if(o != null){ x.ordered += o; x.conOrden = true; }
    if(p != null) x.produced += p;
    var lb = outLbs(r), cs = outCases(r);
    if(lb != null){ x.lbs += lb; x.conLbs = true; }
    if(cs != null){ x.cases += cs; x.conCases = true; }
    if(b != null && b > 0 && !r.completed) x.balance += b;
    if(r.completed) x.done++;
    if(r.lot) x.lots[r.lot] = 1;
  });
  var productos = Object.keys(porProd).map(function(k){ return porProd[k]; }).sort(outOrden);

  var dt = opsLista('downtime').filter(function(r){ return repEnRango(r, f) && enLinea(r); }).sort(function(a, b){
    return ordenar(a, b) || String(a.start || '').localeCompare(String(b.start || ''));
  });
  return {att:att, empleados:empleados, out:out, productos:productos, dt:dt, sr:repShifts(f)};
}
// Los Shift reports del rango (los mismos de QA: es una sola lista)
function repShifts(f){
  return (typeof getShifts === 'function' ? getShifts() : []).filter(function(s){
    return repEnRango(s, f) && (!f.line || String(s.line || '') === String(f.line));
  }).sort(function(a, b){
    return String(a.date || '').localeCompare(String(b.date || '')) || String(a.shift).localeCompare(String(b.shift)) ||
      String(a.reportNumber || '').localeCompare(String(b.reportNumber || ''), undefined, {numeric:true});
  });
}
function repSrConteo(l){
  return {open:l.filter(function(s){ return s.status === 'open'; }).length,
          seguir:l.filter(function(s){ return s.status === 'followup' || s.status === 'monitoring' || (s.followUp && s.status !== 'resolved'); }).length,
          resueltos:l.filter(function(s){ return s.status === 'resolved'; }).length};
}

// ===== EN PANTALLA =====
function renderOpsReports(){
  var host = document.getElementById('rep-body');
  if(!host) return;
  var f = opsRep || {what:'attendance'};
  var d = repDatos(f);
  var sub = document.getElementById('rep-sub');
  if(sub) sub.textContent = REP_NOMBRES[f.what || 'attendance']+' · '+repTexto(f);
  // las tres tarjetas escogen el reporte; cada una dice cuanto trae
  var tabs = document.getElementById('rep-tabs');
  if(tabs){
    var w = f.what || 'attendance';
    tabs.innerHTML =
      kpiCard(d.att.length, 'attendance', {icono:'user', on:w === 'attendance', click:"setRepView('attendance')", note:'marks'}) +
      kpiCard(d.out.length, 'output', {icono:'box', on:w === 'output', click:"setRepView('output')", note:'products run'}) +
      kpiCard(d.dt.length, 'downtime', {icono:'clock', on:w === 'downtime', click:"setRepView('downtime')", note:'line stops'}) +
      kpiCard(d.sr.length, 'shift reports', {icono:'history', on:w === 'shifts', click:"setRepView('shifts')", note:'reports'});
    renderIcons(tabs);
  }
  var html = '';
  var tabla = function(cab, filas, vacio, foot){
    return '<div class="sheet-wrap"><table class="sheet ops-sheet ops-rep"><thead><tr>'+cab.map(function(c){
        return '<th'+(c.al === 'right' ? ' class="num"' : '')+'>'+esc(c.h)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      (filas.length ? filas.map(function(r){
        return '<tr>'+r.map(function(v, i){ return '<td'+(cab[i] && cab[i].al === 'right' ? ' class="num"' : '')+'>'+esc(v == null ? '' : v)+'</td>'; }).join('')+'</tr>';
      }).join('') : '<tr><td colspan="'+cab.length+'" class="soft">'+esc(vacio)+'</td></tr>')+
      (foot && filas.length ? '<tr class="ops-tot">'+foot.map(function(v, i){ return '<td'+(cab[i] && cab[i].al === 'right' ? ' class="num"' : '')+'><b>'+esc(v)+'</b></td>'; }).join('')+'</tr>' : '')+
      '</tbody></table></div>';
  };
  if(repIncluye(f, 'attendance')){
    var c = repConteoAtt(d.att);
    html += '<section class="ops-sec"><div class="kpi-row ops-sum">'+
      kpiCard(c.vino, 'at work', {tono:'ok', icono:'check'}) + kpiCard(c.late, 'late', {tono:'warn', icono:'clock'}) +
      kpiCard(c.left, 'left early', {tono:'warn', icono:'back'}) + kpiCard(c.absent, 'absent', {tono:'bad', icono:'ban'}) +
      kpiCard(c.excused, 'excused', {icono:'note'}) +
      '</div>'+tabla(REP_ATT_COLS, repFilasAtt(d.empleados), 'No attendance marked in this range', repTotAtt(d.empleados))+'</section>';
  }
  if(repIncluye(f, 'output')){
    html += '<section class="ops-sec"><div class="kpi-row ops-sum">'+
      kpiCard(d.out.length, 'products run', {icono:'box'}) +
      kpiCard(d.out.filter(function(r){ return r.completed; }).length, 'orders completed', {tono:'ok', icono:'check'}) +
      kpiCard(d.out.filter(function(r){ var b = outBalance(r); return !r.completed && b != null && b > 0; }).length, 'with balance left', {tono:'bad', icono:'alert'}) +
      outKpiProducido(d.out) +
      '</div>'+tabla(REP_PROD_COLS, repFilasProd(d.productos), 'Nothing produced in this range')+
      '<h3 class="ops-h3">Each entry</h3>'+tabla(REP_OUT_COLS, d.out.map(function(r){ return repFilaOut(r); }), 'Nothing produced in this range')+
      (outComentarios(d.out, true).length ? '<h3 class="ops-h3">Comments</h3>'+tabla(OUT_COM_COLS_F, outComentarios(d.out, true), '') : '')+'</section>';
  }
  if(repIncluye(f, 'downtime')){
    var total = d.dt.reduce(function(a, r){ return a + (dtMinutos(r) || 0); }, 0);
    html += '<section class="ops-sec"><div class="kpi-row ops-sum">'+
      kpiCard(d.dt.length, 'line stops', {icono:'alert'}) +
      kpiCard(total, 'minutes down', {tono:'bad', icono:'clock', note: total >= 60 ? opsHoras(total)+' h' : ''}) +
      kpiCard(d.dt.filter(dtAbierto).length, 'still down', {tono:'bad', icono:'ban'}) +
      '</div><div class="ops-dos">'+
        '<div>'+tabla(REP_DTL_COLS, dtResumenLinea(d.dt), 'No line stops')+'</div>'+
        '<div>'+tabla(REP_DTC_COLS, dtResumenCausa(d.dt).map(function(x){ return [x[0], x[1], x[2], x[3]+'%']; }), 'No line stops')+'</div>'+
      '</div><h3 class="ops-h3">Each stop</h3>'+tabla(REP_DT_COLS, d.dt.map(repFilaDt), 'No line stops in this range')+'</section>';
  }
  if(repIncluye(f, 'shifts')){
    var cs = repSrConteo(d.sr);
    html += '<section class="ops-sec"><div class="kpi-row ops-sum">'+
      kpiCard(d.sr.length, 'shift reports', {icono:'history'}) +
      kpiCard(cs.open, 'open', {tono:'bad', icono:'alert'}) +
      kpiCard(cs.seguir, 'to follow up', {tono:'warn', icono:'clock'}) +
      kpiCard(cs.resueltos, 'resolved', {tono:'ok', icono:'check'}) +
      '</div>'+repTablaShifts(d.sr)+'</section>';
  }
  host.innerHTML = html;
  renderIcons(host);
  if(typeof window.nxMarcarHojas === 'function') window.nxMarcarHojas(host);
}
function repConteoAtt(att){
  var c = {vino:0, present:0, late:0, left:0, absent:0, excused:0};
  att.forEach(function(r){ c[r.status] = (c[r.status] || 0) + 1; if(attVino(r)) c.vino++; });
  return c;
}

// ===== COLUMNAS Y FILAS (las mismas en pantalla, PDF y Excel) =====
var REP_ATT_COLS = [{h:'Employee', w:44}, {h:'Emp #', w:15}, {h:'Line', w:22}, {h:'Area', w:22}, {h:'Days', w:13, al:'right'}, {h:'Present', w:15, al:'right'},
  {h:'Late', w:13, al:'right'}, {h:'Left early', w:16, al:'right'}, {h:'Absent', w:15, al:'right'}, {h:'Excused', w:15, al:'right'}, {h:'Hours', w:15, al:'right'}];
function repFilasAtt(emps){
  return emps.map(function(x){
    var ls = Object.keys(x.lineas).sort(function(a, b){ return attLineaOrden(a) - attLineaOrden(b); }).map(opsLineaTxt).join(', ');
    return [x.name, x.empNo, ls, x.area, x.dias, x.present, x.late, x.left, x.absent, x.excused, x.min ? opsHoras(x.min) : '']; });
}
function repTotAtt(emps){
  var t = {dias:0, present:0, late:0, left:0, absent:0, excused:0, min:0};
  emps.forEach(function(x){ Object.keys(t).forEach(function(k){ t[k] += x[k] || 0; }); });
  return ['Total', '', '', emps.length+' people', t.dias, t.present, t.late, t.left, t.absent, t.excused, t.min ? opsHoras(t.min) : ''];
}
var REP_PROD_COLS = [{h:'Line', w:16}, {h:'Product #', w:20}, {h:'Description', w:46}, {h:'Runs', w:12, al:'right'}, {h:'Ordered', w:18, al:'right'},
  {h:'Produced', w:18, al:'right'}, {h:'Balance left', w:18, al:'right'}, {h:'Unit', w:13}, {h:'Lbs produced', w:20, al:'right'},
  {h:'Cases produced', w:20, al:'right'}, {h:'Completed', w:16, al:'right'}, {h:'LOTs', w:36}];
function repFilasProd(ps, xl){
  var n = xl ? function(v){ return v; } : opsFmt;
  return ps.map(function(x){
    return [opsLineaTxt(x.line) || 'No line', x.product, x.name, x.runs, x.conOrden ? n(x.ordered) : '', n(x.produced), x.balance ? n(x.balance) : '',
            outUnitTxt(x.unit), x.conLbs ? outNumRep(x.lbs, xl) : '', x.conCases ? outNumRep(x.cases, xl) : '',
            x.done+' of '+x.runs, Object.keys(x.lots).join(', ')];
  });
}
var REP_OUT_COLS = [{h:'Date', w:18}, {h:'Shift', w:12}].concat(OUT_COLS);
function repFilaOut(r, xl){
  return [xl ? String(r.date).slice(0, 10) : opsFechaTxt(r.date), String(r.shift) === '2' ? '2nd' : '1st'].concat(outFilaReporte(r, xl));
}
var REP_DTL_COLS = [{h:'Line', w:20}, {h:'Stops', w:15, al:'right'}, {h:'Minutes', w:15, al:'right'}, {h:'Hours', w:15, al:'right'}];
var REP_DTC_COLS = [{h:'Cause', w:40}, {h:'Stops', w:15, al:'right'}, {h:'Minutes', w:15, al:'right'}, {h:'% of time', w:15, al:'right'}];
var REP_DT_COLS = [{h:'Date', w:18}, {h:'Shift', w:12}].concat(DT_COLS);
function repFilaDt(r, xl){
  return [xl ? String(r.date).slice(0, 10) : opsFechaTxt(r.date), String(r.shift) === '2' ? '2nd' : '1st'].concat(dtFilaReporte(r));
}

// La lista de Shift reports en pantalla: la fila abre el reporte; al final,
// el PDF y la impresora de ESE reporte (los mismos de Search de QA)
function repTablaShifts(l){
  var stt = (typeof SHIFT_STATUS !== 'undefined') ? SHIFT_STATUS : {};
  var filas = l.map(function(s){
    var st = stt[s.status] || {};
    return '<tr class="view-row" onclick="viewShiftReport('+s.id+')">'+
      '<td class="code">'+esc(s.reportNumber || '—')+'</td>'+
      '<td>'+esc(opsFechaTxt(s.date))+'</td>'+
      '<td>'+(String(s.shift) === '2' ? '2nd' : '1st')+'</td>'+
      '<td>'+esc(s.area || '—')+'</td>'+
      '<td>'+esc(opsLineaTxt(s.line) || '—')+'</td>'+
      '<td>'+(s.category ? '<span class="pill">'+esc(s.category)+'</span>' : '—')+'</td>'+
      '<td>'+(s.status ? '<span class="pill '+(st.cls || '')+'">'+esc(st.label || s.status)+'</span>' : '—')+'</td>'+
      '<td class="ops-sr-txt" title="'+esc(s.notes || '')+'">'+esc(s.notes || '—')+'</td>'+
      '<td class="soft">'+esc(s.reportedBy || s.createdBy || '—')+'</td>'+
      '<td class="view-cell"><span class="row-icos">'+
        '<button class="form-ico" type="button" onclick="event.stopPropagation();viewShiftReport('+s.id+')" '+
          'data-tip="View report" aria-label="View report '+esc(s.reportNumber || '')+'"><span data-icon="search"></span></button>'+
        formBtn('exportShiftPDF('+s.id+')', 'shift report')+
      '</span></td></tr>';
  }).join('');
  return '<div class="sheet-wrap"><table class="sheet ops-sheet ops-rep"><thead><tr>'+
      '<th>Report #</th><th>Date</th><th>Shift</th><th>Area</th><th>Line</th><th>Category</th><th>Status</th>'+
      '<th>What happened</th><th>By</th><th></th></tr></thead><tbody>'+
    (filas || '<tr><td colspan="10" class="soft">No shift reports in this range</td></tr>')+'</tbody></table></div>';
}
var REP_SR_COLS = [{h:'Report #', w:24}, {h:'Date', w:20}, {h:'Shift', w:11}, {h:'Area', w:24}, {h:'Line', w:18}, {h:'Category', w:20},
  {h:'Status', w:18}, {h:'What happened', w:62}, {h:'Action taken', w:42}, {h:'By', w:22}];
function repFilasShifts(l, xl){
  var stt = (typeof SHIFT_STATUS !== 'undefined') ? SHIFT_STATUS : {};
  return l.map(function(s){
    return [s.reportNumber || '', xl ? String(s.date || '').slice(0, 10) : opsFechaTxt(s.date), String(s.shift) === '2' ? '2nd' : '1st',
            s.area || '', opsLineaTxt(s.line), s.category || '', (stt[s.status] || {}).label || s.status || '',
            s.notes || '', s.action || '', s.reportedBy || s.createdBy || ''];
  });
}

// ===== PDF =====
function opsReportPdf(){
  var f = opsRep || {what:'attendance'};
  var d = repDatos(f);
  var secs = [];
  if(repIncluye(f, 'attendance')){
    var c = repConteoAtt(d.att);
    secs.push({title:'Attendance by employee', kpis:[['At work', c.vino], ['Late', c.late], ['Left early', c.left], ['Absent', c.absent], ['Excused', c.excused]],
      cols:REP_ATT_COLS, rows:repFilasAtt(d.empleados), foot: d.empleados.length ? repTotAtt(d.empleados) : null, empty:'No attendance marked in this range'});
  }
  if(repIncluye(f, 'output')){
    secs.push({title:'Output by line and product', kpis:[['Products run', d.out.length], ['Completed', d.out.filter(function(r){ return r.completed; }).length], ['Produced', outTotales(d.out) || '0']],
      cols:REP_PROD_COLS, rows:repFilasProd(d.productos), empty:'Nothing produced in this range'});
    secs.push({title:'Output — each entry', cols:REP_OUT_COLS, rows:d.out.map(function(r){ return repFilaOut(r); }), empty:'Nothing produced in this range'});
    secs.push(outSeccionLinea(d.out));
    var com = outSeccionComentarios(d.out, true);
    if(com) secs.push(com);
  }
  if(repIncluye(f, 'downtime')){
    var total = d.dt.reduce(function(a, r){ return a + (dtMinutos(r) || 0); }, 0);
    secs.push({title:'Downtime by line', kpis:[['Stops', d.dt.length], ['Minutes down', total+' ('+opsHoras(total)+' h)'], ['Still down', d.dt.filter(dtAbierto).length]],
      cols:REP_DTL_COLS, rows:dtResumenLinea(d.dt), empty:'No line stops'});
    secs.push({title:'Downtime by cause', cols:REP_DTC_COLS, rows:dtResumenCausa(d.dt).map(function(x){ return [x[0], x[1], x[2], x[3]+'%']; }), empty:'No line stops'});
    secs.push({title:'Downtime — each stop', cols:REP_DT_COLS, rows:d.dt.map(function(r){ return repFilaDt(r); }), empty:'No line stops in this range'});
  }
  if(repIncluye(f, 'shifts')){
    var cs = repSrConteo(d.sr);
    secs.push({title:'Shift reports', kpis:[['Reports', d.sr.length], ['Open', cs.open], ['To follow up', cs.seguir], ['Resolved', cs.resueltos]],
      cols:REP_SR_COLS, rows:repFilasShifts(d.sr), empty:'No shift reports in this range'});
  }
  var from = f.from || f.to || localDateStr(), to = f.to || f.from || localDateStr();
  var w = f.what || 'attendance';
  return opsPdf({title: REP_NOMBRES[w], sub: repTexto(f),
    file: REP_NOMBRES[w].replace(' ', '_')+'_'+from+(to !== from ? '_to_'+to : '')+'.pdf', sections: secs});
}

// ===== EXCEL: el reporte escogido, con su resumen y su detalle =====
function opsReportExcel(){
  var f = opsRep || {what:'attendance'};
  var d = repDatos(f);
  var hojas = [];
  var cab = function(cols){ return cols.map(function(c){ return c.h; }); };
  if(repIncluye(f, 'attendance')){
    hojas.push({nombre:'Attendance by employee', filas:[cab(REP_ATT_COLS)].concat(repFilasAtt(d.empleados))});
    hojas.push({nombre:'Attendance', filas:[['Date', 'Shift', 'Employee', 'Emp #', 'Area', 'Status', 'In', 'Out', 'Hours', 'Notes']].concat(d.att.map(function(r){
      var s = attStatus(r.status), min = attHorasMin(r);
      return [String(r.date).slice(0, 10), opsTurno(r.shift), r.name || '', r.empNo || '', r.area || '', s ? s.label : '',
              opsHora12(r.timeIn), opsHora12(r.timeOut), min == null ? '' : opsHoras(min), r.notes || ''];
    }))});
  }
  if(repIncluye(f, 'output')){
    hojas.push({nombre:'Output by line and product', filas:[cab(REP_PROD_COLS)].concat(repFilasProd(d.productos, true))});
    hojas.push({nombre:'Output', filas:[cab(REP_OUT_COLS)].concat(d.out.map(function(r){ return repFilaOut(r, true); }))});
    var pl = outTablaLinea(d.out, true);
    hojas.push({nombre:'Output by line', filas:[cab(pl.cols)].concat(pl.filas, pl.filas.length ? [pl.total] : [])});
    var cm = outComentarios(d.out, true, true);
    if(cm.length) hojas.push({nombre:'Output comments', filas:[cab(OUT_COM_COLS_F)].concat(cm)});
  }
  if(repIncluye(f, 'downtime')){
    hojas.push({nombre:'Downtime by line', filas:[cab(REP_DTL_COLS)].concat(dtResumenLinea(d.dt))});
    hojas.push({nombre:'Downtime by cause', filas:[cab(REP_DTC_COLS)].concat(dtResumenCausa(d.dt))});
    hojas.push({nombre:'Downtime', filas:[cab(REP_DT_COLS)].concat(d.dt.map(function(r){ return repFilaDt(r, true); }))});
  }
  if(repIncluye(f, 'shifts')){
    hojas.push({nombre:'Shift reports', filas:[cab(REP_SR_COLS).concat(['Follow-up', 'Product', 'LOT', 'Supervisor'])].concat(
      repFilasShifts(d.sr, true).map(function(fila, i){
        var s = d.sr[i];
        return fila.concat([s.followUp ? 'Yes' : 'No', s.product || '', s.lot || '', s.supervisor || '']);
      }))});
  }
  var hay = hojas.some(function(h){ return h.filas.length > 1; });
  if(!hay){ toast('Nothing to export for these filters'); return; }
  var from = f.from || f.to || localDateStr(), to = f.to || f.from || localDateStr();
  var w = f.what || 'attendance';
  downloadBook(w+'-report-'+from+(to !== from ? '-to-'+to : '')+'.xlsx', hojas);
  opsLog('Report exported', REP_NOMBRES[w]+' · Excel · '+repTexto(f));
}
