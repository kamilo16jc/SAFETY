// ===== COA ORDERS (Production) =====
// La orden llega en PAPEL: QA la revisa una por una y la sube aqui con su Order,
// su PO y los productos que lleva (pedido del usuario, 10 nov 2026). Sample
// Analysis toma de aqui el Order y el PO cuando se capta la muestra de uno de
// esos productos. El COA se hace por producto, pero todos los de una orden
// llevan el mismo Order y PO.
//
// La fecha de produccion es opcional: si se pone, la orden muestra el LOT que
// debe tener cada producto (YYDDD Caputo / DDDYY del cliente que lo usa,
// js/core/lot.js) y Sample Analysis avisa si el de la muestra no coincide.
//
// orders: {id, order, po, products:[numero], prodDate, notes, customer,
//          customerKey, closed, createdAt, createdBy, editedAt, editedBy}

var orView = 'open', orEditId = null, orPicks = [];

function getOrders(){ var d = getDB(); if(!d.orders) d.orders = []; return d.orders; }

// 00577346 (etiqueta) y 577346 (escrito) son la misma orden
function orNum(x){ return String(x == null ? '' : x).trim().toUpperCase().replace(/^0+(?=\d)/, ''); }

function initOrders(){
  orEditId = null; orPicks = [];
  buildOrdersSheet();
  if(typeof renderProductOptions === 'function') renderProductOptions('or-product-list');
  orLimpiarFila();
  renderOrders();
}

// ---- Cliente y LOT esperado ----
function orClientes(nums){
  var vistos = {}, out = [];
  (nums || []).forEach(function(n){
    var p = (typeof findProduct === 'function') ? findProduct(n) : null;
    var c = (p && typeof productCustomer === 'function') ? productCustomer(p) : null;
    if(c && !vistos[c.company]){ vistos[c.company] = 1; out.push(c); }
  });
  return out;
}
// El LOT que debe llevar un producto de la orden (solo si tiene fecha)
function orderExpectedLot(o, num){
  if(!o || !o.prodDate || typeof lotCodigo !== 'function') return '';
  var p = (typeof findProduct === 'function') ? findProduct(num || (o.products || [])[0]) : null;
  var fmt = (typeof lotFormatoProducto === 'function') ? lotFormatoProducto(p) : 'yyddd';
  return lotCodigo(String(o.prodDate).slice(0, 10), fmt);
}

// ---- Que muestras ya se testearon de cada orden ----
// Una muestra es de la orden si quedo ligada (orderId) o si lleva su numero de
// orden y es de uno de sus productos.
function orAnalisisDe(o, num){
  if(typeof getAnalyses !== 'function') return [];
  return getAnalyses().filter(function(a){
    if(normNumber(a.product) !== normNumber(num)) return false;
    if(a.orderId != null && a.orderId !== '') return String(a.orderId) === String(o.id);
    return !!orNum(a.order) && orNum(a.order) === orNum(o.order);
  });
}
function orEstadoProducto(o, num){
  var l = orAnalisisDe(o, num);
  if(!l.length) return {estado:'pending'};
  var hecho = l.filter(function(a){ return typeof analysisDone === 'function' ? analysisDone(a) : true; })[0];
  return hecho ? {estado:'done', a:hecho} : {estado:'testing', a:l[0]};
}
function orProgreso(o){
  var ps = o.products || [];
  var hechos = ps.filter(function(n){ return orEstadoProducto(o, n).estado === 'done'; }).length;
  return {hechos:hechos, total:ps.length, completa: ps.length > 0 && hechos === ps.length};
}

// ---- Lo que usa Sample Analysis ----
// Las ordenes abiertas que llevan este producto y aun no tienen su muestra; las
// de esa fecha de produccion primero.
function ordersForProduct(num, day){
  num = normNumber(num);
  if(!num) return [];
  return getOrders().filter(function(o){
    if(o.closed) return false;
    if((o.products || []).map(normNumber).indexOf(num) < 0) return false;
    return orEstadoProducto(o, num).estado === 'pending';
  }).sort(function(a, b){
    var da = String(a.prodDate || '').slice(0, 10) === day ? 0 : 1;
    var dbb = String(b.prodDate || '').slice(0, 10) === day ? 0 : 1;
    return (da - dbb) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}
// La orden con ese numero (la que lleva el producto, si se da)
function orderByNumber(n, num){
  var k = orNum(n);
  if(!k) return null;
  var l = getOrders().filter(function(o){ return orNum(o.order) === k; });
  if(num){
    var con = l.filter(function(o){ return (o.products || []).map(normNumber).indexOf(normNumber(num)) >= 0; });
    if(con.length) return con[0];
  }
  return l[0] || null;
}
function orderById(id){ return getOrders().filter(function(o){ return String(o.id) === String(id); })[0] || null; }

// ===== LA HOJA =====
function buildOrdersSheet(){
  var host = document.getElementById('or-sheet');
  if(!host || document.getElementById('or-body')) return;
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Order</th><th>PO</th><th>Customer</th>'+
      '<th class="wide">Products</th><th>Prod. date</th><th>LOT</th><th>Tested</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="or-new"><tr class="newrow">'+
      '<td class="rn" id="or-n-rn">New</td>'+
      '<td><input class="cell" id="or-order" placeholder="Order #" autocomplete="off" inputmode="numeric"></td>'+
      '<td><input class="cell" id="or-po" placeholder="PO" autocomplete="off" autocapitalize="characters"></td>'+
      '<td class="soft" id="or-n-cust">—</td>'+
      '<td class="wide"><div class="or-picks" id="or-picks"></div>'+
        '<input class="cell" id="or-product" list="or-product-list" placeholder="Add product #" autocomplete="off" '+
          'autocapitalize="characters" oninput="orProductoTecleado()" '+
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();orAddPick(true);}"></td>'+
      '<td><input type="date" class="cell" id="or-date" onchange="orPintarNueva()"></td>'+
      '<td class="code soft" id="or-n-lot">—</td>'+
      '<td class="soft">—</td>'+
      '<td class="or-acts"><button class="sheet-btn" id="or-save" onclick="orSave()">Add</button>'+
        '<button class="run-del" id="or-cancel" hidden onclick="orCancel()" title="Cancel the edit" aria-label="Cancel the edit">'+
        '<span data-icon="close"></span></button></td>'+
    '</tr></tbody>'+
    '<tbody id="or-body"></tbody></table></div>';
  if(typeof renderIcons === 'function') renderIcons(host);
}

// ---- Los productos de la orden (se escogen del catalogo) ----
function orProductoTecleado(){
  var e = document.getElementById('or-product');
  var v = normNumber(e.value);
  if(!v) return;
  // Al escoger de la lista (o escribir el numero completo) se agrega solo
  var ps = (typeof getProducts === 'function') ? getProducts() : [];
  var exacto = ps.filter(function(p){ return normNumber(p.number) === v; }).length > 0;
  var masLargo = ps.some(function(p){ var n = normNumber(p.number); return n !== v && n.indexOf(v) === 0; });
  if(exacto && !masLargo) orAddPick(false);
}
function orAddPick(avisar){
  var e = document.getElementById('or-product');
  var v = normNumber(e.value);
  if(!v) return;
  var p = (typeof findProduct === 'function') ? findProduct(v) : null;
  if(!p){ if(avisar) toast('Product '+v+' is not in the catalog'); return; }
  var num = normNumber(p.number);
  if(orPicks.indexOf(num) < 0) orPicks.push(num);
  e.value = '';
  orPintarNueva();
  e.focus();
}
function orRemovePick(num){
  orPicks = orPicks.filter(function(x){ return x !== num; });
  orPintarNueva();
}
function orChipsHTML(nums, o){
  return nums.map(function(n){
    var p = (typeof findProduct === 'function') ? findProduct(n) : null;
    var nombre = p ? (p.name || '') : 'not in catalog';
    if(!o){
      return '<span class="or-chip">'+esc(n)+(nombre ? ' <small>'+esc(nombre)+'</small>' : '')+
        '<button type="button" onclick="orRemovePick(\''+esc(n)+'\')" aria-label="Remove '+esc(n)+'">×</button></span>';
    }
    var st = orEstadoProducto(o, n);
    var marca = st.estado === 'done' ? '✓ #'+esc(st.a.seq || '') :
                st.estado === 'testing' ? 'in test #'+esc(st.a.seq || '') : 'pending';
    return '<span class="or-chip '+st.estado+'" title="'+esc(nombre)+'">'+esc(n)+
      ' <small>'+esc(nombre)+'</small><b>'+marca+'</b></span>';
  }).join('');
}
// Lo que se ve en la fila de alta: los productos escogidos, el cliente y el LOT
function orPintarNueva(){
  var box = document.getElementById('or-picks');
  if(box) box.innerHTML = orChipsHTML(orPicks, null);
  var cs = orClientes(orPicks);
  var cu = document.getElementById('or-n-cust');
  if(cu){
    cu.textContent = !cs.length ? '—' : cs.length === 1 ? cs[0].company : 'Several customers';
    cu.classList.toggle('warn', cs.length > 1);
  }
  var lot = document.getElementById('or-n-lot');
  var d = (document.getElementById('or-date') || {}).value;
  if(lot) lot.textContent = (d && orPicks.length) ? orderExpectedLot({prodDate:d, products:orPicks}, orPicks[0]) : '—';
}
function orLimpiarFila(){
  orEditId = null; orPicks = [];
  ['or-order', 'or-po', 'or-product', 'or-date'].forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
  var b = document.getElementById('or-save'); if(b) b.textContent = 'Add';
  var c = document.getElementById('or-cancel'); if(c) c.hidden = true;
  var rn = document.getElementById('or-n-rn'); if(rn) rn.textContent = 'New';
  orPintarNueva();
}
function orCancel(){ orLimpiarFila(); }

// ---- Guardar ----
function orSave(){
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  if(g('or-product')) orAddPick(true);                  // lo que quedo escrito sin agregar
  var order = g('or-order'), po = g('or-po'), date = g('or-date');
  if(!order){ toast('Enter the order number'); return; }
  if(!orPicks.length){ toast('Add the products of this order'); return; }
  var otra = getOrders().filter(function(o){ return orNum(o.order) === orNum(order) && String(o.id) !== String(orEditId); })[0];
  if(otra && !confirm('Order '+order+' already exists. Save another one with the same number?')) return;

  var cs = orClientes(orPicks);
  var c = cs[0] || null;
  var db = getDB(); if(!db.orders) db.orders = [];
  var quien = currentUser ? currentUser.name : '—';
  var rec;
  if(orEditId != null){
    rec = db.orders.filter(function(o){ return String(o.id) === String(orEditId); })[0];
    if(!rec){ orLimpiarFila(); return; }
    rec.editedAt = localISOStr(); rec.editedBy = quien;
  } else {
    rec = {id:newRecordId(), closed:false, createdAt:localISOStr(), createdBy:quien};
    db.orders.push(rec);
  }
  rec.order = order; rec.po = po; rec.products = orPicks.slice(); rec.prodDate = date;
  rec.customer = c ? c.company : ''; rec.customerKey = (c && typeof custKey === 'function') ? custKey(c) : '';
  saveDB(db, 'orders');
  if(window.saveToFirebase) window.saveToFirebase('orders', rec);
  if(typeof logActivity === 'function')
    logActivity('analysis', orEditId != null ? 'COA order edited' : 'COA order added',
      'Order '+order+(po ? ' · PO '+po : '')+' · '+rec.products.length+' products', quien);
  toast((orEditId != null ? 'Order '+order+' updated' : 'Order '+order+' added')+' · '+rec.products.length+' products');
  orLimpiarFila();
  renderOrders();
  var e = document.getElementById('or-order'); if(e) e.focus();
}

function orEdit(id){
  var o = orderById(id);
  if(!o) return;
  orEditId = o.id; orPicks = (o.products || []).slice();
  var set = function(k, v){ var e = document.getElementById(k); if(e) e.value = v || ''; };
  set('or-order', o.order); set('or-po', o.po); set('or-date', String(o.prodDate || '').slice(0, 10));
  var b = document.getElementById('or-save'); if(b) b.textContent = 'Save';
  var c = document.getElementById('or-cancel'); if(c) c.hidden = false;
  var rn = document.getElementById('or-n-rn'); if(rn) rn.textContent = 'Edit';
  orPintarNueva();
  var e = document.getElementById('or-order'); if(e){ e.focus(); e.scrollIntoView({block:'center'}); }
}
function orDelete(id){
  var o = orderById(id);
  if(!o) return;
  if(!confirm('Delete order '+o.order+'? The samples keep their Order and PO.')) return;
  var db = getDB();
  db.orders = (db.orders || []).filter(function(x){ return String(x.id) !== String(id); });
  saveDB(db, 'orders');
  if(o._fbId && window.deleteFromFirebase) window.deleteFromFirebase('orders', o._fbId);
  if(String(orEditId) === String(id)) orLimpiarFila();
  renderOrders();
  toast('Order '+o.order+' deleted');
}
// Cerrar a mano una orden que no se va a completar (ya no se propone)
function orToggleClosed(id){
  var db = getDB();
  var o = (db.orders || []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(!o) return;
  o.closed = !o.closed;
  o.editedAt = localISOStr(); o.editedBy = currentUser ? currentUser.name : '—';
  saveDB(db, 'orders');
  if(window.saveToFirebase) window.saveToFirebase('orders', o);
  renderOrders();
  toast(o.closed ? 'Order '+o.order+' closed: Sample Analysis stops offering it' : 'Order '+o.order+' reopened');
}

// ===== FILTROS Y VISTA =====
function setOrView(v){ orView = v; renderOrders(); }
function orFiltrar(){ renderOrders(); }
function orOnKey(e){ if(e.key === 'Enter') renderOrders(); }

function renderOrders(){
  var body = document.getElementById('or-body');
  if(!body) return;
  var q = String((document.getElementById('or-search') || {}).value || '').trim().toLowerCase();
  var todas = getOrders().slice().sort(function(a, b){
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  }).map(function(o){ return {o:o, p:orProgreso(o)}; });
  if(q){
    todas = todas.filter(function(x){
      var o = x.o;
      return [o.order, o.po, o.customer, (o.products || []).join(' '), o.notes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  var abierta = function(x){ return !x.o.closed && !x.p.completa; };
  var abiertas = todas.filter(abierta);
  var pendientes = abiertas.reduce(function(n, x){ return n + (x.p.total - x.p.hechos); }, 0);
  var completas = todas.filter(function(x){ return x.p.completa; });

  var kp = document.getElementById('or-kpis');
  if(kp){
    kp.innerHTML =
      kpiCard(abiertas.length, 'open orders', {icono:'doc', on:orView === 'open', click:"setOrView('open')"}) +
      kpiCard(pendientes, 'products to test', {tono:'bad', icono:'alert', on:orView === 'pending', click:"setOrView('open')"}) +
      kpiCard(completas.length, 'complete', {tono:'ok', icono:'check', on:orView === 'done', click:"setOrView('done')"}) +
      kpiCard(todas.length, 'all orders', {icono:'grid', on:orView === 'all', click:"setOrView('all')"});
    renderIcons(kp);
  }

  var lista = todas.filter(function(x){
    if(orView === 'open') return abierta(x);
    if(orView === 'done') return x.p.completa;
    return true;
  });
  if(!lista.length){
    body.innerHTML = '<tr><td colspan="9" class="sheet-empty" style="border:0">'+
      (todas.length ? 'Nothing in this view. Tap another card to see the rest.'
                    : 'No orders yet. Fill the top row with the order number, its PO and its products.')+'</td></tr>';
    return;
  }
  body.innerHTML = lista.map(function(x, i){ return orRowHTML(x.o, x.p, i+1); }).join('');
  renderIcons(body);
}

function orRowHTML(o, pr, i){
  var lot = o.prodDate ? orderExpectedLot(o) : '';
  var estado = o.closed ? '<span class="pill">Closed</span>' :
               pr.completa ? '<span class="pill ok">'+pr.hechos+' / '+pr.total+'</span>' :
               '<span class="pill'+(pr.hechos ? ' warn' : ' bad')+'">'+pr.hechos+' / '+pr.total+'</span>';
  return '<tr'+(pr.completa ? ' class="done"' : '')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+esc(o.order || '—')+'</td>'+
    '<td class="code">'+esc(o.po || '—')+'</td>'+
    '<td class="soft">'+esc(o.customer || '—')+'</td>'+
    '<td class="wide"><div class="or-picks">'+orChipsHTML(o.products || [], o)+'</div></td>'+
    '<td class="soft">'+(o.prodDate ? esc(fmtDate(String(o.prodDate).slice(0, 10))) : '—')+'</td>'+
    '<td class="code">'+esc(lot || '—')+'</td>'+
    '<td>'+estado+'</td>'+
    '<td class="or-acts"><div class="or-acts-in">'+
      '<button class="ico-btn sm" type="button" data-tip="Edit the order" aria-label="Edit order '+esc(o.order)+'" onclick="orEdit('+o.id+')"><span data-icon="note"></span></button>'+
      '<button class="ico-btn sm" type="button" data-tip="'+(o.closed ? 'Reopen' : 'Close: stop offering it in Sample Analysis')+'" '+
        'aria-label="'+(o.closed ? 'Reopen' : 'Close')+' order '+esc(o.order)+'" onclick="orToggleClosed('+o.id+')"><span data-icon="'+(o.closed ? 'back' : 'lock')+'"></span></button>'+
      '<button class="run-del" type="button" title="Delete" aria-label="Delete order '+esc(o.order)+'" onclick="orDelete('+o.id+')"><span data-icon="close"></span></button>'+
    '</div></td>'+
  '</tr>';
}

// La lista a Excel, en el orden en que se capturo
function exportOrdersCSV(){
  var l = (typeof xlEntryOrder === 'function') ? xlEntryOrder(getOrders()) : getOrders();
  if(!l.length){ toast('No orders to export'); return; }
  var out = [['Order', 'PO', 'Customer', 'Product', 'Description', 'Prod. date', 'Expected LOT', 'Status', 'Sample #']];
  l.forEach(function(o){
    (o.products || []).forEach(function(n){
      var p = (typeof findProduct === 'function') ? findProduct(n) : null;
      var st = orEstadoProducto(o, n);
      out.push([o.order || '', o.po || '', o.customer || '', n, p ? (p.name || '') : '',
        String(o.prodDate || '').slice(0, 10), orderExpectedLot(o, n),
        st.estado === 'done' ? 'Tested' : st.estado === 'testing' ? 'In test' : (o.closed ? 'Closed' : 'Pending'),
        st.a ? (st.a.seq || '') : '']);
    });
  });
  downloadCSV('coa-orders-'+localDateStr()+'.csv', out);
}
