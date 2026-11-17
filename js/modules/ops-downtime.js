// ===== OPERATIONS › DOWNTIME =====
// Cada paro de una linea: a que hora se paro y a que hora volvio (los minutos
// los cuenta la hoja), la causa, que paso, que se hizo y quien lo arreglo.
// Sin hora de regreso la linea sigue parada: sale en rojo y con un boton para
// marcar que ya corre.

var DT_CAUSES = ['Mechanical', 'Electrical', 'Labeling', 'Packaging material', 'Waiting for product', 'Changeover',
                 'Sanitation', 'Quality hold', 'Staffing', 'Break / lunch', 'Other'];

function dtCauseOptions(sel, vacio){
  return (vacio ? '<option value="">'+vacio+'</option>' : '') + DT_CAUSES.map(function(c){
    return '<option value="'+esc(c)+'"'+(c === sel ? ' selected' : '')+'>'+esc(c)+'</option>';
  }).join('');
}
// Minutos del paro; si sigue abierto y es de hoy, lo que lleva hasta ahora
function dtMinutos(r){
  if(r.end) return opsMinutos(r.start, r.end);
  if(String(r.date || '').slice(0, 10) === localDateStr()) return opsMinutos(r.start, opsAhora());
  return null;
}
function dtAbierto(r){ return !r.end; }

function initDowntime(){
  opsInitFiltro('dt');
  dtConstruir();
  if(typeof renderProductOptions === 'function') renderProductOptions('dt-product-list');
  renderDowntime();
}
function dtAplicar(){ opsAplicar('dt', renderDowntime); }

function dtConstruir(){
  var host = document.getElementById('dt-sheet');
  if(!host || document.getElementById('dt-body')) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet ops-sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Line</th><th>Start</th><th>End</th><th class="num">Minutes</th><th>Cause</th>'+
      '<th>Product #</th><th class="wide">What happened</th><th class="wide">Action taken</th><th>Fixed by</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="dt-new"><tr class="newrow">'+
      '<td class="rn">New</td>'+
      '<td><select class="cell" id="dt-line">'+opsLineOptions('', 'Line')+'</select></td>'+
      '<td><input type="time" class="cell ops-time" id="dt-start" aria-label="Stopped at" oninput="dtMinNueva()"></td>'+
      '<td><input type="time" class="cell ops-time" id="dt-end" aria-label="Running again at" oninput="dtMinNueva()"></td>'+
      '<td class="num soft" id="dt-min">—</td>'+
      '<td><select class="cell" id="dt-cause">'+dtCauseOptions('', 'Cause')+'</select></td>'+
      '<td><input class="cell ops-short" id="dt-product" list="dt-product-list" placeholder="Product #" autocomplete="off" autocapitalize="characters"></td>'+
      '<td class="wide"><input class="cell" id="dt-what" placeholder="What happened" autocomplete="off"></td>'+
      '<td class="wide"><input class="cell" id="dt-action" placeholder="What was done" autocomplete="off"></td>'+
      '<td><input class="cell ops-short" id="dt-fixed" placeholder="Who" autocomplete="off" '+
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();dtAgregar();}"></td>'+
      '<td><button class="sheet-btn" onclick="dtAgregar()">Add</button></td>'+
    '</tr></tbody>'+
    '<tbody id="dt-body"></tbody></table></div>';
}
function dtMinNueva(){
  var e = document.getElementById('dt-min');
  if(!e) return;
  var m = opsMinutos((document.getElementById('dt-start') || {}).value, (document.getElementById('dt-end') || {}).value);
  e.textContent = m == null ? '—' : m;
}

function dtAgregar(){
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  var line = g('dt-line'), cause = g('dt-cause');
  if(!line){ toast('Select the line'); return; }
  if(!cause){ toast('Select the cause'); return; }
  var start = g('dt-start') || opsAhora();
  var num = normNumber(g('dt-product'));
  var p = num ? findProduct(num) : null;
  var f = opsFiltro('dt');
  var r = {id:newRecordId(), date:f.date, shift:String(f.shift), line:line, start:start, end:g('dt-end'), cause:cause,
    product: p ? normNumber(p.number) : num, productName: p ? (p.name || '') : '',
    what:g('dt-what'), action:g('dt-action'), fixedBy:g('dt-fixed'), createdAt:localISOStr(), createdBy:opsQuien()};
  opsGuardar('downtime', r, true);
  opsLog('Line stop', 'Line '+line+' · '+cause+' · '+opsHora12(start)+(r.end ? ' to '+opsHora12(r.end) : ' (still down)'));
  ['dt-start', 'dt-end', 'dt-product', 'dt-what', 'dt-action', 'dt-fixed'].forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
  ['dt-line', 'dt-cause'].forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
  dtMinNueva();
  opsRepintar('screen-downtime', renderDowntime);
  toast('Line '+line+' stop added'+(r.end ? '' : ': still down'));
}

function dtDelDia(f){
  return opsDelDia('downtime', f).sort(function(a, b){
    return String(a.start || '').localeCompare(String(b.start || '')) || (parseInt(a.line, 10) || 0) - (parseInt(b.line, 10) || 0);
  });
}
// La causa que mas minutos se llevo
function dtTopCausa(lista){
  var m = {};
  lista.forEach(function(r){ m[r.cause || 'Other'] = (m[r.cause || 'Other'] || 0) + (dtMinutos(r) || 0); });
  var k = Object.keys(m).sort(function(a, b){ return m[b] - m[a]; })[0];
  return k ? {cause:k, min:m[k]} : null;
}
function renderDowntime(){
  dtConstruir();
  var f = opsFiltro('dt');
  var lista = dtDelDia(f);
  var total = lista.reduce(function(a, r){ return a + (dtMinutos(r) || 0); }, 0);
  var abiertos = lista.filter(dtAbierto).length;
  var top = dtTopCausa(lista);
  var kp = document.getElementById('dt-kpis');
  if(kp){
    kp.innerHTML =
      kpiCard(lista.length, 'line stops', {icono:'alert'}) +
      kpiCard(total, 'minutes down', {tono:'bad', icono:'clock', note: total >= 60 ? opsHoras(total)+' h' : ''}) +
      kpiCard(abiertos, 'still down', {tono:'bad', icono:'ban'}) +
      kpiCard(top ? esc(top.cause) : '—', 'top cause', {icono:'chart', note: top ? top.min+' min' : ''});
    renderIcons(kp);
  }
  var body = document.getElementById('dt-body');
  if(!body) return;
  if(!lista.length){
    body.innerHTML = '<tr><td colspan="11" class="sheet-empty" style="border:0">No line stops for this day and shift.</td></tr>';
    return;
  }
  body.innerHTML = lista.map(function(r, i){ return dtFilaHTML(r, i + 1); }).join('');
  renderIcons(body);
}
function dtFilaHTML(r, i){
  var id = r.id, min = dtMinutos(r);
  var inp = function(campo, cls, extra){
    return '<input class="cell '+(cls || '')+'" value="'+esc(r[campo] || '')+'" aria-label="'+campo+'" '+(extra || '')+
      ' onchange="dtCampo('+id+',\''+campo+'\',this)">';
  };
  var minutos = r.end ? '<b>'+(min == null ? '—' : min)+'</b>'
    : '<span class="pill bad">Down'+(min == null ? '' : ' '+min+' min')+'</span>';
  return '<tr'+(r.end ? '' : ' class="dt-open"')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td><select class="cell" aria-label="Line" onchange="dtCampo('+id+',\'line\',this)">'+opsLineOptions(r.line, '—')+'</select></td>'+
    '<td>'+inp('start', 'ops-time', 'type="time"')+'</td>'+
    '<td><div class="dt-fin">'+inp('end', 'ops-time', 'type="time"')+
      (r.end ? '' : '<button class="ico-btn sm" type="button" data-tip="Running again now" aria-label="Line '+esc(r.line)+' running again now" onclick="dtArriba('+id+')"><span data-icon="check"></span></button>')+
    '</div></td>'+
    '<td class="num">'+minutos+'</td>'+
    '<td><select class="cell" aria-label="Cause" onchange="dtCampo('+id+',\'cause\',this)">'+dtCauseOptions(r.cause)+'</select></td>'+
    '<td>'+inp('product', 'ops-short', 'list="dt-product-list" placeholder="Product #" autocapitalize="characters"')+'</td>'+
    '<td class="wide">'+inp('what', '', 'placeholder="What happened"')+'</td>'+
    '<td class="wide">'+inp('action', '', 'placeholder="What was done"')+'</td>'+
    '<td>'+inp('fixedBy', 'ops-short', 'placeholder="Who"')+'</td>'+
    '<td class="acts"><button class="run-del" type="button" title="Delete" aria-label="Delete this stop" onclick="dtBorrar('+id+')"><span data-icon="close"></span></button></td>'+
  '</tr>';
}
function dtCampo(id, campo, el){
  var r = opsBuscar('downtime', id);
  if(!r) return;
  var v = String(el.value || '').trim();
  if(campo === 'start' && !v){ el.value = r.start || ''; toast('The stop needs its start time'); return; }
  if(campo === 'product'){
    v = normNumber(v);
    var p = v ? findProduct(v) : null;
    r.productName = p ? (p.name || '') : '';
  }
  if(String(r[campo] || '') === v) return;
  r[campo] = v;
  opsGuardar('downtime', r, false);
  if(campo === 'end' && v) opsLog('Line running again', 'Line '+r.line+' · '+r.cause+' · '+dtMinutos(r)+' min');
  opsRepintar('screen-downtime', renderDowntime);
}
function dtArriba(id){
  var r = opsBuscar('downtime', id);
  if(!r) return;
  r.end = opsAhora();
  opsGuardar('downtime', r, false);
  opsLog('Line running again', 'Line '+r.line+' · '+r.cause+' · '+dtMinutos(r)+' min');
  opsRepintar('screen-downtime', renderDowntime);
  toast('Line '+r.line+' running again · '+dtMinutos(r)+' min down');
}
function dtBorrar(id){
  var r = opsBuscar('downtime', id);
  if(!r || !opsPuedeBorrar()) return;
  if(!confirm('Delete this stop of line '+r.line+'?')) return;
  opsBorrar('downtime', id);
  opsLog('Line stop deleted', 'Line '+r.line+' · '+r.cause+' · '+opsFechaTxt(r.date));
  opsRepintar('screen-downtime', renderDowntime);
}

// ===== REPORTE DEL DIA =====
var DT_COLS = [{h:'Line', w:11}, {h:'Start', w:15}, {h:'End', w:15}, {h:'Minutes', w:14, al:'right'}, {h:'Cause', w:26},
  {h:'Product #', w:18}, {h:'What happened', w:52}, {h:'Action taken', w:52}, {h:'Fixed by', w:22}];
function dtFilaReporte(r){
  var m = dtMinutos(r);
  return ['Line '+(r.line || ''), opsHora12(r.start), r.end ? opsHora12(r.end) : 'still down', m == null ? '' : m,
          r.cause || '', r.product || '', r.what || '', r.action || '', r.fixedBy || ''];
}
function dtResumenLinea(lista){
  var m = {};
  lista.forEach(function(r){
    var k = String(r.line || '');
    if(!m[k]) m[k] = {stops:0, min:0};
    m[k].stops++; m[k].min += dtMinutos(r) || 0;
  });
  return Object.keys(m).sort(function(a, b){ return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); })
    .map(function(k){ return ['Line '+k, m[k].stops, m[k].min, opsHoras(m[k].min)]; });
}
function dtResumenCausa(lista){
  var m = {}, total = 0;
  lista.forEach(function(r){
    var k = r.cause || 'Other', min = dtMinutos(r) || 0;
    if(!m[k]) m[k] = {stops:0, min:0};
    m[k].stops++; m[k].min += min; total += min;
  });
  return Object.keys(m).sort(function(a, b){ return m[b].min - m[a].min; })
    .map(function(k){ return [k, m[k].stops, m[k].min, total ? Math.round(m[k].min / total * 100) : 0]; });
}
function dtDayPdf(){
  var f = opsFiltro('dt');
  var l = dtDelDia(f);
  var total = l.reduce(function(a, r){ return a + (dtMinutos(r) || 0); }, 0);
  return opsPdf({
    title: 'Line downtime', sub: opsFechaTxt(f.date)+' · '+opsTurno(f.shift),
    file: 'Downtime_'+f.date+'_shift'+f.shift+'.pdf',
    sections: [{
      title: 'Line stops',
      kpis: [['Stops', l.length], ['Minutes down', total+' ('+opsHoras(total)+' h)'], ['Still down', l.filter(dtAbierto).length]],
      cols: DT_COLS, rows: l.map(dtFilaReporte), empty: 'No line stops for this day and shift'
    }, {
      title: 'By cause',
      cols: [{h:'Cause', w:60}, {h:'Stops', w:20, al:'right'}, {h:'Minutes', w:20, al:'right'}, {h:'% of time', w:20, al:'right'}],
      rows: dtResumenCausa(l).map(function(x){ return [x[0], x[1], x[2], x[3]+'%']; }), empty: 'No line stops'
    }]
  });
}
function dtDayExcel(){
  var f = opsFiltro('dt');
  var l = dtDelDia(f);
  if(!l.length){ toast('Nothing to export'); return; }
  downloadSheet('downtime-'+f.date+'-shift'+f.shift+'.xlsx',
    [['Date', 'Shift'].concat(DT_COLS.map(function(c){ return c.h; }))].concat(l.map(function(r){
      return [f.date, opsTurno(f.shift)].concat(dtFilaReporte(r));
    })), 'Downtime');
}
