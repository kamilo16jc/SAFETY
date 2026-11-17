// ===== OPERATIONS › REPORTS =====
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
var REP_NOMBRES = {attendance:'Attendance report', output:'Output report', downtime:'Downtime report'};

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
  var linea = f.what === 'attendance' ? '' : (f.line ? ' · '+opsLineaTxt(f.line) : ' · All lines');
  return fechas+' · '+opsTurno(f.shift)+linea;
}
function repIncluye(f, k){ return (f.what || 'attendance') === k; }

// ===== LOS DATOS DEL REPORTE =====
function repDatos(f){
  var ordenar = function(a, b){
    return String(a.date || '').localeCompare(String(b.date || '')) || String(a.shift).localeCompare(String(b.shift));
  };
  // Asistencia: no tiene linea; se filtra por fecha y turno
  var att = opsLista('attendance').filter(function(r){ return repEnRango(r, f) && r.status; }).sort(ordenar);
  var porEmp = {};
  att.forEach(function(r){
    var k = String(r.employeeId);
    var e = attEmp(r.employeeId);
    if(!porEmp[k]) porEmp[k] = {name:(e && e.name) || r.name || '', empNo:(e && e.empNo) || r.empNo || '', area:(e && e.area) || r.area || '',
                                dias:0, present:0, late:0, left:0, absent:0, excused:0, min:0};
    var x = porEmp[k];
    x.dias++; x[r.status] = (x[r.status] || 0) + 1;
    x.min += attHorasMin(r) || 0;
  });
  var empleados = Object.keys(porEmp).map(function(k){ return porEmp[k]; })
    .sort(function(a, b){ return String(a.name).localeCompare(String(b.name), undefined, {numeric:true}); });

  var enLinea = function(r){ return !f.line || String(r.line) === String(f.line); };
  var out = opsLista('output').filter(function(r){ return repEnRango(r, f) && enLinea(r); }).sort(function(a, b){
    return ordenar(a, b) || (parseInt(a.line, 10) || 99) - (parseInt(b.line, 10) || 99);
  });
  var porProd = {};
  out.forEach(function(r){
    var k = normNumber(r.product)+'|'+(r.unit || OUT_UNIT_DEF);
    if(!porProd[k]) porProd[k] = {product:r.product, name:r.productName || '', unit:r.unit || OUT_UNIT_DEF, runs:0, ordered:0, conOrden:false,
                                  produced:0, balance:0, done:0, lots:{}, lbs:0, conLbs:false};
    var x = porProd[k];
    x.runs++;
    var o = opsNum(r.ordered), p = opsNum(r.produced), b = outBalance(r);
    if(o != null){ x.ordered += o; x.conOrden = true; }
    if(p != null) x.produced += p;
    var lb = outLbs(r);
    if(lb != null){ x.lbs += lb; x.conLbs = true; }
    if(b != null && b > 0 && !r.completed) x.balance += b;
    if(r.completed) x.done++;
    if(r.lot) x.lots[r.lot] = 1;
  });
  var productos = Object.keys(porProd).map(function(k){ return porProd[k]; })
    .sort(function(a, b){ return String(a.product).localeCompare(String(b.product), undefined, {numeric:true}); });

  var dt = opsLista('downtime').filter(function(r){ return repEnRango(r, f) && enLinea(r); }).sort(function(a, b){
    return ordenar(a, b) || String(a.start || '').localeCompare(String(b.start || ''));
  });
  return {att:att, empleados:empleados, out:out, productos:productos, dt:dt};
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
      kpiCard(d.dt.length, 'downtime', {icono:'clock', on:w === 'downtime', click:"setRepView('downtime')", note:'line stops'});
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
      '<h3 class="ops-h3">Each entry</h3>'+tabla(REP_OUT_COLS, d.out.map(function(r){ return repFilaOut(r); }), 'Nothing produced in this range')+'</section>';
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
var REP_ATT_COLS = [{h:'Employee', w:46}, {h:'Emp #', w:16}, {h:'Area', w:24}, {h:'Days', w:13, al:'right'}, {h:'Present', w:15, al:'right'},
  {h:'Late', w:13, al:'right'}, {h:'Left early', w:16, al:'right'}, {h:'Absent', w:15, al:'right'}, {h:'Excused', w:15, al:'right'}, {h:'Hours', w:15, al:'right'}];
function repFilasAtt(emps){
  return emps.map(function(x){ return [x.name, x.empNo, x.area, x.dias, x.present, x.late, x.left, x.absent, x.excused, x.min ? opsHoras(x.min) : '']; });
}
function repTotAtt(emps){
  var t = {dias:0, present:0, late:0, left:0, absent:0, excused:0, min:0};
  emps.forEach(function(x){ Object.keys(t).forEach(function(k){ t[k] += x[k] || 0; }); });
  return ['Total', '', emps.length+' people', t.dias, t.present, t.late, t.left, t.absent, t.excused, t.min ? opsHoras(t.min) : ''];
}
var REP_PROD_COLS = [{h:'Product #', w:20}, {h:'Description', w:50}, {h:'Runs', w:12, al:'right'}, {h:'Ordered', w:18, al:'right'},
  {h:'Produced', w:18, al:'right'}, {h:'Balance left', w:18, al:'right'}, {h:'Unit', w:13}, {h:'Lbs produced', w:20, al:'right'},
  {h:'Completed', w:16, al:'right'}, {h:'LOTs', w:42}];
function repFilasProd(ps, xl){
  var n = xl ? function(v){ return v; } : opsFmt;
  return ps.map(function(x){
    return [x.product, x.name, x.runs, x.conOrden ? n(x.ordered) : '', n(x.produced), x.balance ? n(x.balance) : '',
            outUnitTxt(x.unit), x.conLbs ? (xl ? Math.round(x.lbs * 100) / 100 : opsFmt(x.lbs)) : '',
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
    secs.push({title:'Output by product', kpis:[['Products run', d.out.length], ['Completed', d.out.filter(function(r){ return r.completed; }).length], ['Produced', outTotales(d.out) || '0']],
      cols:REP_PROD_COLS, rows:repFilasProd(d.productos), empty:'Nothing produced in this range'});
    secs.push({title:'Output — each entry', cols:REP_OUT_COLS, rows:d.out.map(function(r){ return repFilaOut(r); }), empty:'Nothing produced in this range'});
  }
  if(repIncluye(f, 'downtime')){
    var total = d.dt.reduce(function(a, r){ return a + (dtMinutos(r) || 0); }, 0);
    secs.push({title:'Downtime by line', kpis:[['Stops', d.dt.length], ['Minutes down', total+' ('+opsHoras(total)+' h)'], ['Still down', d.dt.filter(dtAbierto).length]],
      cols:REP_DTL_COLS, rows:dtResumenLinea(d.dt), empty:'No line stops'});
    secs.push({title:'Downtime by cause', cols:REP_DTC_COLS, rows:dtResumenCausa(d.dt).map(function(x){ return [x[0], x[1], x[2], x[3]+'%']; }), empty:'No line stops'});
    secs.push({title:'Downtime — each stop', cols:REP_DT_COLS, rows:d.dt.map(function(r){ return repFilaDt(r); }), empty:'No line stops in this range'});
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
    hojas.push({nombre:'Output by product', filas:[cab(REP_PROD_COLS)].concat(repFilasProd(d.productos, true))});
    hojas.push({nombre:'Output', filas:[cab(REP_OUT_COLS)].concat(d.out.map(function(r){ return repFilaOut(r, true); }))});
  }
  if(repIncluye(f, 'downtime')){
    hojas.push({nombre:'Downtime by line', filas:[cab(REP_DTL_COLS)].concat(dtResumenLinea(d.dt))});
    hojas.push({nombre:'Downtime by cause', filas:[cab(REP_DTC_COLS)].concat(dtResumenCausa(d.dt))});
    hojas.push({nombre:'Downtime', filas:[cab(REP_DT_COLS)].concat(d.dt.map(function(r){ return repFilaDt(r, true); }))});
  }
  var hay = hojas.some(function(h){ return h.filas.length > 1; });
  if(!hay){ toast('Nothing to export for these filters'); return; }
  var from = f.from || f.to || localDateStr(), to = f.to || f.from || localDateStr();
  var w = f.what || 'attendance';
  downloadBook(w+'-report-'+from+(to !== from ? '-to-'+to : '')+'.xlsx', hojas);
  opsLog('Report exported', REP_NOMBRES[w]+' · Excel · '+repTexto(f));
}
