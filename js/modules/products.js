// ===== PRODUCT CATALOG =====
// Un producto guarda su peso (package size), cuántas bolsas lleva la caja y,
// si se escaneó alguna vez, su código de barras. Al elegir un producto en
// Weight Log o Bag Seal se llenan los demás campos solos, pero el peso se
// puede cambiar a mano si hace falta.
var currentProduct = null;   // producto resuelto en la pantalla activa
var productScreen  = null;   // 'weight' | 'seal'
var pendingBarcode = '';     // código escaneado que aún no tiene producto

function getProducts(){
  var db = getDB();
  return db.products || [];
}

function saveProducts(list){
  var db = getDB();
  db.products = list;
  saveDB(db,'products');
}

// ===== CLIENTES Y TESTS DE LABORATORIO =====
// La matriz de clientes vive en Firestore (config/customers), no en el repo.
function getCustomers(){ var d=getDB(); return (d.customers && d.customers.list) || []; }
function getLabTests(){  var d=getDB(); return (d.customers && d.customers.tests) || []; }

// ¿A qué cliente pertenece este número de producto?
function findCustomerByProduct(number){
  var n = normNumber(number); if(!n) return null;
  var list = getCustomers();
  for(var i=0;i<list.length;i++){
    var c = list[i];
    if((c.products||[]).some(function(p){ return normNumber(p)===n; })) return c;
  }
  return null;
}
// ===== CUANTOS SAMPLES PIDE UN PRODUCTO =====
// Antes esto era un si/no y la cantidad salia del cliente. Ahora se elige al
// crear el producto, porque dentro de un mismo cliente hay productos que no se
// muestrean y otros que llevan mas de uno. Los productos viejos (sin el campo)
// siguen respondiendo por su cliente, asi no hay que reeditarlos.
function customerSampleCount(c){
  if(!c) return 1;
  return c.numbered ? (c.samplesPerOrder || 5) : (c.samplesPerOrder || 1);
}
function parseSampleCount(v){
  var n = parseInt(String(v==null?'':v).trim(), 10);
  if(isNaN(n) || n < 0) return 0;
  return Math.min(n, 99);
}
function productSampleCount(p){
  if(!p) return 0;
  if(p.labSamples != null && p.labSamples !== '') return parseSampleCount(p.labSamples);
  if(!p.labSample) return 0;
  return customerSampleCount(productCustomer(p));
}

function customerById(id){
  return getCustomers().filter(function(c){ return c.customerId===id; })[0] || null;
}
// Cliente de un producto: el asignado a mano gana (necesario para los clientes
// marcados "all items", que no listan números), si no se deduce del número.
function productCustomer(p){
  if(!p) return null;
  if(p.customerMode==='none') return null;        // se dijo que no tiene cliente
  if(p.customerId){ var m = customerById(p.customerId); if(m) return m; }
  var list = p.customerIds || [];
  for(var i=0;i<list.length;i++){ var c = customerById(list[i]); if(c) return c; }
  return findCustomerByProduct(p.number);
}
// Tests que exige el cliente de ese producto
function productLabTests(p){
  var c = productCustomer(p);
  return c ? (c.tests||[]) : [];
}

// Código que va en la columna "Product Description" de la forma del laboratorio:
// prefijo del cliente + número de producto. El prefijo viene de Firestore.
// Solo aplica a productos que se mandan al lab.
function productLabCode(p){
  var c = productCustomer(p);
  if(!c) return '';
  return (c.prefix || c.customerId || '') + normNumber(p && p.number);
}

// El alta de producto vive en dos sitios: el modal (cuando se escanea un
// codigo desconocido desde Weight o Seal) y la pantalla Add Product. Los dos
// usan los mismos campos, distinguidos por un prefijo: 'prod-' y 'ap-'.
// ===== BLOQUE DE LABORATORIO =====
// Un producto puede no tener cliente, tener uno, o venderse a varios con el
// mismo numero. De eso dependen los tests que exige la forma y el codigo que
// va en ella, asi que se pregunta al darlo de alta en vez de adivinarlo.
// El mismo bloque sirve para Add Product ('ap') y para el catalogo ('cd').
function productCustomerMode(p){
  if(!p) return 'one';
  if(p.customerMode) return p.customerMode;
  if((p.customerIds||[]).length > 1) return 'many';
  return (p.customerId || findCustomerByProduct(p.number)) ? 'one' : 'none';
}
function productCustomerIds(p){
  if(!p) return [];
  if((p.customerIds||[]).length) return p.customerIds.slice();
  if(p.customerId) return [p.customerId];
  var auto = findCustomerByProduct(p.number);
  return auto ? [auto.customerId] : [];
}
// Todos los clientes de un producto (el primero manda para la forma)
function productCustomers(p){
  return productCustomerIds(p).map(customerById).filter(Boolean);
}

// ===== ALTA DE CLIENTE =====
// Si el cliente no existe todavia se crea aqui mismo, con su codigo, su forma
// y los tests que exige. La lista es confidencial: se guarda en Firestore
// (config/customers), nunca en el repositorio.
function customerFormOptions(sel){
  var forms = Object.keys(getFormHeaders ? getFormHeaders() : {});
  if(!forms.length) forms = ['general'];
  return forms.map(function(f){
    return '<option value="'+esc(f)+'"'+(f===sel?' selected':'')+'>'+esc(f)+'</option>';
  }).join('');
}

function newCustomerHTML(pre){
  // Todo lo que el certificado necesita se pide aqui una vez: lo de la
  // cabecera del COA (quien es, como se le escribe) y los objetivos contra
  // los que se compara cada resultado.
  var campo = function(f, ph, extra){
    return '<input type="text" class="field" id="'+pre+'-nc-'+f+'" placeholder="'+ph+'"'+
      (extra||'')+'>';
  };
  return '<div class="new-cust" id="'+pre+'-newcust" style="display:none">'+
    '<div class="sub-label">New customer</div>'+
    '<div class="pair">'+
      campo('company','Customer name')+
      campo('id','Customer ID (e.g. ALLSTA)',' autocapitalize="characters"')+
    '</div>'+
    '<div class="pair">'+
      campo('prod','Product name')+
      campo('pack','Product packaging (e.g. 4/5lb Bags)')+
    '</div>'+
    '<div class="pair">'+
      campo('contact','Customer contact')+
      campo('email','Customer email',' inputmode="email"')+
    '</div>'+
    '<div class="pair">'+
      campo('phone','Customer phone',' inputmode="tel"')+
      campo('fax','Customer fax',' inputmode="tel"')+
    '</div>'+
    '<div class="sub-label">Targets on the certificate</div>'+
    '<div class="pair">'+
      campo('tmoist','Target moisture (e.g. \u2264 34)')+
      campo('tfat','Target fat (e.g. \u2265 38)')+
    '</div>'+
    '<div class="pair">'+
      campo('tph','Target pH (e.g. 4.9 \u2013 5.5)')+
      campo('tyeast','Target yeast (e.g. \u2264 2000)')+
    '</div>'+
    '<div class="pair">'+
      campo('tmold','Target mold (e.g. \u2264 1000)')+
      campo('code','Customer code (optional)',' autocapitalize="characters"')+
    '</div>'+
    '<div class="sub-label">Lab form</div>'+
    '<div class="pair">'+
      campo('prefix','Form prefix (optional)',' autocapitalize="characters"')+
      '<div class="select-wrap"><select class="field" id="'+pre+'-nc-form" '+
        'onchange="renderNewCustomerTests(\''+pre+'\')">'+customerFormOptions('')+'</select></div>'+
    '</div>'+
    '<div class="pair">'+
      campo('per','Samples per order',' inputmode="numeric" value="1"')+
      '<label class="lab-check" style="margin:0"><input type="checkbox" id="'+pre+'-nc-numbered">'+
        '<span>Samples are numbered</span></label>'+
    '</div>'+
    '<div class="lt-box" id="'+pre+'-nc-tests"></div>'+
    '<div class="cd-actions" style="margin-top:10px">'+
      '<button type="button" class="btn-solid" onclick="saveNewCustomer(\''+pre+'\')">Save customer</button>'+
      '<button type="button" class="btn-ghost" onclick="toggleNewCustomer(\''+pre+'\',false)">Cancel</button>'+
    '</div>'+
  '</div>';
}

function toggleNewCustomer(pre, force){
  var el = pel(pre,'newcust');
  if(!el) return;
  var show = (force===undefined) ? el.style.display==='none' : !!force;
  el.style.display = show ? 'block' : 'none';
  if(show){
    renderNewCustomerTests(pre);
    var c = pel(pre,'nc-company'); if(c) c.focus();
  }
}

// Los tests que ofrece la forma elegida
function renderNewCustomerTests(pre){
  var box = pel(pre,'nc-tests');
  if(!box) return;
  var form = (pel(pre,'nc-form')||{}).value || 'general';
  var cat = (typeof formTestCatalog==='function') ? formTestCatalog(form) : {micro:[],chem:[],nlea:[]};
  var group = function(kind, title){
    if(!cat[kind] || !cat[kind].length) return '';
    return '<div class="lt-group"><div class="lt-title">'+title+'</div>'+
      cat[kind].map(function(lbl){
        return '<label class="lt-item"><input type="checkbox" data-nc-test="'+esc(lbl)+'">'+
          '<span>'+esc(lbl)+'</span></label>';
      }).join('')+'</div>';
  };
  box.innerHTML = group('micro','Micro')+group('chem','Chemistry')+group('nlea','NLEA') ||
    '<div class="hint">That form has no columns loaded yet.</div>';
}

function saveNewCustomer(pre){
  var g = function(f){ var e = pel(pre,f); return e ? e.value.trim() : ''; };
  var company = g('nc-company');
  var id = g('nc-id').toUpperCase();
  if(!company){ toast('Enter the company name'); return; }
  if(!id){ toast('Enter the customer code'); return; }
  if(customerById(id)){ toast('That customer code already exists'); return; }

  var tests = [];
  var box = pel(pre,'nc-tests');
  if(box) box.querySelectorAll('[data-nc-test]').forEach(function(c){
    if(c.checked) tests.push(c.getAttribute('data-nc-test'));
  });

  var per = parseInt(g('nc-per'), 10);
  var cust = {
    company: company,
    customerId: id,
    // los datos con los que se arma la cabecera del certificado
    productName: g('nc-prod'),
    packaging: g('nc-pack'),
    contact: g('nc-contact'),
    email: g('nc-email'),
    phone: g('nc-phone'),
    fax: g('nc-fax'),
    code: g('nc-code').toUpperCase(),
    // y los objetivos contra los que se compara cada resultado
    targets: {moisture:g('nc-tmoist'), fat:g('nc-tfat'), ph:g('nc-tph'),
              yeast:g('nc-tyeast'), mold:g('nc-tmold')},
    prefix: g('nc-prefix').toUpperCase(),
    form: (pel(pre,'nc-form')||{}).value || 'general',
    tests: tests,
    products: [],
    allItems: false,
    numbered: !!(pel(pre,'nc-numbered')||{}).checked,
    samplesPerOrder: isNaN(per) ? 1 : per,
    createdBy: currentUser ? currentUser.name : '\u2014',
    createdAt: localISOStr()
  };

  var db = getDB();
  if(!db.customers) db.customers = {list:[], tests:[]};
  if(!db.customers.list) db.customers.list = [];
  db.customers.list.push(cust);
  saveDB(db);
  if(window.saveCustomersToFirebase) window.saveCustomersToFirebase(db.customers);
  logActivity('admin','Customer created',
    company+' ('+id+') \u00b7 form '+cust.form+
    (tests.length ? ' \u00b7 '+tests.length+' test(s)' : ' \u00b7 no tests'),
    currentUser?currentUser.name:'\u2014');

  // Queda elegido para el producto que se esta creando
  toggleNewCustomer(pre, false);
  setCustomerMode(pre, 'one');
  fillProdCustomerSelect(id, pre);
  renderCustomerPicks(pre, [id]);
  onProdCustomerChange(pre);
  refreshLabTestPicker(pre);
  toast(company+' saved');
}

// El picker de tests del producto se repinta cuando cambia el cliente
function refreshLabTestPicker(pre){
  var box = pel(pre,'lt');
  if(!box || typeof renderLabTestPicker!=='function') return;
  var lab = readLabBlock(pre);
  box.innerHTML = renderLabTestPicker({number:(pel(pre,'number')||{}).value||'',
                                       customerId:lab.customerId,
                                       customerIds:lab.customerIds,
                                       customerMode:lab.customerMode});
}

function labBlockHTML(pre, p){
  var mode = productCustomerMode(p);
  var ids  = productCustomerIds(p);
  var n    = p ? productSampleCount(p) : 1;
  var plate = !p || p.plate !== false;
  // El cliente se elige en el mismo boton desplegable que usan las hojas: una
  // sola cosa que abrir, y el rotulo dice en que quedo.
  var MODOS = {none:'No customer', one:'One customer', many:'Several customers'};
  var opcion = function(v, icono){
    return {fn:"function(){setCustomerMode('"+pre+"','"+v+"')}", icon:icono, text:MODOS[v],
            on:mode===v, attrs:'data-cmode="'+v+'"'};
  };
  return '<div class="sec-label">Laboratory</div>'+
    '<div class="lab-block">'+
      '<div class="sub-label">Who buys this product?</div>'+
      '<div class="cmode-row" id="'+pre+'-cmode">'+
        moreHTML([opcion('none','close'), opcion('one','user'), opcion('many','grid'),
                  {fn:"function(){toggleNewCustomer('"+pre+"')}", icon:'plus', text:'New customer'}],
                 'Who buys this product?',
                 {label:MODOS[mode], faceId:pre+'-cface'})+
      '</div>'+
      '<div id="'+pre+'-cone" style="display:'+(mode==='one'?'block':'none')+'">'+
        '<div class="select-wrap"><select class="field" id="'+pre+'-customer" '+
          'onchange="onProdCustomerChange(\''+pre+'\')"></select></div>'+
      '</div>'+
      '<div id="'+pre+'-cmany" style="display:'+(mode==='many'?'block':'none')+'">'+
        '<input type="search" class="field" id="'+pre+'-csearch" placeholder="Filter customers\u2026" '+
          'autocomplete="off" oninput="filterCustomerPicks(\''+pre+'\')">'+
        '<div class="cust-picks" id="'+pre+'-cpicks"></div>'+
        '<div class="hint">The first one ticked is the one whose form and code the '+
          'lab sample uses.</div>'+
      '</div>'+
      newCustomerHTML(pre)+
      '<div id="'+pre+'-customer-hint"></div>'+
      '<div class="sub-label">Lab samples per run</div>'+
      '<input type="text" class="field" id="'+pre+'-lab-n" inputmode="numeric" '+
        'value="'+n+'" placeholder="e.g. 1" oninput="this.dataset.touched=\'1\'">'+
      '<div class="hint" id="'+pre+'-lab-hint">0 means this product is never sampled.</div>'+
      '<label class="lab-check"><input type="checkbox" id="'+pre+'-plate"'+(plate?' checked':'')+'>'+
        '<span><b>Y&amp;M</b></span></label>'+
      '<div id="'+pre+'-lt">'+
        (typeof renderLabTestPicker==='function' ? renderLabTestPicker(p) : '')+'</div>'+
    '</div>';
}

// Pinta el contenido del bloque (selector y casillas) una vez esta en el DOM
function fillLabBlock(pre, p){
  var ids = productCustomerIds(p);
  fillProdCustomerSelect(ids[0] || '', pre);
  renderCustomerPicks(pre, ids);
  var form = pel(pre,'nc-form');
  if(form) form.innerHTML = customerFormOptions('');
  onProdCustomerChange(pre);
}

function renderCustomerPicks(pre, ids){
  var el = pel(pre,'cpicks');
  if(!el) return;
  ids = ids || [];
  el.innerHTML = getCustomers().map(function(c){
    var on = ids.indexOf(c.customerId) >= 0;
    return '<label class="cust-pick" data-name="'+esc((c.company+' '+c.customerId).toLowerCase())+'">'+
      '<input type="checkbox" value="'+esc(c.customerId)+'"'+(on?' checked':'')+' '+
        'onchange="onProdCustomerChange(\''+pre+'\')">'+
      '<span>'+esc(c.company)+' <b class="mono">'+esc(c.customerId)+'</b></span></label>';
  }).join('') || '<div class="hint">No customers loaded yet.</div>';
}

function filterCustomerPicks(pre){
  var q = ((pel(pre,'csearch')||{}).value||'').trim().toLowerCase();
  var box = pel(pre,'cpicks');
  if(!box) return;
  box.querySelectorAll('.cust-pick').forEach(function(l){
    l.style.display = (!q || l.getAttribute('data-name').indexOf(q)>=0) ? 'flex' : 'none';
  });
}

function setCustomerMode(pre, mode){
  var row = pel(pre,'cmode');
  if(row) row.querySelectorAll('[data-cmode]').forEach(function(b){
    b.classList.toggle('selected', b.getAttribute('data-cmode')===mode);
  });
  var cara = pel(pre,'cface');
  if(cara) cara.textContent = {none:'No customer', one:'One customer',
                               many:'Several customers'}[mode] || 'One customer';
  var one = pel(pre,'cone'), many = pel(pre,'cmany');
  if(one)  one.style.display  = mode==='one'  ? 'block' : 'none';
  if(many) many.style.display = mode==='many' ? 'block' : 'none';
  if(mode==='none'){
    var sel = pel(pre,'customer'); if(sel) sel.value = '';
    var box = pel(pre,'cpicks');
    if(box) box.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked = false; });
  }
  onProdCustomerChange(pre);
}

function currentCustomerMode(pre){
  var row = pel(pre,'cmode');
  var on = row ? row.querySelector('[data-cmode].selected') : null;
  return on ? on.getAttribute('data-cmode') : 'one';
}

// Lo que quedo elegido en el bloque
function readLabBlock(pre){
  var mode = currentCustomerMode(pre);
  var ids = [];
  if(mode==='one'){
    var v = (pel(pre,'customer')||{}).value || '';
    if(v) ids = [v];
  } else if(mode==='many'){
    var box = pel(pre,'cpicks');
    if(box) box.querySelectorAll('input[type=checkbox]:checked').forEach(function(c){ ids.push(c.value); });
  }
  var n = parseSampleCount((pel(pre,'lab-n')||{}).value);
  var pl = pel(pre,'plate');
  return {
    customerMode: mode,
    customerId: ids[0] || '',
    customerIds: ids,
    labSamples: n,
    labSample: n > 0,
    plate: pl ? !!pl.checked : true
  };
}

function pel(pre, f){ return document.getElementById((pre||'prod')+'-'+f); }

// Llena el selector de clientes del formulario de producto
function fillProdCustomerSelect(sel, pre){
  var el = pel(pre, 'customer');
  if(!el) return;
  el.innerHTML = '<option value="">— none —</option>' + getCustomers().map(function(c){
    return '<option value="'+esc(c.customerId)+'"'+(c.customerId===sel?' selected':'')+'>'+
      esc(c.company)+' ('+esc(c.customerId)+')'+'</option>';
  }).join('');
}

// Al escribir el número, si pertenece a un cliente conocido lo selecciona solo.
// Si no (p.ej. un cliente sin lista de productos), se elige a mano.
function onProdNumberInput(pre){
  pre = pre || 'prod';
  var el = pel(pre, 'number');
  if(!el) return;
  // Con varios clientes elegidos a mano, el numero no manda
  if(pel(pre,'cmode') && currentCustomerMode(pre)==='many'){ onProdCustomerChange(pre); return; }
  var c = findCustomerByProduct(el.value);
  // Si el número no pertenece a nadie se limpia: nunca debe quedarse pegado
  // el cliente del producto anterior.
  fillProdCustomerSelect(c ? c.customerId : '', pre);
  if(pel(pre,'cmode')) setCustomerMode(pre, c ? 'one' : 'none');
  else onProdCustomerChange(pre);
}

// Cambio manual de cliente: refresca tests, código de forma y marca Lab sample
function onProdCustomerChange(pre){
  pre = pre || 'prod';
  var el = pel(pre, 'customer-hint');
  if(!el) return;
  var mode = pel(pre,'cmode') ? currentCustomerMode(pre) : 'one';
  var id = '';
  if(mode==='one'){
    id = (pel(pre,'customer')||{}).value || '';
  } else if(mode==='many'){
    var first = (pel(pre,'cpicks')||{querySelector:function(){return null;}})
                  .querySelector('input[type=checkbox]:checked');
    id = first ? first.value : '';
  }
  var c  = id ? customerById(id) : null;
  var num = normNumber((pel(pre,'number')||{}).value);
  el.innerHTML = c ? customerHintHTML(c, num) : '';
  var n = pel(pre,'lab-n');
  if(n && c && !n.dataset.touched) n.value = String(customerSampleCount(c));
  if(pel(pre,'lt')) refreshLabTestPicker(pre);
  var h = pel(pre,'lab-hint');
  if(h) h.textContent = c ? (c.company+' normally takes '+customerSampleCount(c)+
       ' sample'+(customerSampleCount(c)===1?'':'s')+' per order'+(c.numbered?', numbered':'')+'.') : '';
}

function customerHintHTML(c, number){
  var code = (c.prefix || c.customerId || '') + (number||'');
  return '<div class="cust-hint">'+
    '<div class="cust-name">'+esc(c.company)+' <span class="tag">'+esc(c.customerId)+'</span></div>'+
    '<div class="cust-tests">Required lab tests: '+
      ((typeof testsLegendHTML==='function')
        ? testsLegendHTML([c.tests])
        : (c.tests||[]).map(function(t){ return '<span class="tag">'+esc(t)+'</span>'; }).join(' '))+
    '</div>'+
    (number ? '<div class="lab-code">Lab form code: <b class="mono">'+esc(code)+'</b></div>' : '')+
  '</div>';
}

function normNumber(v){
  return String(v||'').trim().toUpperCase();
}

// Busca por número de producto o por un código de barras asociado
function findProduct(code){
  var c = normNumber(code);
  if(!c) return null;
  var list = getProducts();
  return list.find(function(p){ return normNumber(p.number)===c; }) ||
         list.find(function(p){ return (p.barcodes||[]).some(function(b){ return normNumber(b)===c; }); }) ||
         null;
}

// Etiqueta de presentación: "5 lbs · 4 bags/case"
function productSummary(p){
  var parts = [];
  if(p.pkgLabel) parts.push(p.pkgLabel);
  if(p.bagsPerCase) parts.push(p.bagsPerCase+' bags/case');
  if(!p.target || p.target.min==null) parts.push('no target set');
  return parts.join(' · ');
}

// ---- Autocompletado del campo (datalist) ----
function renderProductOptions(listId){
  var el = document.getElementById(listId);
  if(!el) return;
  el.innerHTML = getProducts().map(function(p){
    var label = p.name ? p.name+' — '+(p.pkgLabel||'') : (p.pkgLabel||'');
    return '<option value="'+p.number+'">'+label+'</option>';
  }).join('');
}

// ---- Resolución del producto escrito/escaneado ----
// screen: 'weight' | 'seal'
var lastAppliedProductId = null;

function onProductInput(screen){
  productScreen = screen;
  var ids = productIds(screen);
  var code = document.getElementById(ids.input).value;
  var p = findProduct(code);
  currentProduct = p;
  if(p) applyProduct(p, screen);
  else lastAppliedProductId = null;
  renderProductCard(screen, code);
}

function productIds(screen){
  if(screen==='seal')    return {input:'s-product',  card:'s-product-card', list:'s-product-list'};
  if(screen==='catalog') return {input:'cat-search', card:null,             list:null};
  return {input:'w-product', card:'w-product-card', list:'w-product-list'};
}

// Llena lo que se sabe del producto. El peso queda seleccionado pero editable:
// sólo se aplica cuando cambia el producto, para no pisar un peso corregido
// a mano ni borrar las muestras ya escritas.
function applyProduct(p, screen){
  if(screen!=='weight') return;
  if(lastAppliedProductId === p.id) return;
  lastAppliedProductId = p.id;
  if(p.pkg!=null && PKGS[p.pkg]){
    selectPkg(String(p.pkg));
  } else if(p.pkgLabel){
    selectCustomPkg(p);
  }
}

function renderProductCard(screen, code){
  var ids = productIds(screen);
  var el  = document.getElementById(ids.card);
  if(!el) return;
  var c = normNumber(code);
  if(!c){ el.style.display='none'; el.innerHTML=''; return; }

  if(currentProduct){
    var p = currentProduct;
    el.className = 'product-card found';
    el.innerHTML = '<div class="pc-main">'+
        '<div class="pc-name">'+(p.name || 'Product '+p.number)+'</div>'+
        '<div class="pc-meta">'+productSummary(p)+'</div>'+
      '</div>'+
      '<div class="pc-badge">'+(p.pkgLabel||'—')+'</div>';
    el.style.display='flex';
  } else {
    el.className = 'product-card missing';
    el.innerHTML = '<div class="pc-main">'+
        '<div class="pc-name">Product '+c+' is not in the catalog</div>'+
        '<div class="pc-meta">Create it once and it fills in by itself from now on</div>'+
      '</div>'+
      '<button class="pc-add" onclick="openProductModal(\''+screen+'\')">+ Create</button>';
    el.style.display='flex';
  }
}

// Deja el campo de producto libre para el siguiente registro. Se llama al
// guardar: si el producto se quedaba puesto, el registro de la línea siguiente
// heredaba el producto (y el peso) de la línea anterior.
function clearProductSelection(screen){
  var ids = productIds(screen);
  var inp = document.getElementById(ids.input);
  if(inp) inp.value = '';
  currentProduct = null;
  lastAppliedProductId = null;
  renderProductCard(screen, '');
  // En Weight el peso sale del producto, así que se libera con él: si no, el
  // siguiente registro se mediría contra el target del producto anterior.
  if(screen==='weight' && typeof selectPkg==='function') selectPkg('');
}

// ---- Crear producto ----
function openProductModal(screen){
  productScreen = screen || productScreen || 'weight';
  var ids = productIds(productScreen);
  var typed = document.getElementById(ids.input).value;

  document.getElementById('prod-number').value = normNumber(typed);
  document.getElementById('prod-name').value   = '';
  document.getElementById('prod-bags').value   = '';
  document.getElementById('prod-custom-label').value = '';
  document.getElementById('prod-min').value = '';
  document.getElementById('prod-max').value = '';
  document.getElementById('prod-barcode').value = pendingBarcode || '';
  fillProductSizes('prod');
  var labN = document.getElementById('prod-lab-n');
  if(labN){ labN.value = '1'; delete labN.dataset.touched; }
  var labH = document.getElementById('prod-lab-hint'); if(labH) labH.textContent = '';
  fillProdCustomerSelect('', 'prod');
  onProdNumberInput('prod');   // si el número ya venía escrito, detecta el cliente

  document.getElementById('product-modal').style.display='flex';
  document.body.style.overflow='hidden';
}

function closeProductModal(){
  document.getElementById('product-modal').style.display='none';
  document.body.style.overflow='';
  pendingBarcode='';
}

// Muestra los campos de peso libre sólo cuando se elige "Other size…"
function toggleProductCustom(pre){
  pre = pre || 'prod';
  var sel = pel(pre,'pkg'), wrap = pel(pre,'custom-wrap');
  if(!sel || !wrap) return;
  wrap.style.display = (sel.value === 'other') ? 'block' : 'none';
}

// Llena el selector de tamanos de cualquiera de los dos formularios
function fillProductSizes(pre){
  var sel = pel(pre,'pkg');
  if(!sel) return;
  sel.innerHTML = '<option value="">Select package size</option>'+
    PKGS.map(function(p,i){ return '<option value="'+i+'">'+p.label+'</option>'; }).join('')+
    '<option value="other">Other size\u2026</option>';
  sel.value = '';
  toggleProductCustom(pre);
}

// Lee el formulario y devuelve el producto listo para guardar, o null si
// falta algo. Lo comparten el modal y la pantalla Add Product.
function readProductForm(pre){
  pre = pre || 'prod';
  var g = function(f){ var e = pel(pre,f); return e ? e.value : ''; };
  var number = normNumber(g('number'));
  if(!number){ toast('Enter the product number'); return null; }
  if(findProduct(number)){ toast('That product number already exists'); return null; }

  var sel = g('pkg'), pkg = null, pkgLabel = '', target = null;
  if(sel==='other'){
    pkgLabel = g('custom-label').trim();
    if(!pkgLabel){ toast('Enter the package size (e.g. 3.5 lbs)'); return null; }
    var mn = parseFloat(g('min')), mx = parseFloat(g('max'));
    // El target es opcional: sin el no se marca pass/fail, solo se registra el peso
    if(!isNaN(mn) && !isNaN(mx)){
      if(mn>=mx){ toast('Min must be lower than max'); return null; }
      target = {min:mn, max:mx};
    }
  } else if(sel!==''){
    pkg = parseInt(sel);
    pkgLabel = PKGS[pkg].label;
    target = {min:PKGS[pkg].min, max:PKGS[pkg].max};
  } else {
    toast('Select the package size'); return null;
  }

  var bags = parseInt(g('bags'));
  var barcode = normNumber(g('barcode'));
  // El bloque de laboratorio: cliente(s), cuantas muestras y si lleva placa
  var lab = pel(pre,'cmode') ? readLabBlock(pre) : {
    customerMode: 'one',
    customerId: g('customer') || (findCustomerByProduct(number)||{}).customerId || '',
    customerIds: [],
    labSamples: parseSampleCount(g('lab-n')),
    labSample: parseSampleCount(g('lab-n')) > 0,
    plate: true
  };
  return {
    id: newRecordId(),
    number: number,
    name: g('name').trim(),
    pkg: pkg,
    pkgLabel: pkgLabel,
    target: target,
    bagsPerCase: isNaN(bags) ? null : bags,
    labSamples: lab.labSamples,
    labSample: lab.labSample,
    plate: lab.plate,
    customerMode: lab.customerMode,
    customerId: lab.customerId,
    customerIds: lab.customerIds,
    barcodes: barcode ? [barcode] : [],
    createdBy: currentUser ? currentUser.name : '\u2014',
    createdAt: localISOStr()
  };
}

function persistNewProduct(prod){
  var list = getProducts();
  list.push(prod);
  saveProducts(list);
  if(window.saveToFirebase) window.saveToFirebase('products', prod);
  logActivity('admin','Product created',
    prod.number+(prod.name?' \u2014 '+prod.name:'')+' \u00b7 '+productSummary(prod),
    currentUser?currentUser.name:'\u2014');
  renderProductOptions('w-product-list');
  renderProductOptions('s-product-list');
}

function saveProduct(){
  var prod = readProductForm('prod');
  if(!prod) return;
  persistNewProduct(prod);
  closeProductModal();
  // Deja el producto recién creado listo en la pantalla donde se pidió
  if(productScreen==='catalog'){
    catSelected = prod.number;
    catFilter = prod.number;
    var s = document.getElementById('cat-search'); if(s) s.value = prod.number;
    renderCatalog();
    renderCatalogDetail();
  } else {
    var ids = productIds(productScreen);
    document.getElementById(ids.input).value = prod.number;
    onProductInput(productScreen);
  }
  toast('Product saved');
}

// ===== PANTALLA ADD PRODUCT =====
// Alta de productos nuevos, aparte del catalogo: el catalogo es para
// modificar lo que ya existe.
function initAddProduct(){
  resetAddProduct();
}

function resetAddProduct(){
  ['number','name','custom-label','min','max','bags','barcode'].forEach(function(f){
    var e = pel('ap', f); if(e) e.value = '';
  });
  var box = document.getElementById('ap-labblock');
  if(box){
    box.innerHTML = labBlockHTML('ap', null);
    fillLabBlock('ap', null);
  }
  fillProductSizes('ap');
  var num = pel('ap','number'); if(num) num.focus();
}

function saveNewProduct(){
  var prod = readProductForm('ap');
  if(!prod) return;
  // Los tests se leen SOLO del bloque de esta pantalla
  if(typeof readLabTestPicker==='function'){
    readLabTestPicker(prod, document.getElementById('ap-lt'));
  }
  persistNewProduct(prod);
  resetAddProduct();
  toast(prod.number+' saved \u2014 edit it in Product Catalog');
}

// Escanear el codigo del producto nuevo desde la pantalla de alta
function scanNewProduct(){ openScanner('addproduct'); }

// Asocia un código escaneado a un producto que ya existe
function linkBarcode(product, code){
  var c = normNumber(code);
  if(!c || normNumber(product.number)===c) return;
  var list = getProducts();
  var p = list.find(function(x){ return x.id===product.id; });
  if(!p) return;
  p.barcodes = p.barcodes || [];
  if(p.barcodes.some(function(b){ return normNumber(b)===c; })) return;
  p.barcodes.push(c);
  saveProducts(list);
  if(window.saveToFirebaseAt && p._fbId) window.saveToFirebaseAt('products', p._fbId, p);
}
