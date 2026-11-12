// ===== STOCK: PONERLE CLIENTE A UN PRODUCTO HECHO PARA INVENTARIO =====
// Pedido del usuario (11 nov 2026): hay productos que se hacen sin cliente,
// solo para tener en stock. Sin cliente no hay forma ni COA. Aqui, con el LOT
// y la fecha en que se hizo, se le pone el cliente (con su Order y su PO) y ya
// sale en COA Generator.
//
// Un mismo LOT se puede vender a VARIOS clientes (decision del usuario): cada
// cliente asignado es un registro propio del COA (analysis con stockOf = id de
// la muestra) con SU cliente, Order, PO y COA. Los resultados (Moisture, Fat,
// pH, la placa, lo del laboratorio de fuera) son los de la muestra: se copian y
// se mantienen al dia con stockSync. Lo que se escribe de resultados en uno de
// ellos va a la muestra.
//
// Esos registros NO salen en Sample Analysis ni en Yeast & Mold (seria la misma
// muestra dos veces): solo en COA Generator, COA Status, COA Orders y Search.

// Lo que es de cada cliente asignado; todo lo demas viene de la muestra
var STOCK_PROPIOS = ['id', '_fbId', 'customer', 'customerKey', 'customerId', 'order', 'po', 'orderId',
  'coaNo', 'coaRev', 'coaAt', 'coaBy', 'changes', 'createdAt', 'createdBy', 'editedAt', 'editedBy',
  'stockOf', 'stockAt', 'stockBy'];
var STOCK_RESULTADOS = ['moisture', 'fat', 'ph', 'yeast', 'mold', 'result',
  'mxMoisture', 'mxFat', 'mxPh', 'coliform', 'ecoli', 'mxYeast', 'mxMold'];

function stockCompartido(campo){ return STOCK_PROPIOS.indexOf(campo) < 0; }
function stockFuenteDe(a){
  if(!a || a.stockOf == null) return null;
  return getAnalyses().filter(function(x){ return String(x.id) === String(a.stockOf); })[0] || null;
}
function stockHijos(src){
  if(!src) return [];
  return getAnalyses().filter(function(x){ return x.stockOf != null && String(x.stockOf) === String(src.id); });
}
// La muestra de stock: sin cliente (ni en el registro ni en su producto). Las que
// ya tienen COA (emitido antes de esta pantalla) siguen tambien en el COA.
function stockSinCliente(a){
  if(!a || a.stockOf != null) return false;
  var c = (typeof coaCustomerOf === 'function') ? coaCustomerOf(a) : null;
  return !(c && c.company);
}

function stockCopia(v){ return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; }

// Pone al dia los clientes asignados de una muestra. Lo que cambie despues de
// emitido su COA queda marcado (logAnalysisChange lo hace con afterCoa).
// Devuelve los que cambiaron; sinGuardar: los guarda quien llama.
function stockSync(src, sinGuardar){
  if(!src || src.stockOf != null) return [];
  var tocados = [];
  stockHijos(src).forEach(function(k){
    var cambio = false;
    Object.keys(src).forEach(function(f){
      if(!stockCompartido(f)) return;
      if(JSON.stringify(k[f]) === JSON.stringify(src[f])) return;
      if(k.coaNo && STOCK_RESULTADOS.indexOf(f) >= 0 && typeof logAnalysisChange === 'function')
        logAnalysisChange(k, f, k[f], src[f]);
      k[f] = stockCopia(src[f]);
      cambio = true;
    });
    if(cambio) tocados.push(k);
  });
  if(tocados.length && !sinGuardar) stockGuardar(tocados);
  return tocados;
}
function stockGuardar(lista){
  saveDB(getDB(), 'analysis');
  if(window.saveToFirebase) lista.forEach(function(k){ window.saveToFirebase('analysis', k); });
}
// Todas: al abrir las pantallas del COA, por si algo se cambio por otro lado
function stockSyncAll(){
  var fuentes = {}, tocados = [];
  getAnalyses().forEach(function(a){ if(a.stockOf != null) fuentes[a.stockOf] = 1; });
  getAnalyses().forEach(function(a){
    if(a.stockOf == null && fuentes[a.id]) tocados = tocados.concat(stockSync(a, true));
  });
  if(tocados.length) stockGuardar(tocados);
  return tocados.length;
}

// ===== LA PANTALLA (COA › Stock Customers) =====
// Se busca por LOT, numero de producto y fecha de produccion, cualquiera de
// los tres o juntos (el numero de producto, pedido del usuario 12 nov 2026).
// Salen las muestras de stock (sin cliente) y, desde el 12 nov 2026, tambien
// las que tienen cliente pero NO tienen Order ni PO: a esas se les puede
// cambiar el cliente y poner su Order y su PO (pedido del usuario).
var skLot = '', skDia = '', skProd = '', skAbierta = null;   // skAbierta = {id, modo:'nuevo'|'editar'}
var skFijos = null;   // lo que salio en la ultima busqueda: no se esconde al ponerle Order/PO

function initStock(){
  skAbierta = null; skFijos = null;
  stockSyncAll();
  skPintarListas();
  renderStock();
}
function skBuscar(){
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  skLot = g('sk-lot'); skDia = g('sk-date'); skProd = g('sk-prod');
  skAbierta = null; skFijos = null;
  // Lo de mas de 30 dias no esta en el equipo: se trae desde la fecha buscada
  // o, si solo hay LOT, desde el dia que dice el LOT (YYDDD o DDDYY)
  var desde = skDia || skFechaDeLot(skLot);
  if(desde && window.loadHistory){
    window.loadHistory(typeof lotMasDias === 'function' ? lotMasDias(desde, -2) : desde, renderStock);
    return;
  }
  renderStock();
}
// Llena los campos y busca (los botones de "esta en...")
function skIr(lot, prod, dia){
  var set = function(id, v){ var e = document.getElementById(id); if(e) e.value = v || ''; };
  set('sk-lot', lot); set('sk-prod', prod); set('sk-date', dia);
  skBuscar();
}
// El dia que dice un LOT: YYDDD (Caputo) o DDDYY (cliente). El mas viejo si caben los dos
function skFechaDeLot(lot){
  var t = String(lot || '').replace(/\D/g, '');
  if(t.length !== 5) return '';
  var dia = function(yy, ddd){
    if(ddd < 1 || ddd > 366) return '';
    var d = new Date(2000 + yy, 0, 1, 12); d.setDate(ddd);
    if(d.getFullYear() !== 2000 + yy || d > new Date()) return '';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  var a = dia(+t.slice(0, 2), +t.slice(2)), b = dia(+t.slice(3), +t.slice(0, 3));
  return [a, b].filter(Boolean).sort()[0] || '';
}

function skLimpio(v){
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return (typeof lotLimpio === 'function') ? String(lotLimpio(s) || s).toUpperCase() : s;
}
function skNum(v){ return (typeof normNumber === 'function') ? normNumber(v) : String(v || '').trim().toUpperCase(); }
function skLotDe(a){ return (typeof analysisLot === 'function') ? analysisLot(a) : (a.lot || ''); }
// ¿Esta muestra es la del LOT / producto / fecha buscados? Sin nada, las de hoy.
// f: otros filtros (para las pistas de "esta en...")
function skCoincide(a, f){
  f = f || {lot:skLot, dia:skDia, prod:skProd};
  var lot = skLimpio(f.lot), dia = f.dia, prod = skNum(f.prod);
  var d = String(a.date || '').slice(0, 10);
  if(!lot && !dia && !prod) return d === localDateStr();
  if(dia && d !== dia) return false;
  if(prod && skNum(a.product) !== prod) return false;
  if(lot){
    var l = skLimpio(skLotDe(a));
    if(!l || l.indexOf(lot) < 0) return false;
  }
  return true;
}
function skSinOrden(a){ return !String(a.order || '').trim() && !String(a.po || '').trim(); }
// Que se puede hacer aqui con ella: stock (sin cliente) o con cliente sin Order ni PO
function skTipo(a){
  if(!a || a.stockOf != null) return '';
  if(stockSinCliente(a)) return 'stock';
  return skSinOrden(a) ? 'sinorden' : '';
}
function skFilas(){
  var lista = getAnalyses().filter(function(a){
    return a.stockOf == null && skCoincide(a) && (skTipo(a) || (skFijos && skFijos[a.id]));
  }).sort(function(a, b){
    return String(b.date).localeCompare(String(a.date)) || (+b.seq || 0) - (+a.seq || 0);
  });
  if(skFijos === null){ skFijos = {}; lista.forEach(function(a){ skFijos[a.id] = 1; }); }
  return lista;
}

function skPintarListas(){
  if(typeof renderProductOptions === 'function') renderProductOptions('sk-product-list');
  var dl = document.getElementById('sk-cust-list');
  if(dl) dl.innerHTML = ((typeof getCustomers === 'function') ? getCustomers() : []).map(function(c){
    return '<option value="'+esc(c.company)+'">'+esc(c.customerId || '')+'</option>';
  }).join('');
}

function renderStock(){
  var host = document.getElementById('sk-sheet');
  if(!host) return;
  var lista = skFilas();
  var busca = !!(skLot || skDia || skProd);
  var kp = document.getElementById('sk-kpis');
  if(kp){
    var sinNadie = lista.filter(function(a){ return skTipo(a) === 'stock' && !stockHijos(a).length; }).length;
    var sinOrden = lista.filter(function(a){ return !stockSinCliente(a) && skSinOrden(a); }).length;
    kp.innerHTML = kpiCard(lista.length, busca ? 'samples found' : 'samples today', {icono:'box'}) +
      kpiCard(sinNadie, 'without a customer', {tono:sinNadie ? 'warn' : '', icono:'alert'}) +
      kpiCard(sinOrden, 'without Order / PO', {tono:sinOrden ? 'warn' : '', icono:'doc'});
    renderIcons(kp);
  }
  if(!lista.length){
    host.innerHTML = '<div class="sheet-empty">'+skVacioHTML(busca)+'</div>';
    renderIcons(host);
    return;
  }
  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Made</th><th>LOT</th><th>Product</th><th class="wide">Description</th>'+
      '<th>Results</th><th>Plate</th><th class="wide">Customers</th><th></th>'+
    '</tr></thead><tbody>'+
    lista.map(function(a, i){ return skFilaHTML(a, i + 1); }).join('')+
    '</tbody></table></div>';
  renderIcons(host);
}

// Lo que se dice cuando no sale nada: si existe pero ya tiene cliente, Order y
// PO, se dice de quien; si no existe asi, donde SI esta ese producto o ese LOT
// (el 01732 se busco con el LOT 26289 del 16 oct y esta el 9 nov con 26313).
function skVacioHTML(busca){
  if(!busca) return 'Type the LOT, the product # or the production date, and tap the magnifier.';
  var conTodo = getAnalyses().filter(function(a){ return a.stockOf == null && skCoincide(a); });
  if(conTodo.length){
    var cuenta = {};
    conTodo.forEach(function(a){ var c = a.customer || '—'; cuenta[c] = (cuenta[c] || 0) + 1; });
    var quienes = Object.keys(cuenta).map(function(c){ return esc(c)+(cuenta[c] > 1 ? ' ×'+cuenta[c] : ''); }).join(', ');
    return 'That search has '+conTodo.length+' sample'+(conTodo.length === 1 ? '' : 's')+', and '+
      (conTodo.length === 1 ? 'it already has its' : 'they already have their')+' customer, Order and PO: '+quienes+'. '+
      'Their COA is in COA Generator.';
  }
  // Pistas: el producto en otras fechas / LOT, o el LOT en otros productos
  var pistas = [], visto = {};
  var poner = function(a){
    var k = skNum(a.product)+'|'+skLotDe(a)+'|'+String(a.date).slice(0, 10);
    if(visto[k] || pistas.length >= 6) return;
    visto[k] = 1; pistas.push(a);
  };
  var todas = getAnalyses().filter(function(a){ return a.stockOf == null; })
    .sort(function(a, b){ return String(b.date).localeCompare(String(a.date)); });
  if(skProd) todas.filter(function(a){ return skCoincide(a, {prod:skProd}); }).forEach(poner);
  if(skLot)  todas.filter(function(a){ return skCoincide(a, {lot:skLot}); }).forEach(poner);
  var txt = 'No sample with that LOT / product / date.';
  if(!pistas.length) return txt+' Check them and try again.';
  return txt+' This is where it is:<div class="sk-pistas">'+pistas.map(function(a){
    var lot = skLotDe(a), dia = String(a.date).slice(0, 10);
    return '<button type="button" class="sk-pista" onclick="skIr(\''+esc(lot)+'\',\''+esc(a.product || '')+'\',\''+dia+'\')">'+
      '<b>'+esc(a.product || '—')+'</b> · LOT '+esc(lot || '—')+' · '+esc(fmtDate(dia))+
      (a.customer ? ' · '+esc(a.customer) : ' · stock')+'</button>';
  }).join('')+'</div>';
}

function skEstadoCoa(k){
  return k.coaNo ? '<b class="ok">'+esc(k.coaNo)+'</b>'
       : (typeof coaReady === 'function' && coaReady(k)) ? '<b class="ok">Ready</b>' : '<b>Waiting</b>';
}
function skFilaHTML(a, i){
  var hijos = stockHijos(a);
  var med = [a.moisture ? 'M '+a.moisture : '', a.fat ? 'F '+a.fat : '', a.ph ? 'pH '+a.ph : ''].filter(Boolean);
  var placa = (typeof ymDone === 'function' && ymDone(a)) ? '<span class="pill ok">Read</span>'
    : (typeof ymDueDate === 'function' && ymDueDate(a)) ? '<span class="pill">'+esc(fmtDate(ymDueDate(a)))+'</span>'
    : '<span class="soft">Not plated</span>';
  // El cliente de la propia muestra (si tiene): se cambia con el lapiz, si aun no tiene COA
  var principal = '';
  if(!stockSinCliente(a)){
    var sinOP = skSinOrden(a);
    principal = '<span class="sk-chip main'+(sinOP ? ' falta' : '')+'">'+esc(a.customer || '—')+
      (a.order ? ' <small>Order '+esc(a.order)+'</small>' : '')+(a.po ? ' <small>PO '+esc(a.po)+'</small>' : '')+
      (sinOP ? ' <small class="sk-falta">no Order / PO</small>' : '')+skEstadoCoa(a)+
      (a.coaNo ? '' : '<button type="button" class="sk-lapiz" onclick="skAbrir('+a.id+',\'editar\')" '+
        'title="Change the customer, Order or PO" aria-label="Change the customer of this sample">✎</button>')+
    '</span>';
  }
  var chips = hijos.map(function(k){
    return '<span class="sk-chip">'+esc(k.customer)+
      (k.order ? ' <small>Order '+esc(k.order)+'</small>' : '')+(k.po ? ' <small>PO '+esc(k.po)+'</small>' : '')+skEstadoCoa(k)+
      (k.coaNo ? '' : '<button type="button" onclick="skQuitar('+k.id+')" aria-label="Remove '+esc(k.customer)+'">×</button>')+
    '</span>';
  }).join('');
  var ab = (skAbierta && String(skAbierta.id) === String(a.id)) ? skAbierta : null;
  var lleno = !!(principal || chips) && !(principal && skSinOrden(a));
  return '<tr'+(lleno ? ' class="done"' : '')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="soft">'+esc(fmtDate(a.date))+'</td>'+
    '<td class="code">'+esc(skLotDe(a) || '—')+'</td>'+
    '<td class="code">'+esc(a.product || '—')+'</td>'+
    '<td class="wide">'+esc(a.cheese || '—')+'</td>'+
    '<td class="soft">'+(med.length ? esc(med.join(' · ')) : 'Not tested')+'</td>'+
    '<td>'+placa+'</td>'+
    '<td class="wide"><div class="sk-chips">'+((principal + chips) || '<span class="soft">No customer yet</span>')+'</div></td>'+
    '<td><button class="sheet-btn" type="button" onclick="skAbrir('+a.id+',\'nuevo\')">'+
      (ab && ab.modo === 'nuevo' ? 'Close' : '+ Customer')+'</button></td>'+
  '</tr>'+
  (ab ? '<tr class="sk-edit"><td colspan="9">'+skEditorHTML(a, ab.modo)+'</td></tr>' : '');
}

function skEditorHTML(a, modo){
  var editar = modo === 'editar';
  var ords = (typeof getOrders === 'function') ? getOrders().filter(function(o){
    return !o.closed && (o.products || []).map(normNumber).indexOf(normNumber(a.product)) >= 0;
  }) : [];
  var v = function(x){ return editar ? esc(x || '') : ''; };
  return '<div class="sk-form">'+
    '<span class="sk-modo">'+(editar ? 'Change this sample’s customer' : (stockSinCliente(a) ? 'Give it a customer' : 'Add another customer'))+'</span>'+
    '<label>Customer<input class="cell" id="sk-cust" list="sk-cust-list" placeholder="Customer" autocomplete="off" value="'+v(a.customer)+'"></label>'+
    '<label>Order<input class="cell" id="sk-order" list="sk-order-list" placeholder="Order" autocomplete="off" '+
      'inputmode="numeric" value="'+v(a.order)+'" oninput="skOrdenTecleada('+a.id+')"></label>'+
    '<datalist id="sk-order-list">'+ords.map(function(o){
      return '<option value="'+esc(o.order)+'">'+esc((o.po ? 'PO '+o.po : '')+(o.customer ? ' · '+o.customer : ''))+'</option>';
    }).join('')+'</datalist>'+
    '<label>PO<input class="cell" id="sk-po" placeholder="PO" autocomplete="off" autocapitalize="characters" value="'+v(a.po)+'"></label>'+
    (editar
      ? '<button class="sheet-btn pri" type="button" onclick="skGuardarPrincipal('+a.id+')">Save</button>'+
        '<button class="sheet-btn" type="button" onclick="skAbrir('+a.id+',\'editar\')">Cancel</button>'
      : '<button class="sheet-btn pri" type="button" onclick="skAsignar('+a.id+')">Assign</button>')+
  '</div>';
}

function skAbrir(id, modo){
  modo = modo || 'nuevo';
  var igual = skAbierta && String(skAbierta.id) === String(id) && skAbierta.modo === modo;
  skAbierta = igual ? null : {id:id, modo:modo};
  var vuelve = (typeof nxGuardarScroll === 'function') ? nxGuardarScroll(document.getElementById('screen-coastock')) : function(){};
  renderStock();
  vuelve();
  var c = document.getElementById('sk-cust'); if(c) c.focus({preventScroll:true});
}
function skRepintar(){
  skAbierta = null;
  var vuelve = (typeof nxGuardarScroll === 'function') ? nxGuardarScroll(document.getElementById('screen-coastock')) : function(){};
  renderStock();
  vuelve();
}

// Un Order de COA Orders trae su PO y su cliente
function skOrdenTecleada(id){
  var a = getAnalyses().filter(function(x){ return String(x.id) === String(id); })[0];
  var e = document.getElementById('sk-order');
  if(!a || !e || typeof orderByNumber !== 'function') return;
  var o = e.value.trim() ? orderByNumber(e.value, a.product) : null;
  if(!o) return;
  var po = document.getElementById('sk-po'), cu = document.getElementById('sk-cust');
  if(po && !po.value.trim() && o.po) po.value = o.po;
  if(cu && !cu.value.trim() && o.customer) cu.value = o.customer;
}

function skCliente(txt){
  var t = String(txt || '').trim().toLowerCase();
  if(!t) return null;
  var lista = (typeof getCustomers === 'function') ? getCustomers() : [];
  return lista.filter(function(c){ return String(c.company || '').toLowerCase() === t; })[0] ||
         lista.filter(function(c){ return String(c.customerId || '').toLowerCase() === t; })[0] || null;
}
function skCampos(){
  var g = function(k){ var e = document.getElementById(k); return e ? String(e.value).trim() : ''; };
  return {cust:g('sk-cust'), order:g('sk-order'), po:g('sk-po')};
}

// Cambiar el cliente / Order / PO de la propia muestra (sin COA todavia)
function skGuardarPrincipal(id){
  var db = getDB();
  var a = (db.analysis || []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(!a) return;
  if(a.coaNo){ toast('It already has COA '+a.coaNo+': the customer cannot change'); return; }
  var f = skCampos();
  var c = skCliente(f.cust);
  if(!c){ toast(f.cust ? 'That customer is not in Customers' : 'Choose the customer'); return; }
  var o = (f.order && typeof orderByNumber === 'function') ? orderByNumber(f.order, a.product) : null;
  var po = f.po || (o && o.po) || '';
  var quien = currentUser ? currentUser.name : '—', antes = a.customer || '';
  if(typeof logAnalysisChange === 'function'){
    logAnalysisChange(a, 'customer', a.customer, c.company);
    logAnalysisChange(a, 'order', a.order, f.order);
    logAnalysisChange(a, 'po', a.po, po);
  }
  a.customer = c.company;
  a.customerKey = (typeof custKey === 'function') ? custKey(c) : c.customerId;
  a.customerId = c.customerId || '';
  a.order = f.order; a.po = po; a.orderId = o ? o.id : null;
  a.editedAt = localISOStr(); a.editedBy = quien;
  saveDB(db, 'analysis');
  if(window.saveToFirebase) window.saveToFirebase('analysis', a);
  if(typeof logActivity === 'function')
    logActivity('analysis', 'Sample customer changed',
      (a.product || '')+' · LOT '+(skLotDe(a) || '—')+' · '+(antes || 'no customer')+' → '+c.company+
      (f.order ? ' · Order '+f.order : '')+(po ? ' · PO '+po : ''), quien);
  toast(c.company+(f.order || po ? ' with its Order / PO' : '')+' saved');
  skRepintar();
}

function skAsignar(id){
  var db = getDB();
  var src = (db.analysis || []).filter(function(x){ return String(x.id) === String(id); })[0];
  if(!src) return;
  var f = skCampos();
  var c = skCliente(f.cust);
  if(!c){ toast(f.cust ? 'That customer is not in Customers' : 'Choose the customer'); return; }
  var order = f.order, po = f.po;
  var o = (order && typeof orderByNumber === 'function') ? orderByNumber(order, src.product) : null;
  if(o && !po && o.po) po = o.po;
  var k = (typeof custKey === 'function') ? custKey(c) : c.customerId;
  var igual = stockHijos(src).concat(stockSinCliente(src) ? [] : [src]).filter(function(x){
    return x.customerKey === k && String(x.order || '') === order;
  })[0];
  if(igual && !confirm(c.company+(order ? ' with order '+order : '')+' is already on this LOT. Add it again?')) return;

  var ahora = localISOStr(), quien = currentUser ? currentUser.name : '—';
  var kid = {};
  Object.keys(src).forEach(function(f){ if(stockCompartido(f)) kid[f] = stockCopia(src[f]); });
  kid.id = newRecordId();
  kid.stockOf = src.id; kid.stockAt = ahora; kid.stockBy = quien;
  kid.customer = c.company; kid.customerKey = k; kid.customerId = c.customerId || '';
  kid.order = order; kid.po = po; kid.orderId = o ? o.id : null;
  kid.createdAt = ahora; kid.createdBy = quien; kid.changes = [];
  db.analysis.push(kid);
  saveDB(db, 'analysis');
  if(window.saveToFirebase) window.saveToFirebase('analysis', kid);
  if(typeof logActivity === 'function')
    logActivity('analysis', 'Stock assigned to a customer',
      (src.product || '')+' · LOT '+(skLotDe(src) || '—')+
      ' → '+c.company+(order ? ' · Order '+order : '')+(po ? ' · PO '+po : ''), quien);
  var listo = (typeof coaReady === 'function') && coaReady(kid);
  var noCoa = (typeof custNeedsCOA === 'function') && !custNeedsCOA(c);
  toast(c.company+' assigned. '+(noCoa ? 'This customer is set to not need a COA (Customers).'
    : listo ? 'Ready in COA Generator.' : 'It shows in COA Generator; still missing: '+
      ((typeof coaMissing === 'function') ? coaMissing(kid) : 'results')+'.'));
  skRepintar();
}

// Quitar un cliente agregado (solo si aun no tiene COA)
function skQuitar(kidId){
  var db = getDB();
  var k = (db.analysis || []).filter(function(x){ return String(x.id) === String(kidId); })[0];
  if(!k) return;
  if(k.coaNo){ toast(k.customer+' already has COA '+k.coaNo+': it stays'); return; }
  if(!confirm('Remove '+k.customer+(k.order ? ' (order '+k.order+')' : '')+' from this LOT?')) return;
  db.analysis = db.analysis.filter(function(x){ return x !== k; });
  saveDB(db, 'analysis');
  if(k._fbId && window.deleteFromFirebase) window.deleteFromFirebase('analysis', k._fbId);
  if(typeof logActivity === 'function')
    logActivity('analysis', 'Stock customer removed', (k.product || '')+' · '+k.customer, currentUser ? currentUser.name : '—');
  skRepintar();
}
