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
  saveDB(db);
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
  return screen==='seal'
    ? {input:'s-product', card:'s-product-card', list:'s-product-list'}
    : {input:'w-product', card:'w-product-card', list:'w-product-list'};
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

  var sel = document.getElementById('prod-pkg');
  sel.innerHTML = '<option value="">Select package size</option>'+
    PKGS.map(function(p,i){ return '<option value="'+i+'">'+p.label+'</option>'; }).join('')+
    '<option value="other">Other size…</option>';
  sel.value = '';
  toggleProductCustom();

  document.getElementById('product-modal').style.display='flex';
  document.body.style.overflow='hidden';
}

function closeProductModal(){
  document.getElementById('product-modal').style.display='none';
  document.body.style.overflow='';
  pendingBarcode='';
}

// Muestra los campos de peso libre sólo cuando se elige "Other size…"
function toggleProductCustom(){
  var other = document.getElementById('prod-pkg').value === 'other';
  document.getElementById('prod-custom-wrap').style.display = other ? 'block' : 'none';
}

function saveProduct(){
  var number = normNumber(document.getElementById('prod-number').value);
  if(!number){ toast('Enter the product number'); return; }
  if(findProduct(number)){ toast('That product number already exists'); return; }

  var sel = document.getElementById('prod-pkg').value;
  var pkg = null, pkgLabel = '', target = null;

  if(sel==='other'){
    pkgLabel = document.getElementById('prod-custom-label').value.trim();
    if(!pkgLabel){ toast('Enter the package size (e.g. 3.5 lbs)'); return; }
    var mn = parseFloat(document.getElementById('prod-min').value);
    var mx = parseFloat(document.getElementById('prod-max').value);
    // El target es opcional: sin él no se marca pass/fail, sólo se registra el peso
    if(!isNaN(mn) && !isNaN(mx)){
      if(mn>=mx){ toast('Min must be lower than max'); return; }
      target = {min:mn, max:mx};
    }
  } else if(sel!==''){
    pkg = parseInt(sel);
    pkgLabel = PKGS[pkg].label;
    target = {min:PKGS[pkg].min, max:PKGS[pkg].max};
  } else {
    toast('Select the package size'); return;
  }

  var bags = parseInt(document.getElementById('prod-bags').value);
  var barcode = normNumber(document.getElementById('prod-barcode').value);

  var prod = {
    id: Date.now(),
    number: number,
    name: document.getElementById('prod-name').value.trim(),
    pkg: pkg,
    pkgLabel: pkgLabel,
    target: target,
    bagsPerCase: isNaN(bags) ? null : bags,
    barcodes: barcode ? [barcode] : [],
    createdBy: currentUser ? currentUser.name : '—',
    createdAt: localISOStr()
  };

  var list = getProducts();
  list.push(prod);
  saveProducts(list);
  if(window.saveToFirebase) window.saveToFirebase('products', prod);
  logActivity('admin','Product created',
    prod.number+(prod.name?' — '+prod.name:'')+' · '+productSummary(prod),
    currentUser?currentUser.name:'—');

  closeProductModal();
  renderProductOptions('w-product-list');
  renderProductOptions('s-product-list');
  // Deja el producto recién creado seleccionado en la pantalla donde se pidió
  var ids = productIds(productScreen);
  document.getElementById(ids.input).value = prod.number;
  onProductInput(productScreen);
  toast('Product saved ✓');
}

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
