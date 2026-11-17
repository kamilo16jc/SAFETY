// ===== OPERATIONS › OUTPUT =====
// Lo que se fabrico de cada producto en el dia y turno: producto #, linea,
// orden, cuanto pedia la orden y cuanto se hizo. El balance lo calcula la
// hoja; "Completed" se marca solo cuando lo hecho alcanza lo pedido y se puede
// cambiar a mano. El LOT con que salio la orden se escribe aqui (si el
// Schedule o la orden de COA ya lo tienen, se propone).
//
// Se cuenta en LIBRAS (el usuario, 16 nov 2026). Si se cuenta en cajas o en
// bolsas, la columna Lbs lo pasa a libras con el catalogo: el tamano de la
// bolsa (5 lbs, 8 oz...) y las bolsas por caja. Se calcula al mostrar, asi
// que si el catalogo se corrige, las libras se corrigen solas.

var OUT_UNITS = [['lbs', 'Lbs'], ['cases', 'Cases'], ['bags', 'Bags'], ['pallets', 'Pallets']];
var OUT_UNIT_DEF = 'lbs';

function outUnitTxt(u){
  if(u === 'units') return 'units';
  var x = OUT_UNITS.filter(function(p){ return p[0] === u; })[0];
  return x ? x[1].toLowerCase() : (u || '');
}
// Libras de UNA bolsa del producto, leidas de su tamano ("5 lbs", "25LB", "12 OZ", "12 ONZ")
function outBolsaLb(p){
  if(!p) return null;
  var lbl = (p.pkg != null && typeof PKGS !== 'undefined' && PKGS[p.pkg]) ? PKGS[p.pkg].label : p.pkgLabel;
  var m = /([\d.]+)\s*(lbs?|pounds?|oz|onz|ounces?|kg|g)\b/i.exec(String(lbl || ''));
  if(!m) return null;
  var n = parseFloat(m[1]), u = m[2].toLowerCase();
  if(!(n > 0)) return null;
  if(/^(oz|onz|ounce)/.test(u)) return n / 16;
  if(u === 'kg') return n * 2.20462;
  if(u === 'g') return n / 453.592;
  return n;
}
// Cuantas libras es 1 de esa unidad para ese producto, y como se saco
function outFactorLb(producto, unidad){
  unidad = unidad || OUT_UNIT_DEF;
  if(unidad === 'lbs') return {f:1, txt:''};
  var p = producto ? findProduct(producto) : null;
  var bolsa = outBolsaLb(p);
  var bl = bolsa == null ? '' : opsFmt(bolsa)+' lb';
  if(unidad === 'bags' || unidad === 'units'){
    return bolsa == null ? {f:null, txt:'The catalog has no bag size for this product'}
                         : {f:bolsa, txt:'1 bag = '+bl};
  }
  if(unidad === 'cases'){
    if(bolsa == null) return {f:null, txt:'The catalog has no bag size for this product'};
    if(!(p.bagsPerCase > 0)) return {f:null, txt:'The catalog has no bags per case for this product'};
    return {f:bolsa * p.bagsPerCase, txt:'1 case = '+p.bagsPerCase+' bags × '+bl+' = '+opsFmt(bolsa * p.bagsPerCase)+' lb'};
  }
  return {f:null, txt:'Pallets cannot be turned into pounds'};
}
// Lo producido (o pedido) en libras; null si no se puede convertir
function outLbs(r, campo){
  var q = opsNum(r[campo || 'produced']);
  if(q == null) return null;
  var k = outFactorLb(r.product, r.unit);
  return k.f == null ? null : q * k.f;
}
function outBalance(r){
  var o = opsNum(r.ordered), p = opsNum(r.produced);
  return o == null ? null : o - (p || 0);
}
function outUnitOptions(sel){
  return OUT_UNITS.map(function(p){ return '<option value="'+p[0]+'"'+(p[0] === sel ? ' selected' : '')+'>'+p[1]+'</option>'; }).join('');
}

function initOutput(){
  opsInitFiltro('out');
  outConstruir();
  if(typeof renderProductOptions === 'function') renderProductOptions('out-product-list');
  renderOutput();
}
function outAplicar(){ opsAplicar('out', renderOutput); }

function outConstruir(){
  var host = document.getElementById('out-sheet');
  if(!host || document.getElementById('out-body')) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet ops-sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Product #</th><th class="wide">Description</th><th>Line</th><th>Order #</th>'+
      '<th class="num">Ordered</th><th class="num">Produced</th><th>Unit</th><th class="num">Lbs</th><th class="num">Balance</th>'+
      '<th>LOT</th><th>Completed</th><th class="ops-note">Notes</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="out-new"><tr class="newrow">'+
      '<td class="rn">New</td>'+
      '<td><input class="cell" id="out-product" list="out-product-list" placeholder="Product #" autocomplete="off" '+
        'autocapitalize="characters" oninput="outProducto()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();outAgregar();}"></td>'+
      '<td class="wide soft" id="out-desc">—</td>'+
      '<td><select class="cell" id="out-line">'+opsLineOptions('', 'Line', true)+'</select></td>'+
      '<td><input class="cell ops-short" id="out-order" list="out-order-list" placeholder="Order #" autocomplete="off"></td>'+
      '<td><input class="cell ops-qty" id="out-ordered" inputmode="decimal" placeholder="Qty" autocomplete="off" oninput="outBalNueva()"></td>'+
      '<td><input class="cell ops-qty" id="out-produced" inputmode="decimal" placeholder="Qty" autocomplete="off" oninput="outBalNueva()" '+
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();outAgregar();}"></td>'+
      '<td><select class="cell" id="out-unit" onchange="outBalNueva()">'+outUnitOptions(OUT_UNIT_DEF)+'</select></td>'+
      '<td class="num soft" id="out-lbs">—</td>'+
      '<td class="num soft" id="out-bal">—</td>'+
      '<td><input class="cell ops-lot" id="out-lot" placeholder="LOT" autocomplete="off" autocapitalize="characters"></td>'+
      '<td class="soft">auto</td>'+
      '<td class="ops-note"><input class="cell" id="out-notes" placeholder="Note" autocomplete="off"></td>'+
      '<td><button class="sheet-btn" onclick="outAgregar()">Add</button></td>'+
    '</tr></tbody>'+
    '<tbody id="out-body"></tbody></table></div>'+
    '<datalist id="out-order-list"></datalist>';
}

// ---- La fila nueva: al escribir el producto sale su descripcion y, si el
// Schedule o una orden de COA lo tienen, la linea, la orden y el LOT ----
function outProducto(){
  var num = normNumber((document.getElementById('out-product') || {}).value || '');
  var p = num ? findProduct(num) : null;
  var d = document.getElementById('out-desc');
  if(d) d.textContent = p ? (p.name || '—') : '—';
  outBalNueva();
  var f = opsFiltro('out');
  var set = function(id, v){ var e = document.getElementById(id); if(e && !e.value && v) e.value = v; };
  if(p && typeof runsFor === 'function'){
    var run = runsFor(f.date, f.shift).filter(function(r){ return normNumber(r.product) === normNumber(p.number); })[0];
    if(run){ set('out-line', String(run.line || '')); set('out-lot', run.lot || ''); }
  }
  var ol = document.getElementById('out-order-list');
  var ords = (p && typeof ordersForProduct === 'function') ? ordersForProduct(p.number, f.date) : [];
  if(ol) ol.innerHTML = ords.map(function(o){ return '<option value="'+esc(o.order)+'">'+esc((o.customer || '')+(o.po ? ' · PO '+o.po : ''))+'</option>'; }).join('');
  if(ords.length === 1){
    set('out-order', ords[0].order);
    if(typeof orLots === 'function' && orLots(ords[0]).length === 1) set('out-lot', orLots(ords[0])[0]);
  }
}
function outBalNueva(){
  var g = function(id){ return (document.getElementById(id) || {}).value || ''; };
  var e = document.getElementById('out-bal');
  if(e){
    var b = outBalance({ordered:g('out-ordered'), produced:g('out-produced')});
    e.textContent = b == null ? '—' : opsFmt(b);
  }
  var l = document.getElementById('out-lbs');
  if(l){
    var r = {product:normNumber(g('out-product')), unit:g('out-unit'), produced:g('out-produced')};
    var lb = outLbs(r), k = outFactorLb(r.product, r.unit);
    l.textContent = lb == null ? '—' : opsFmt(lb);
    if(k.txt && r.product) l.setAttribute('data-tip', k.txt); else l.removeAttribute('data-tip');
  }
}
function outLimpiar(){
  ['out-product', 'out-order', 'out-ordered', 'out-produced', 'out-lot', 'out-notes'].forEach(function(id){
    var e = document.getElementById(id); if(e) e.value = '';
  });
  var l = document.getElementById('out-line'); if(l) l.value = '';
  var d = document.getElementById('out-desc'); if(d) d.textContent = '—';
  var b = document.getElementById('out-bal'); if(b) b.textContent = '—';
  var lb = document.getElementById('out-lbs'); if(lb){ lb.textContent = '—'; lb.removeAttribute('data-tip'); }
}

function outAgregar(){
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  var num = normNumber(g('out-product'));
  if(!num){ toast('Enter the product number'); return; }
  var p = findProduct(num);
  if(!p && !confirm('Product '+num+' is not in the catalog. Add it anyway?')) return;
  var ordered = g('out-ordered'), produced = g('out-produced');
  if(ordered && opsNum(ordered) == null){ toast('Ordered must be a number'); return; }
  if(produced && opsNum(produced) == null){ toast('Produced must be a number'); return; }
  var f = opsFiltro('out');
  var r = {id:newRecordId(), date:f.date, shift:String(f.shift), line:g('out-line'),
    product: p ? normNumber(p.number) : num, productName: p ? (p.name || '') : '',
    order:g('out-order'), ordered:ordered === '' ? '' : String(opsNum(ordered)), produced:produced === '' ? '' : String(opsNum(produced)),
    unit:g('out-unit') || OUT_UNIT_DEF, lot:g('out-lot').toUpperCase(), notes:g('out-notes'), completed:false,
    createdAt:localISOStr(), createdBy:opsQuien()};
  var b = outBalance(r);
  if(b != null && opsNum(r.ordered) > 0 && b <= 0) r.completed = true;
  opsGuardar('output', r, true);
  opsLog('Output added', 'Product '+r.product+' · '+(r.produced || 0)+' '+outUnitTxt(r.unit)+(r.line ? ' · '+opsLineaTxt(r.line) : ''));
  outLimpiar();
  opsRepintar('screen-output', renderOutput);
  var e = document.getElementById('out-product'); if(e) e.focus();
  toast('Product '+r.product+' added');
}

// ---- Las corridas del Schedule de ese dia y turno, de una vez ----
function outDesdeSchedule(){
  var f = opsFiltro('out');
  var runs = (typeof runsFor === 'function') ? runsFor(f.date, f.shift) : [];
  if(!runs.length){ toast('Nothing scheduled for '+opsFechaTxt(f.date)+' · '+opsTurno(f.shift)); return; }
  var ya = opsDelDia('output', f);
  var nuevas = runs.filter(function(run){
    return !ya.some(function(r){
      return (r.runId != null && String(r.runId) === String(run.id)) ||
             (normNumber(r.product) === normNumber(run.product) && String(r.line) === String(run.line));
    });
  });
  if(!nuevas.length){ toast('The scheduled products are already on this sheet'); return; }
  var unidad = (document.getElementById('out-unit') || {}).value || OUT_UNIT_DEF;
  nuevas.forEach(function(run){
    opsGuardar('output', {id:newRecordId(), date:f.date, shift:String(f.shift), line:String(run.line || ''),
      product:run.product || '', productName:run.productName || '', order:'', ordered:'', produced:'',
      unit:unidad, lot:run.lot || '', notes:'', completed:false, runId:run.id,
      createdAt:localISOStr(), createdBy:opsQuien()}, true);
  });
  opsLog('Output from schedule', nuevas.length+' products · '+opsFechaTxt(f.date)+' · '+opsTurno(f.shift));
  opsRepintar('screen-output', renderOutput);
  toast(nuevas.length+' scheduled product(s) added: fill in what was produced');
}

// ===== LA HOJA =====
function outDelDia(f){
  return opsDelDia('output', f).sort(function(a, b){
    return (parseInt(a.line, 10) || 99) - (parseInt(b.line, 10) || 99) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}
// Lo producido en LIBRAS (lo que se pudo convertir) + lo que no se pudo, en su unidad
function outTotales(lista){
  var lb = 0, hayLb = false, otros = {};
  lista.forEach(function(r){
    var q = opsNum(r.produced);
    if(q == null) return;
    var x = outLbs(r);
    if(x != null){ lb += x; hayLb = true; return; }
    var u = r.unit || OUT_UNIT_DEF;
    otros[u] = (otros[u] || 0) + q;
  });
  var partes = hayLb ? [opsFmt(lb)+' lbs'] : [];
  Object.keys(otros).forEach(function(u){ partes.push(opsFmt(otros[u])+' '+outUnitTxt(u)+' (no lbs)'); });
  return partes.join(' · ');
}
// La tarjeta: las libras en grande; lo que no se pudo pasar a libras, abajo
function outKpiProducido(lista){
  var t = outTotales(lista).split(' · ');
  var lb = /lbs$/.test(t[0]) ? t.shift() : '0 lbs';
  var otros = t.filter(Boolean).map(function(x){ return x.replace(' (no lbs)', ''); }).join(', ');
  return kpiCard(lb, 'produced', {icono:'chart', note: otros ? 'Not in lbs: '+otros : ''});
}
// La celda Lbs: al pasar el raton dice como se saco (o por que no se pudo)
function outLbsHTML(r){
  if(opsNum(r.produced) == null) return '<span class="soft">—</span>';
  var k = outFactorLb(r.product, r.unit), lb = outLbs(r);
  if(lb == null) return '<span class="soft ops-nolb" data-tip="'+esc(k.txt)+'">—</span>';
  return '<span'+(k.txt ? ' class="ops-conv" data-tip="'+esc(k.txt)+'"' : '')+'>'+opsFmt(lb)+'</span>';
}
function renderOutput(){
  outConstruir();
  var f = opsFiltro('out');
  var lista = outDelDia(f);
  var hechas = lista.filter(function(r){ return r.completed; }).length;
  var conBal = lista.filter(function(r){ var b = outBalance(r); return !r.completed && b != null && b > 0; }).length;
  var kp = document.getElementById('out-kpis');
  if(kp){
    kp.innerHTML =
      kpiCard(lista.length, 'products run', {icono:'box'}) +
      kpiCard(hechas, 'orders completed', {tono:'ok', icono:'check'}) +
      kpiCard(conBal, 'with balance left', {tono:'bad', icono:'alert'}) +
      outKpiProducido(lista);
    renderIcons(kp);
  }
  var body = document.getElementById('out-body');
  if(!body) return;
  if(!lista.length){
    body.innerHTML = '<tr><td colspan="14" class="sheet-empty" style="border:0">Nothing entered for this day and shift. '+
      'Add each product in the top row, or bring the scheduled products from the ⋯ menu.</td></tr>';
    return;
  }
  body.innerHTML = lista.map(function(r, i){ return outFilaHTML(r, i + 1); }).join('');
  renderIcons(body);
}
function outBalHTML(r){
  var b = outBalance(r);
  if(b == null) return '<span class="soft">—</span>';
  if(b > 0) return '<span class="pill '+(r.completed ? '' : 'bad')+'">'+opsFmt(b)+' left</span>';
  if(b < 0) return '<span class="pill ok">'+opsFmt(-b)+' over</span>';
  return '<span class="pill ok">0</span>';
}
function outFilaHTML(r, i){
  var id = r.id;
  var inp = function(campo, cls, extra){
    return '<input class="cell '+(cls || '')+'" value="'+esc(r[campo] == null ? '' : r[campo])+'" aria-label="'+campo+'" '+
      (extra || '')+' onchange="outCampo('+id+',\''+campo+'\',this)">';
  };
  return '<tr'+(r.completed ? ' class="done"' : '')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+esc(r.product || '—')+'</td>'+
    '<td class="wide">'+esc(r.productName || '—')+'</td>'+
    '<td><select class="cell" aria-label="Line" onchange="outCampo('+id+',\'line\',this)">'+opsLineOptions(r.line, '—', true)+'</select></td>'+
    '<td>'+inp('order', 'ops-short', 'placeholder="Order #"')+'</td>'+
    '<td>'+inp('ordered', 'ops-qty', 'inputmode="decimal"')+'</td>'+
    '<td>'+inp('produced', 'ops-qty', 'inputmode="decimal"')+'</td>'+
    '<td><select class="cell" aria-label="Unit" onchange="outCampo('+id+',\'unit\',this)">'+outUnitOptions(r.unit || OUT_UNIT_DEF)+'</select></td>'+
    '<td class="num">'+outLbsHTML(r)+'</td>'+
    '<td class="num">'+outBalHTML(r)+'</td>'+
    '<td>'+inp('lot', 'ops-lot', 'placeholder="LOT" autocapitalize="characters"')+'</td>'+
    '<td><button class="cell-tog'+(r.completed ? ' on' : '')+'" onclick="outCompletar('+id+')">'+(r.completed ? '✓ Yes' : 'No')+'</button></td>'+
    '<td class="ops-note">'+inp('notes', '', 'placeholder="Note"')+'</td>'+
    '<td class="acts"><button class="run-del" type="button" title="Delete" aria-label="Delete product '+esc(r.product)+'" onclick="outBorrar('+id+')"><span data-icon="close"></span></button></td>'+
  '</tr>';
}
function outCampo(id, campo, el){
  var r = opsBuscar('output', id);
  if(!r) return;
  var v = String(el.value || '').trim();
  if(campo === 'ordered' || campo === 'produced'){
    if(v !== '' && opsNum(v) == null){ toast('Write a number'); el.value = r[campo] || ''; return; }
    if(v !== '') v = String(opsNum(v));
  }
  if(campo === 'lot') v = v.toUpperCase();
  if(String(r[campo] == null ? '' : r[campo]) === v){ el.value = v; return; }
  var antes = outBalance(r);
  r[campo] = v;
  // Llego a lo pedido: queda completa (se puede quitar a mano)
  var b = outBalance(r);
  if((campo === 'ordered' || campo === 'produced') && b != null && opsNum(r.ordered) > 0 && b <= 0 && (antes == null || antes > 0)) r.completed = true;
  opsGuardar('output', r, false);
  opsRepintar('screen-output', renderOutput);
}
function outCompletar(id){
  var r = opsBuscar('output', id);
  if(!r) return;
  r.completed = !r.completed;
  opsGuardar('output', r, false);
  opsLog(r.completed ? 'Order completed' : 'Order reopened', 'Product '+r.product+(r.order ? ' · Order '+r.order : ''));
  opsRepintar('screen-output', renderOutput);
}
function outBorrar(id){
  var r = opsBuscar('output', id);
  if(!r || !opsPuedeBorrar()) return;
  if(!confirm('Delete product '+r.product+' from this sheet?')) return;
  opsBorrar('output', id);
  opsLog('Output deleted', 'Product '+r.product+' · '+opsFechaTxt(r.date));
  opsRepintar('screen-output', renderOutput);
}

// ===== REPORTE DEL DIA =====
var OUT_COLS = [{h:'Line', w:11}, {h:'Product #', w:20}, {h:'Description', w:44}, {h:'Order #', w:20}, {h:'Ordered', w:17, al:'right'},
  {h:'Produced', w:17, al:'right'}, {h:'Unit', w:13}, {h:'Lbs', w:17, al:'right'}, {h:'Balance', w:17, al:'right'}, {h:'LOT', w:22}, {h:'Completed', w:15}, {h:'Notes', w:40}];
// xl: numeros sin comas, para que Excel los sume
function outFilaReporte(r, xl){
  var b = outBalance(r);
  var n = xl ? function(v){ var x = opsNum(v); return x == null ? '' : x; } : opsFmt;
  var lb = outLbs(r);
  var lbsTxt = lb == null ? '' : xl ? Math.round(lb * 100) / 100 : opsFmt(lb);
  return [opsLineaTxt(r.line), r.product || '', r.productName || '', r.order || '', n(r.ordered), n(r.produced),
          outUnitTxt(r.unit), lbsTxt, b == null ? '' : n(b), r.lot || '', r.completed ? 'Yes' : 'No', r.notes || ''];
}
function outDayPdf(){
  var f = opsFiltro('out');
  var l = outDelDia(f);
  return opsPdf({
    title: 'Production output', sub: opsFechaTxt(f.date)+' · '+opsTurno(f.shift),
    file: 'Output_'+f.date+'_shift'+f.shift+'.pdf',
    sections: [{
      title: 'Products',
      kpis: [['Products run', l.length], ['Completed', l.filter(function(r){ return r.completed; }).length], ['Produced', outTotales(l) || '0']],
      cols: OUT_COLS, rows: l.map(function(r){ return outFilaReporte(r); }), empty: 'Nothing entered for this day and shift'
    }]
  });
}
function outDayExcel(){
  var f = opsFiltro('out');
  var l = outDelDia(f);
  if(!l.length){ toast('Nothing to export'); return; }
  downloadSheet('output-'+f.date+'-shift'+f.shift+'.xlsx',
    [['Date', 'Shift'].concat(OUT_COLS.map(function(c){ return c.h; }))].concat(l.map(function(r){
      return [f.date, opsTurno(f.shift)].concat(outFilaReporte(r, true));
    })), 'Output');
}
