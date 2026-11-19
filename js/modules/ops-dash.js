// ===== INICIO: EL TABLERO DE OPERACIONES =====
// Pedido del usuario (18 nov 2026): la gente que solo trabaja en Operations
// entraba al tablero de calidad —pesos, sellado, CAPA—, que no es lo suyo.
// Este es el mismo tablero, con el mismo diseno, pero del piso: cuanto hizo
// cada linea, quien vino, que se paro y los shift reports.
//
// QUE TABLERO VE CADA QUIEN lo dice su ROL, solo (homeDashes):
//   - el rol ve Operations o Production y nada de calidad -> este
//   - ve calidad (QA, laboratorio, COA o el panel)       -> el de calidad
//   - ve los dos                                          -> los dos, con un
//     selector arriba (Quality · Operations) que recuerda el ultimo
// El administrador lo puede fijar en el editor del rol (role.home). No se
// guarda en la persona: si le cambian el rol, le cambia el tablero.
//
// Todo sale de lo que Operations ya guarda —db.output, db.attendance,
// db.downtime, db.shifts—. Igual que el de calidad: sin datos lo dice, no
// se inventa una cifra.

// Lo que se considera "bien". Es lo unico que hay que tocar para mover la vara.
var OPS_TARGETS = {
  fill:       100,   // % de lo ordenado que se produjo
  attendance:  95    // % de los marcados que vinieron a trabajar
};
var KDO_LARGO = 30;  // un paro de 30 minutos o mas sale en "Needs attention"

var kdoState = {days:7, line:'all', shift:'all', medida:'cases'};

// ------------------------------------------------------------------
// Cual tablero
// ------------------------------------------------------------------
function homeDashes(u){
  u = u || (typeof currentUser !== 'undefined' ? currentUser : null);
  if(!u) return ['quality'];
  var rol = (typeof roleOf === 'function') ? roleOf(u) : null;
  if(rol && (rol.home === 'quality' || rol.home === 'ops')) return [rol.home];
  if(rol && rol.protected) return ['quality', 'ops'];
  var mods = (typeof userModules === 'function') ? userModules(u) : [];
  var tiene = function(l){ return mods.some(function(m){ return l.indexOf(m) >= 0; }); };
  var piso = tiene(['operations', 'production']);
  var calidad = tiene(['qa', 'lab', 'coa', 'admin']);
  if(piso && calidad) return ['quality', 'ops'];
  return piso ? ['ops'] : ['quality'];
}
function homeDashKey(){
  return 'nexora-home-dash' + (typeof currentUser !== 'undefined' && currentUser ? ':' + currentUser.id : '');
}
function homeDash(){
  var l = homeDashes();
  if(l.length === 1) return l[0];
  var g = null;
  try{ g = localStorage.getItem(homeDashKey()); }catch(e){}
  return l.indexOf(g) >= 0 ? g : l[0];
}
function setHomeDash(k){
  try{ localStorage.setItem(homeDashKey(), k); }catch(e){}
  homeTableros();
}
// Enseña el tablero que toca, el selector si hay dos, y lo pinta
function homeTableros(){
  var cual = homeDash(), l = homeDashes();
  var q = document.getElementById('kd'), o = document.getElementById('kdo');
  if(q) q.hidden = cual !== 'quality';
  if(o) o.hidden = cual !== 'ops';
  document.querySelectorAll('.kd-dsw').forEach(function(h){
    if(l.length < 2){ h.hidden = true; h.innerHTML = ''; return; }
    h.hidden = false;
    var b = function(k, txt){
      return '<button class="seg'+(cual === k ? ' on' : '')+'" type="button" aria-pressed="'+(cual === k)+'" '+
        'onclick="setHomeDash(\''+k+'\')">'+txt+'</button>';
    };
    h.innerHTML = '<div class="segmented" role="group" aria-label="Dashboard">'+
      b('quality', 'Quality') + b('ops', 'Operations') + '</div>';
  });
  if(cual === 'ops') renderOpsDash();
  else if(typeof renderHomeKPI === 'function') renderHomeKPI();
}
// Al cambiar el ancho de la ventana se repinta solo el que se ve
function homeRepintar(){
  if(homeDash() === 'ops') renderOpsDash();
  else if(typeof renderHomeKPI === 'function') renderHomeKPI();
}

// ------------------------------------------------------------------
// Los datos del periodo
// ------------------------------------------------------------------
function kdoLinea(v){ return kdoState.line === 'all' || String(v == null ? '' : v) === kdoState.line; }
function kdoTurno(r){ return kdoState.shift === 'all' || String(r.shift == null ? '' : r.shift) === kdoState.shift; }
function kdoSalida(v){
  return opsLista('output').filter(function(r){ return kpiEnVentana(r, v) && kdoTurno(r) && kdoLinea(r.line); });
}
function kdoParos(v){
  return opsLista('downtime').filter(function(r){ return kpiEnVentana(r, v) && kdoTurno(r) && kdoLinea(r.line); });
}
function kdoEmpleados(){
  var m = {};
  getEmployees().forEach(function(e){ m[String(e.id)] = e; });
  return m;
}
// La asistencia no lleva linea en el registro: es la del dia o la fija del empleado
function kdoAsistencia(v, emps){
  return opsLista('attendance').filter(function(r){
    if(!r.status || !kpiEnVentana(r, v) || !kdoTurno(r)) return false;
    return kdoState.line === 'all' || attLineaDe(r, emps[String(r.employeeId)]) === kdoState.line;
  });
}
function kdoReportes(v){
  return (typeof getShifts === 'function' ? getShifts() : []).filter(function(s){
    return kpiEnVentana(s, v) && kdoTurno(s) && kdoLinea(s.line);
  });
}
// Hoy y sin hora de regreso: la linea sigue parada
function kdoParada(r){ return dtAbierto(r) && kpiDia(r) === localDateStr(); }

// Lo producido y lo ordenado, en cajas y en libras. Lo ordenado solo cuenta
// donde se puede convertir: no se suman cajas con libras.
function kdoSuma(lista){
  var t = {n:lista.length, cases:0, lbs:0, conCases:false, conLbs:false, sin:0,
           ordenes:0, hechas:0, ordC:0, prodC:0, ordL:0, prodL:0};
  lista.forEach(function(r){
    var p = opsNum(r.produced), o = opsNum(r.ordered);
    var cs = p == null ? null : outCases(r), lb = p == null ? null : outLbs(r);
    if(cs != null){ t.cases += cs; t.conCases = true; }
    if(lb != null){ t.lbs += lb; t.conLbs = true; }
    if(p != null && (cs == null || lb == null)) t.sin++;
    if(o != null && o > 0){
      t.ordenes++;
      if(r.completed) t.hechas++;
      var oc = outCases(r, 'ordered'), ol = outLbs(r, 'ordered');
      if(oc != null){ t.ordC += oc; t.prodC += cs || 0; }
      if(ol != null){ t.ordL += ol; t.prodL += lb || 0; }
    }
  });
  t.fill = kpiPct(t.prodC, t.ordC);
  return t;
}
function kdoConteoAtt(lista){
  var c = {vino:0, absent:0, late:0, left:0, excused:0};
  lista.forEach(function(r){
    if(attVino(r)) c.vino++;
    if(c[r.status] != null) c[r.status]++;
  });
  c.marcados = c.vino + c.absent;            // los excusados no cuentan en contra
  c.pct = kpiPct(c.vino, c.marcados);
  return c;
}
function kdoMinutos(lista){ return lista.reduce(function(s, r){ return s + (dtMinutos(r) || 0); }, 0); }

// Todo lo del periodo de una vez: cada parte del tablero lo usa sin volver a filtrar
function kdoDatos(){
  var v = kpiVentana(kdoState.days, 0), prev = kpiVentana(kdoState.days, 1);
  var emps = kdoEmpleados();
  var D = {v:v, prev:prev, emps:emps,
    out:kdoSalida(v), dt:kdoParos(v), att:kdoAsistencia(v, emps), sr:kdoReportes(v),
    outPrev:kdoSalida(prev), dtPrev:kdoParos(prev), attPrev:kdoAsistencia(prev, emps)};
  D.s = kdoSuma(D.out); D.sp = kdoSuma(D.outPrev);
  D.a = kdoConteoAtt(D.att); D.ap = kdoConteoAtt(D.attPrev);
  D.min = kdoMinutos(D.dt); D.minPrev = kdoMinutos(D.dtPrev);
  D.serie = kdoSerie(Math.max(kdoState.days, 7), emps);
  return D;
}
// Una fila por dia para las chispas de las casillas
function kdoSerie(dias, emps){
  var v = kpiVentana(dias, 0), m = {}, orden = [];
  for(var i = dias - 1; i >= 0; i--){
    var d = kpiFecha(i);
    m[d] = {date:d, out:[], dt:0, att:[]};
    orden.push(d);
  }
  kdoSalida(v).forEach(function(r){ var x = m[kpiDia(r)]; if(x) x.out.push(r); });
  kdoParos(v).forEach(function(r){ var x = m[kpiDia(r)]; if(x) x.dt += dtMinutos(r) || 0; });
  kdoAsistencia(v, emps).forEach(function(r){ var x = m[kpiDia(r)]; if(x) x.att.push(r); });
  return orden.map(function(d){
    var x = m[d], s = kdoSuma(x.out);
    return {date:d, cases: s.conCases ? s.cases : null, fill:s.fill, dt:x.dt, att:kdoConteoAtt(x.att).pct};
  });
}

// ------------------------------------------------------------------
// Numeros
// ------------------------------------------------------------------
function kdoN(n){ return n == null ? '—' : Math.round(n).toLocaleString('en-US'); }
// En el eje: 1.2k en vez de 1,200
function kdoCorto(n){
  if(n >= 10000) return Math.round(n / 1000) + 'k';
  if(n >= 1000) return (Math.round(n / 100) / 10) + 'k';
  return String(Math.round(n));
}
function kdoMedidaTxt(){ return kdoState.medida === 'lbs' ? 'lbs' : 'cases'; }
function kdoVal(s){ return kdoState.medida === 'lbs' ? (s.conLbs ? s.lbs : null) : (s.conCases ? s.cases : null); }
function kdoOrd(s){ return kdoState.medida === 'lbs' ? s.ordL : s.ordC; }
// El cambio contra el periodo anterior. pct: en porcentaje del de antes
function kdoDelta(ahora, antes, masEsMejor, unidad, pct){
  if(ahora == null || antes == null) return '';
  var d = pct ? (antes ? (ahora - antes) / antes * 100 : null) : ahora - antes;
  if(d == null) return '';
  if(Math.abs(d) < 0.5) return '<span class="kd-cap" title="Same as the prior period">No change</span>';
  var mejor = masEsMejor ? d > 0 : d < 0;
  return '<span class="kd-cap" title="vs the prior period" style="color:'+(mejor ? 'var(--pass)' : 'var(--fail)')+'">'+
    (d > 0 ? '▲' : '▼')+' '+kdoN(Math.abs(d))+(pct ? '%' : ' '+unidad)+'</span>';
}
function kdoBadge(cls, txt){ return '<span class="kd-badge'+(cls ? ' '+cls : '')+'">'+txt+'</span>'; }

// ------------------------------------------------------------------
// Las casillas de arriba
// ------------------------------------------------------------------
var KDO_RUTAS = ['screen-output', 'screen-output', 'screen-attendance', 'screen-downtime', 'screen-shift'];
function kdoPintaCasillas(D){
  var host = document.getElementById('kdo-kpis');
  if(!host) return;
  var s = D.s, sp = D.sp, a = D.a, serie = D.serie;
  var lineas = {};
  D.out.forEach(function(r){ if(opsNum(r.produced) > 0) lineas[String(r.line || '')] = 1; });
  var nl = Object.keys(lineas).length;
  var paradas = D.dt.filter(kdoParada).length;
  var causa = dtTopCausa(D.dt);
  var sr = repSrConteo(D.sr);
  var faltan = [a.absent ? a.absent+' absent' : '', a.late ? a.late+' late' : ''].filter(Boolean).join(' · ');

  host.innerHTML = [
    kpiCasilla({
      name:'Cases produced', icon:'box',
      value: s.conCases ? kdoN(s.cases) : '—', unit: s.conCases ? 'cases' : '',
      target: s.conLbs ? kdoN(s.lbs)+' lbs' : (s.n ? 'Not converted' : 'Nothing entered'),
      foot: kdoDelta(s.conCases ? s.cases : null, sp.conCases ? sp.cases : null, true, '', true),
      spark: kpiChispa(serie.map(function(d){ return d.cases; })),
      badge: nl ? kdoBadge('', nl+' line'+(nl === 1 ? '' : 's')) : kpiInsignia('none')
    }),
    kpiCasilla({
      name:'Order fill', icon:'check',
      value: s.fill == null ? '—' : Math.round(s.fill), unit: s.fill == null ? '' : '%',
      target: s.fill == null ? 'No orders entered' : 'Target '+OPS_TARGETS.fill+'% of ordered',
      foot: s.ordenes ? '<span class="kd-cap">'+s.hechas+' of '+s.ordenes+' completed</span>' : '',
      estado: kpiEstado(s.fill, OPS_TARGETS.fill, true, 5),
      spark: kpiChispa(serie.map(function(d){ return d.fill; }))
    }),
    kpiCasilla({
      name:'Attendance', icon:'user',
      value: a.pct == null ? '—' : a.pct.toFixed(0), unit: a.pct == null ? '' : '%',
      target: a.pct == null ? 'Nothing marked' : 'Target ≥ '+OPS_TARGETS.attendance+'%',
      foot: (faltan ? '<span class="kd-cap">'+faltan+'</span>' : '') + kpiDelta(a.pct, D.ap.pct, true),
      estado: kpiEstado(a.pct, OPS_TARGETS.attendance, true, 3),
      spark: kpiChispa(serie.map(function(d){ return d.att; }))
    }),
    kpiCasilla({
      name:'Downtime', icon:'clock',
      value: kdoN(D.min), unit:'min',
      target: D.dt.length ? D.dt.length+' stop'+(D.dt.length === 1 ? '' : 's')+(causa ? ' · '+causa.cause : '') : 'No stops',
      foot: kdoDelta(D.min, D.minPrev, false, 'min'),
      spark: kpiChispa(serie.map(function(d){ return d.dt; })),
      badge: paradas ? kdoBadge('bad', '✕ '+paradas+' down now') : kdoBadge('ok', '✓ All running')
    }),
    kpiCasilla({
      name:'Shift reports', icon:'history',
      value: D.sr.length, unit:'',
      target: sr.open || sr.seguir
        ? [sr.open ? sr.open+' open' : '', sr.seguir ? sr.seguir+' follow-up' : ''].filter(Boolean).join(' · ')
        : (D.sr.length ? 'All resolved' : 'None in this period'),
      badge: sr.open ? kdoBadge('bad', '✕ '+sr.open+' open')
           : sr.seguir ? kdoBadge('warn', '! Follow-up')
           : D.sr.length ? kdoBadge('ok', '✓ Resolved') : kpiInsignia('none')
    })
  ].join('');
  renderIcons(host);
  // cada casilla abre su pantalla, si el rol la deja ver
  host.querySelectorAll('.kd-kpi').forEach(function(card, i){
    var sc = KDO_RUTAS[i];
    if(!sc || !canSeeScreen(sc, currentUser, 'operations')) return;
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.classList.add('nx-kpi-action');
    card.setAttribute('aria-label', card.textContent.trim()+'. Open workspace.');
    card.addEventListener('click', function(){ kpiIr('operations', sc); });
    card.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); kpiIr('operations', sc); } });
  });
}

// ------------------------------------------------------------------
// La grafica grande: lo producido por linea (o por producto si se
// escogio una linea), contra lo ordenado
// ------------------------------------------------------------------
var kdoFilasTabla = [];
function kdoGrupos(lista){
  var porProducto = kdoState.line !== 'all', g = {};
  if(!porProducto) OPS_LINES.forEach(function(n){ g[String(n)] = {k:String(n), label:'Line '+n, items:[]}; });
  lista.forEach(function(r){
    var k = porProducto ? (normNumber(r.product) || '—') : String(r.line || '');
    if(!g[k]) g[k] = {k:k, label: porProducto ? (r.product || '—') : (opsLineaTxt(k) || 'No line'), name:r.productName || '', items:[]};
    g[k].items.push(r);
  });
  var datos = Object.keys(g).map(function(k){ var x = g[k]; x.s = kdoSuma(x.items); return x; });
  if(porProducto){
    datos.sort(function(a, b){ return (kdoVal(b.s) || 0) - (kdoVal(a.s) || 0); });
    return datos.slice(0, 10);
  }
  return datos.sort(function(a, b){ return opsLineaOrden(a.k) - opsLineaOrden(b.k); });
}
function kdoPintaLineas(D){
  var caja = document.getElementById('kdo-ch-line');
  if(!caja) return;
  var porProducto = kdoState.line !== 'all';
  var t = document.getElementById('kdo-ch-title');
  if(t) t.textContent = porProducto ? opsLineaTxt(kdoState.line)+' · by product' : 'Produced by line';
  var sub = document.getElementById('kdo-ch-sub');
  if(sub) sub.textContent = (kdoState.medida === 'lbs' ? 'Pounds' : 'Cases')+' produced against what was ordered';
  ['cases', 'lbs'].forEach(function(k){
    var b = document.getElementById('kdo-m-'+k);
    if(b){ b.classList.toggle('on', kdoState.medida === k); b.setAttribute('aria-pressed', String(kdoState.medida === k)); }
  });
  caja.innerHTML = '';
  var datos = kdoGrupos(D.out);
  kdoFilasTabla = datos;
  kdoPintaTabla();
  if(!D.out.length){
    caja.innerHTML = '<div class="nx-chart-empty"><span data-icon="box"></span><b>No output yet</b>'+
      '<p>Lines will appear here when Output is entered for this period.</p></div>';
    renderIcons(caja); return;
  }
  var med = kdoMedidaTxt();
  var W = Math.max(260, caja.clientWidth || 700), H = 235, m = {t:24, r:10, b:30, l:44};
  var svg = kpiEl('svg', {viewBox:'0 0 '+W+' '+H, height:H, role:'group',
                          'aria-label':'Produced '+(porProducto ? 'by product' : 'by line')+', in '+med}, caja);
  var max = 0;
  datos.forEach(function(d){ max = Math.max(max, kdoVal(d.s) || 0, kdoOrd(d.s) || 0); });
  // un tope redondo para el eje: 1, 2 o 5 por una potencia de diez
  var paso = 1;
  if(max > 0){
    var e = Math.pow(10, Math.floor(Math.log(max / 4) / Math.LN10));
    paso = [1, 2, 5, 10].map(function(f){ return f * e; }).filter(function(s){ return s * 4 >= max; })[0] || e * 10;
  }
  var tope = paso * 4;
  var y = function(v){ return m.t + (1 - v / tope) * (H - m.t - m.b); };
  for(var g = 0; g <= tope + 0.0001; g += paso){
    kpiEl('line', {x1:m.l, x2:W-m.r, y1:y(g), y2:y(g), stroke:'var(--border)', 'stroke-width':1,
                   'stroke-dasharray': g ? '3 5' : ''}, svg);
    kpiEl('text', {x:m.l-9, y:y(g)+4, 'text-anchor':'end', class:'kd-ax'}, svg).textContent = kdoCorto(g);
  }
  var banda = (W - m.l - m.r) / datos.length, bw = Math.min(34, banda * 0.56);
  var tip = kpiGlobo(caja);
  datos.forEach(function(d){
    var cx = m.l + banda * datos.indexOf(d) + banda / 2;
    var val = kdoVal(d.s) || 0, ord = kdoOrd(d.s) || 0;
    // lo ordenado, detras y claro; lo producido, encima y de color
    if(ord > 0) kpiEl('path', {d:kpiBarra(cx-bw/2, y(ord), bw, y(0)-y(ord)), fill:'var(--mint)',
                               stroke:'var(--accent)', 'stroke-width':1, 'stroke-dasharray':'3 3', 'stroke-opacity':.6}, svg);
    if(val > 0) kpiEl('path', {d:kpiBarra(cx-bw/2, y(val), bw, y(0)-y(val)), fill:'var(--accent)'}, svg);
    var arriba = Math.min(y(val), ord > 0 ? y(ord) : y(val));
    kpiEl('text', {x:cx, y:arriba-6, 'text-anchor':'middle', class:'kd-val'+(val ? '' : ' kdo-cero')}, svg)
      .textContent = kdoN(val);
    var lbl = d.label.length > 12 ? d.label.slice(0, 11)+'…' : d.label;
    kpiEl('text', {x:cx, y:H-8, 'text-anchor':'middle', class:'kd-ax'}, svg).textContent = lbl;
    var zona = kpiEl('rect', {x:cx-banda/2, y:0, width:banda, height:H, fill:'transparent', class:'nx-chart-hit',
                              tabindex:0, role:'button'}, svg);
    var s = d.s, pct = kpiPct(s.prodC, s.ordC);
    var detalle = kdoN(s.conCases ? s.cases : null)+' cases · '+kdoN(s.conLbs ? s.lbs : null)+' lbs'+
      '<br>'+d.items.length+' product'+(d.items.length === 1 ? '' : 's')+
      (s.ordenes ? ' · '+s.hechas+' of '+s.ordenes+' completed' : '')+
      (pct != null ? ' · '+Math.round(pct)+'% of ordered' : '');
    zona.setAttribute('aria-label', d.label+'. '+detalle.replace(/<br>/g, '. ')+'.');
    var ver = function(){
      var r = svg.getBoundingClientRect();
      tip.ver('<b>'+esc(d.label)+(porProducto && d.name ? ' · '+esc(d.name) : '')+'</b>'+detalle,
              cx * (r.width || W) / W, arriba * (r.height || H) / H);
    };
    var ir = function(){
      if(porProducto){ kpiIr('operations', 'screen-output'); return; }
      var sel = document.getElementById('kdo-line');
      if(sel && Array.prototype.some.call(sel.options, function(o){ return o.value === d.k; })){ sel.value = d.k; kdoFiltro(); }
    };
    zona.addEventListener('mousemove', ver);
    zona.addEventListener('focus', ver);
    zona.addEventListener('pointerdown', ver);
    zona.addEventListener('mouseleave', tip.ocultar);
    zona.addEventListener('blur', tip.ocultar);
    zona.addEventListener('click', ir);
    zona.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); ir(); } });
  });
  var cap = document.createElement('div');
  cap.className = 'nx-chart-caption';
  cap.innerHTML = '<span><i></i>Produced</span><span><i class="kdo-ghost"></i>Ordered</span>'+
    '<span>'+(porProducto ? 'Click a bar to open Output' : 'Click a line to see its products')+'</span>';
  caja.appendChild(cap);
}
function kdoMedida(k){
  kdoState.medida = k === 'lbs' ? 'lbs' : 'cases';
  renderOpsDash();
}
function kdoToggleTabla(){
  var t = document.getElementById('kdo-table'), b = document.getElementById('kdo-table-btn');
  if(!t) return;
  t.hidden = !t.hidden;
  if(b) b.setAttribute('aria-expanded', String(!t.hidden));
  kdoPintaTabla();
}
function kdoPintaTabla(){
  var t = document.getElementById('kdo-table');
  if(!t || t.hidden) return;
  var porProducto = kdoState.line !== 'all';
  t.innerHTML = '<table><caption class="nx-data-caption">Produced '+(porProducto ? 'by product' : 'by line')+' · selected period</caption>'+
    '<thead><tr><th scope="col">'+(porProducto ? 'Product' : 'Line')+'</th><th scope="col">Products</th><th scope="col">Completed</th>'+
    '<th scope="col">Cases</th><th scope="col">Lbs</th><th scope="col">% of ordered</th></tr></thead><tbody>'+
    kdoFilasTabla.map(function(d){
      var s = d.s, pct = kpiPct(s.prodC, s.ordC);
      return '<tr><td>'+esc(d.label)+(porProducto && d.name ? ' · '+esc(d.name) : '')+'</td><td>'+d.items.length+'</td>'+
        '<td>'+(s.ordenes ? s.hechas+' of '+s.ordenes : '—')+'</td>'+
        '<td>'+(s.conCases ? kdoN(s.cases) : '—')+'</td><td>'+(s.conLbs ? kdoN(s.lbs) : '—')+'</td>'+
        '<td>'+(pct == null ? '—' : Math.round(pct)+'%')+'</td></tr>';
    }).join('')+'</tbody></table>';
}

// ------------------------------------------------------------------
// Los productos que mas se hicieron
// ------------------------------------------------------------------
function kdoPintaProductos(D){
  var host = document.getElementById('kdo-products');
  if(!host) return;
  var g = {};
  D.out.forEach(function(r){
    var k = normNumber(r.product) || '—';
    if(!g[k]) g[k] = {k:k, label:r.product || '—', name:r.productName || '', items:[]};
    g[k].items.push(r);
  });
  var datos = Object.keys(g).map(function(k){ var x = g[k]; x.v = kdoVal(kdoSuma(x.items)); return x; })
    .filter(function(x){ return x.v > 0; })
    .sort(function(a, b){ return b.v - a.v; });
  if(!datos.length){
    host.innerHTML = '<div class="kd-none">Nothing produced in this period.</div>';
    return;
  }
  var max = datos[0].v, med = kdoMedidaTxt(), ir = canSeeScreen('screen-output', currentUser, 'operations');
  host.innerHTML = datos.slice(0, 7).map(function(d){
    return '<button class="kd-prog" type="button"'+(ir ? ' onclick="kpiIr(\'operations\',\'screen-output\')"' : '')+
      (d.name ? ' data-tip="'+esc(d.label+' · '+d.name)+'"' : '')+'>'+
      '<span class="kd-prog-n">'+esc(d.label)+'</span>'+
      '<span class="kd-track"><span class="kd-fill" style="width:'+(d.v / max * 100).toFixed(1)+'%"></span></span>'+
      '<span class="kd-prog-v">'+kdoN(d.v)+' <span class="kd-cap">'+med+'</span></span>'+
    '</button>';
  }).join('');
}

// ------------------------------------------------------------------
// Paros por causa (barras como las de CAPA)
// ------------------------------------------------------------------
function kdoPintaParos(D){
  var caja = document.getElementById('kdo-ch-dt');
  if(!caja) return;
  caja.innerHTML = '';
  if(!D.dt.length){ caja.innerHTML = '<div class="kd-none">No downtime in this period.</div>'; return; }
  var m = {};
  D.dt.forEach(function(r){
    var k = r.cause || 'Other';
    if(!m[k]) m[k] = {k:k, min:0, n:0, abiertos:0};
    m[k].min += dtMinutos(r) || 0; m[k].n++;
    if(kdoParada(r)) m[k].abiertos++;
  });
  var datos = Object.keys(m).map(function(k){ return m[k]; })
    .sort(function(a, b){ return b.min - a.min || b.n - a.n; }).slice(0, 6);
  var W = caja.clientWidth || 500, altoFila = 40, H = datos.length * altoFila + 8, lw = 132, rw = 86;
  var svg = kpiEl('svg', {viewBox:'0 0 '+W+' '+H, height:H, role:'img', 'aria-label':'Downtime minutes by cause'}, caja);
  var max = Math.max(1, Math.max.apply(null, datos.map(function(d){ return d.min; })));
  var tip = kpiGlobo(caja), ir = canSeeScreen('screen-downtime', currentUser, 'operations');
  datos.forEach(function(d, i){
    var yy = i * altoFila + 10, bh = 16, w = (d.min / max) * (W - lw - rw);
    kpiEl('text', {x:0, y:yy+12, class:'kd-ax kd-ax-fuerte'}, svg).textContent = d.k;
    kpiEl('rect', {x:lw, y:yy, width:W-lw-rw, height:bh, rx:4, fill:'var(--surface2)'}, svg);
    if(d.min) kpiEl('path', {d:kpiBarra(lw, yy, w, bh, true), fill:'var(--accent)'}, svg);
    kpiEl('text', {x:lw+w+8, y:yy+12, class:'kd-val'}, svg).textContent = kdoN(d.min)+' min';
    kpiEl('text', {x:W, y:yy+12, 'text-anchor':'end', class:'kd-ax'+(d.abiertos ? ' kd-ax-mal' : '')}, svg)
      .textContent = d.abiertos ? '● down now' : d.n+' stop'+(d.n === 1 ? '' : 's');
    var zona = kpiEl('rect', {x:0, y:yy-6, width:W, height:altoFila-4, fill:'transparent', class:'nx-chart-hit',
                              tabindex:0, role:'button', 'aria-label':d.k+'. '+d.min+' minutes, '+d.n+' stops.'}, svg);
    var ver = function(){
      var r = svg.getBoundingClientRect();
      tip.ver('<b>'+esc(d.k)+'</b>'+kdoN(d.min)+' min · '+d.n+' stop'+(d.n === 1 ? '' : 's')+
              (D.min ? ' · '+Math.round(d.min / D.min * 100)+'% of downtime' : ''),
              (lw + w / 2) * (r.width || W) / W, yy * (r.height || H) / H);
    };
    zona.addEventListener('mousemove', ver);
    zona.addEventListener('focus', ver);
    zona.addEventListener('mouseleave', tip.ocultar);
    zona.addEventListener('blur', tip.ocultar);
    if(ir){
      zona.addEventListener('click', function(){ kpiIr('operations', 'screen-downtime'); });
      zona.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); kpiIr('operations', 'screen-downtime'); } });
    }
  });
}

// ------------------------------------------------------------------
// Asistencia por linea (o por area si la persona no tiene linea)
// ------------------------------------------------------------------
function kdoPintaAsistencia(D){
  var host = document.getElementById('kdo-att');
  if(!host) return;
  if(!D.att.length){ host.innerHTML = '<div class="kd-none">Nothing marked in this period.</div>'; return; }
  var g = {};
  D.att.forEach(function(r){
    var e = D.emps[String(r.employeeId)];
    var ln = attLineaDe(r, e);
    var k = ln || ('a:'+String((e && e.area) || r.area || '').trim());
    if(!g[k]) g[k] = {k:k, orden: ln ? attLineaOrden(ln) : 700, label: ln ? opsLineaTxt(ln) : (String((e && e.area) || r.area || '').trim() || 'No line'), l:[]};
    g[k].l.push(r);
  });
  var ir = canSeeScreen('screen-attendance', currentUser, 'operations');
  host.innerHTML = Object.keys(g).map(function(k){ var x = g[k]; x.c = kdoConteoAtt(x.l); return x; })
    .filter(function(x){ return x.c.marcados > 0; })
    .sort(function(a, b){ return a.orden - b.orden || a.label.localeCompare(b.label); })
    .map(function(x){
      var p = x.c.pct, corto = p != null && p < OPS_TARGETS.attendance;
      var nota = [x.c.absent ? x.c.absent+' absent' : '', x.c.late ? x.c.late+' late' : '', x.c.left ? x.c.left+' left early' : ''].filter(Boolean).join(' · ');
      return '<button class="kd-prog" type="button"'+(ir ? ' onclick="kpiIr(\'operations\',\'screen-attendance\')"' : '')+
        (nota ? ' data-tip="'+esc(x.label+' · '+nota)+'"' : '')+'>'+
        '<span class="kd-prog-n">'+esc(x.label)+'</span>'+
        '<span class="kd-track" title="'+x.c.vino+' of '+x.c.marcados+'"><span class="kd-fill" style="width:'+(p || 0).toFixed(1)+'%"></span></span>'+
        '<span class="kd-prog-v">'+(corto ? '<span class="kd-short" aria-label="below target">▼ </span>' : '')+
          (p == null ? '—' : p.toFixed(0)+'%')+' <span class="kd-cap">('+x.c.vino+'/'+x.c.marcados+')</span></span>'+
      '</button>';
    }).join('') || '<div class="kd-none">Nothing marked in this period.</div>';
}

// ------------------------------------------------------------------
// La tabla: lo que hay que mirar
// ------------------------------------------------------------------
function kdoPintaPendiente(D){
  var cuerpo = document.getElementById('kdo-attn'), vacio = document.getElementById('kdo-attn-empty');
  if(!cuerpo) return;
  var filas = [], hoy = localDateStr();
  D.dt.forEach(function(r){
    var min = dtMinutos(r);
    if(kdoParada(r)){
      filas.push({orden:0, tipo:'Line down', ref:r.cause || '—', donde:opsLineaTxt(r.line) || '—',
        detalle:'Since '+opsHora12(r.start)+(min != null ? ' · '+min+' min so far' : '')+(r.what ? ' · '+r.what : ''),
        fecha:kpiDia(r), cls:'bad', estado:'✕ Down', screen:'screen-downtime'});
    } else if(min != null && min >= KDO_LARGO){
      filas.push({orden:2, tipo:'Downtime', ref:r.cause || '—', donde:opsLineaTxt(r.line) || '—',
        detalle:opsHora12(r.start)+' to '+opsHora12(r.end)+(r.what ? ' · '+r.what : ''),
        fecha:kpiDia(r), cls:'warn', estado:'! '+min+' min', screen:'screen-downtime'});
    }
  });
  D.sr.forEach(function(s){
    var seguir = s.status === 'followup' || s.status === 'monitoring' || (s.followUp && s.status !== 'resolved');
    if(s.status !== 'open' && !seguir) return;
    filas.push({orden:1, tipo:'Shift report', ref:s.reportNumber || '—',
      donde:[s.line ? opsLineaTxt(s.line) : '', s.area || ''].filter(Boolean).join(' · ') || '—',
      detalle:s.notes || '—', fecha:kpiDia(s), cls: s.status === 'open' ? 'bad' : 'warn',
      estado: s.status === 'open' ? '✕ Open' : '! Follow-up', screen:'screen-shift'});
  });
  // Lo que quedo corto de dias que ya pasaron (hoy todavia se esta haciendo)
  D.out.forEach(function(r){
    var b = outBalance(r);
    if(r.completed || b == null || b <= 0 || kpiDia(r) >= hoy) return;
    filas.push({orden:3, tipo:'Output', ref:r.order || r.product || '—', donde:opsLineaTxt(r.line) || '—',
      detalle:(r.product ? r.product+(r.productName ? ' · '+r.productName : '')+' · ' : '')+opsFmt(b)+' '+outUnitTxt(r.unit || OUT_UNIT_DEF)+' left of '+opsFmt(opsNum(r.ordered)),
      fecha:kpiDia(r), cls:'warn', estado:'! Short', screen:'screen-output'});
  });
  // Las faltas, juntas por dia y turno: una fila por persona llenaba la tabla
  var faltas = {};
  D.att.forEach(function(r){
    if(r.status !== 'absent') return;
    var k = kpiDia(r)+'|'+r.shift;
    if(!faltas[k]) faltas[k] = {fecha:kpiDia(r), shift:r.shift, n:0, donde:{}};
    faltas[k].n++;
    var e = D.emps[String(r.employeeId)], ln = attLineaDe(r, e);
    var d = ln ? opsLineaTxt(ln) : String((e && e.area) || r.area || '').trim();
    if(d) faltas[k].donde[d] = 1;
  });
  Object.keys(faltas).forEach(function(k){
    var f = faltas[k], donde = Object.keys(f.donde);
    filas.push({orden:4, tipo:'Attendance', ref:opsTurno(f.shift), donde: donde.slice(0, 3).join(', ')+(donde.length > 3 ? '…' : '') || '—',
      detalle:f.n+' absent', fecha:f.fecha, cls:'warn', estado:'! '+f.n+' absent', screen:'screen-attendance'});
  });
  filas.sort(function(a, b){ return (a.orden - b.orden) || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0); });
  var lista = filas.slice(0, 12);
  cuerpo.innerHTML = lista.map(function(r){
    var ir = canSeeScreen(r.screen, currentUser, 'operations');
    return '<tr'+(ir ? ' onclick="kpiIr(\'operations\',\''+r.screen+'\')"' : '')+'>'+
      '<td>'+esc(r.tipo)+'</td>'+
      '<td class="nt-mono">'+esc(r.ref)+'</td>'+
      '<td>'+esc(r.donde)+'</td>'+
      '<td class="nt-wide">'+esc(r.detalle)+'</td>'+
      '<td>'+esc(r.fecha ? kpiDiaCorto(r.fecha) : '—')+'</td>'+
      '<td><span class="kd-badge '+r.cls+'">'+esc(r.estado)+'</span></td></tr>';
  }).join('');
  if(vacio) vacio.hidden = lista.length > 0;
  var n = document.getElementById('kdo-attn-n');
  if(n) n.textContent = filas.length > lista.length ? 'Showing '+lista.length+' of '+filas.length : '';
}

// ------------------------------------------------------------------
// El aviso de una linea, como el de calidad: solo con lo que ya hay
// ------------------------------------------------------------------
function kdoInsights(D){
  var a = [];
  var paradas = D.dt.filter(kdoParada);
  if(paradas.length){
    var p = paradas[0], min = dtMinutos(p);
    a.push({title:(opsLineaTxt(p.line) || 'A line')+' is down'+(paradas.length > 1 ? ' (and '+(paradas.length - 1)+' more)' : ''),
      text:'Stopped at '+opsHora12(p.start)+' · '+(p.cause || 'No cause')+(min != null ? ' · '+min+' min so far' : '')+'. Mark it running in Downtime when it is back.',
      screen:'screen-downtime', action:'Open downtime'});
  }
  var porLinea = {};
  D.out.forEach(function(r){ var k = String(r.line || ''); (porLinea[k] = porLinea[k] || []).push(r); });
  var lineas = Object.keys(porLinea).map(function(k){ return {k:k, s:kdoSuma(porLinea[k])}; });
  if(D.s.fill != null && D.s.fill < OPS_TARGETS.fill){
    var corta = lineas.filter(function(x){ return x.s.ordC > x.s.prodC; })
      .sort(function(x, y){ return (y.s.ordC - y.s.prodC) - (x.s.ordC - x.s.prodC); })[0];
    a.push({title:'Orders are '+Math.round(D.s.fill)+'% filled',
      text:D.s.hechas+' of '+D.s.ordenes+' orders completed.'+(corta ? ' '+(opsLineaTxt(corta.k) || 'No line')+' has the most left: '+kdoN(corta.s.ordC - corta.s.prodC)+' cases.' : ''),
      screen:'screen-output', action:'Open output'});
  }
  if(D.min > 0){
    var m = {};
    D.dt.forEach(function(r){ var k = String(r.line || ''); m[k] = (m[k] || 0) + (dtMinutos(r) || 0); });
    var peor = Object.keys(m).sort(function(x, y){ return m[y] - m[x]; })[0];
    var causa = dtTopCausa(D.dt);
    a.push({title:(opsLineaTxt(peor) || 'No line')+' lost '+kdoN(m[peor])+' min',
      text:kdoN(D.min)+' minutes of downtime in '+D.dt.length+' stop'+(D.dt.length === 1 ? '' : 's')+
        (causa ? ', mostly '+causa.cause+' ('+kdoN(causa.min)+' min)' : '')+'.',
      screen:'screen-downtime', action:'Review downtime'});
  }
  var mejor = lineas.filter(function(x){ return x.s.conCases && x.s.cases > 0; })
    .sort(function(x, y){ return y.s.cases - x.s.cases; })[0];
  if(mejor){
    a.push({title:(opsLineaTxt(mejor.k) || 'No line')+' made the most: '+kdoN(mejor.s.cases)+' cases',
      text:kdoN(D.s.cases)+' cases'+(D.s.conLbs ? ' and '+kdoN(D.s.lbs)+' lbs' : '')+' across '+lineas.length+' line'+(lineas.length === 1 ? '' : 's')+' in this period.',
      screen:'screen-output', action:'Open output'});
  }
  if(!a.length){
    a.push({title:'Your next insight starts with an entry',
      text:'There is no output, attendance or downtime in this selection. Record the shift or choose another period.',
      screen:'screen-output', action:'Open output'});
  }
  return a;
}
function kdoPintaInsight(D){
  var host = document.getElementById('kdo-insight');
  if(!host) return;
  var a = kdoInsights(D), lead = a[0];
  var extra = a.length > 1 ? ' '+a[1].title+'.' : '';
  var link = canSeeScreen(lead.screen, currentUser, 'operations');
  host.innerHTML = '<div class="nx-insight-icon"><span data-icon="pulse"></span></div>'+
    '<div class="nx-insight-copy"><b>'+esc(lead.title)+'</b><p>'+esc(lead.text+extra)+'</p>'+
    '<small>Calculated from recorded data · selected period unless stated otherwise</small></div>'+
    (link ? '<button class="cbtn" type="button" onclick="kpiIr(\'operations\',\''+lead.screen+'\')">'+esc(lead.action)+' <span aria-hidden="true">↗</span></button>' : '');
  renderIcons(host);
}

// ------------------------------------------------------------------
// Controles y pintado
// ------------------------------------------------------------------
function kdoConstruir(){
  var sel = document.getElementById('kdo-line');
  if(sel && !sel.options.length){
    sel.innerHTML = '<option value="all">All lines</option>' + opsLineOptions('', '', true, true);
  }
}
function kdoPeriodo(dias, btn){
  kdoState.days = dias;
  var caja = document.getElementById('kdo-range');
  if(caja) caja.querySelectorAll('.seg').forEach(function(b){ b.classList.toggle('on', b === btn); });
  renderOpsDash();
}
function kdoSucio(on){
  var b = document.getElementById('kdo-apply');
  if(b) b.classList.toggle('pending', on !== false);
}
function kdoFiltro(){
  kdoSucio(false);
  var l = document.getElementById('kdo-line'), s = document.getElementById('kdo-shift');
  kdoState.line  = l ? l.value : 'all';
  kdoState.shift = s ? s.value : 'all';
  renderOpsDash();
}

function renderOpsDash(){
  if(!document.getElementById('kdo-kpis') || typeof currentUser === 'undefined' || !currentUser) return;
  kdoConstruir();
  var D = kdoDatos();
  var r = document.getElementById('kdo-range-label');
  if(r){
    r.textContent =
      (kdoState.days === 1 ? 'Today' : kpiDiaCorto(D.v.ini)+' – today') +
      ' · ' + (kdoState.line === 'all' ? 'All lines' : opsLineaTxt(kdoState.line)) +
      ' · ' + (kdoState.shift === 'all' ? 'All shifts' : opsTurno(kdoState.shift));
  }
  kdoPintaCasillas(D);
  kdoPintaInsight(D);
  kdoPintaLineas(D);
  kdoPintaProductos(D);
  kdoPintaParos(D);
  kdoPintaAsistencia(D);
  kdoPintaPendiente(D);
}
