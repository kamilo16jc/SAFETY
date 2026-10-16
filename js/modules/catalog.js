// ===== PRODUCTS SCREEN (catálogo) =====
// La tabla del catálogo a todo el ancho, con búsqueda y orden. Cada fila lleva
// una lupa que abre la ficha del producto para verlo y editarlo. El alta sigue
// viviendo en js/modules/products.js (el mismo modal que usan Weight y Seal).
var catSort = 'number', catDir = 1, catFilter = '', catSelected = null;
// El catalogo NO arrastra los cientos de productos de entrada: se busca el que
// se quiere corregir. "Show all" los trae todos cuando de verdad hace falta.
var catShowAll = false;

function initCatalog(){
  var s = document.getElementById('cat-search');
  if(s) s.value = catFilter;
  catSelected = null;          // al volver a la pantalla no se reabre la ficha
  renderCatalogAllBtn();
  renderCatalog();
  renderCatalogDetail();
}

function renderCatalogAllBtn(){
  var b = document.getElementById('cat-all-btn');
  if(b){
    b.textContent = catShowAll ? 'Show searched only' : 'Show all';
    b.classList.toggle('on', catShowAll);
  }
}
function toggleCatalogAll(){
  catShowAll = !catShowAll;
  renderCatalogAllBtn();
  renderCatalog();
}

function catalogRows(){
  var q = catFilter.trim().toLowerCase();
  if(!q && !catShowAll) return [];     // sin busqueda no se trae nada
  var list = getProducts().filter(function(p){
    if(!q) return true;
    return String(p.number).toLowerCase().indexOf(q)>-1 ||
           String(p.name||'').toLowerCase().indexOf(q)>-1 ||
           (p.barcodes||[]).some(function(b){ return String(b).toLowerCase().indexOf(q)>-1; });
  });
  return list.sort(function(a,b){
    var av, bv;
    if(catSort==='size' || catSort==='target'){
      av = a.target ? a.target.min : -1;
      bv = b.target ? b.target.min : -1;
    } else if(catSort==='bags'){
      av = a.bagsPerCase||0; bv = b.bagsPerCase||0;
    } else if(catSort==='linked'){
      av = (a.barcodes||[]).length; bv = (b.barcodes||[]).length;
    } else {
      av = String(a[catSort]||'').toLowerCase(); bv = String(b[catSort]||'').toLowerCase();
    }
    return av<bv ? -catDir : av>bv ? catDir : 0;
  });
}

function catTargetText(p){
  return (p.target && p.target.min!=null)
    ? p.target.min.toFixed(2)+' – '+p.target.max.toFixed(2)
    : '';
}

function renderCatalog(){
  var body = document.getElementById('cat-rows');
  if(!body) return;
  var list = catalogRows();
  var all  = getProducts();

  if(!list.length){
    var msg;
    if(!all.length)                   msg = 'No products yet. Add the first one in Create Product.';
    else if(!catFilter.trim() && !catShowAll)
      msg = 'Type a number or description and press the magnifier (or Enter) — or "Show all".';
    else if(catFilter.trim())         msg = 'No product matches “'+esc(catFilter)+'”.';
    else                              msg = 'No products.';
    body.innerHTML = '<tr><td colspan="9" class="cd-empty">'+msg+'</td></tr>';
  } else {
    body.innerHTML = list.map(function(p){
      var t = catTargetText(p);
      var linked = (p.barcodes||[]).length;
      return '<tr data-num="'+esc(p.number)+'" aria-selected="'+(p.number===catSelected)+'">'+
        '<td class="code">'+esc(p.number)+'</td>'+
        '<td class="desc">'+esc(p.name||'—')+(p.labSample?' <span class="tag">LAB</span>':'')+'</td>'+
        '<td class="mono">'+esc(p.pkgLabel||'—')+'</td>'+
        '<td class="mono">'+(t ? t+' <span style="color:var(--dim)">'+unitLabel(pkgUnit({label:p.pkgLabel}))+'</span>' : '<span class="tag bad">not set</span>')+'</td>'+
        '<td class="mono num">'+(p.bagsPerCase||'—')+'</td>'+
        '<td>'+(linked ? '<span class="tag ok">Linked</span>' : '<span class="tag">Not linked</span>')+'</td>'+
        '<td class="soft col-by">'+esc(p.createdBy||'—')+'</td>'+
        '<td class="mono soft">'+((p.createdAt||'').slice(5,10) || '—')+'</td>'+
        '<td class="view-cell" data-nolabel><button class="view-btn" type="button" data-icon="search"'+
          ' aria-label="Open product '+esc(p.number)+'" title="Open product"'+
          ' onclick="openCatalogCard(this.closest(\'tr\').getAttribute(\'data-num\'))"></button></td>'+
      '</tr>';
    }).join('');
    if(typeof renderIcons==='function') renderIcons(body);
  }

  var foot = document.getElementById('cat-foot');
  if(foot){
    var sizes = {};
    all.forEach(function(p){ if(p.pkgLabel) sizes[p.pkgLabel]=1; });
    var noTarget = all.filter(function(p){ return !p.target || p.target.min==null; }).length;
    foot.innerHTML =
      '<span><b>'+list.length+'</b> shown of '+all.length+'</span>'+
      '<span><b>'+all.filter(function(p){return (p.barcodes||[]).length}).length+'</b> with barcode</span>'+
      '<span><b>'+Object.keys(sizes).length+'</b> package sizes in use</span>'+
      '<span><b>'+noTarget+'</b> missing a target range</span>';
  }
  var count = document.getElementById('cat-count');
  if(count) count.textContent = all.length;
}

// La lupa de la fila abre la ficha; la X, el fondo o Escape la cierran
function openCatalogCard(number){
  catSelected = number;
  renderCatalog();
  renderCatalogDetail();
}
function closeCatalogCard(){
  if(catSelected == null) return;
  catSelected = null;
  renderCatalog();
  renderCatalogDetail();
}
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  var m = document.getElementById('cat-modal');
  // la ventana de tests va encima: Escape cierra primero esa, no la ficha
  if(m && !m.hidden && !document.querySelector('#cat-detail .lt-modal:not([hidden])')) closeCatalogCard();
});

function sortCatalog(th, key){
  catDir = (key===catSort) ? -catDir : 1;
  catSort = key;
  document.querySelectorAll('#cat-table thead th').forEach(function(o){ o.removeAttribute('aria-sort'); });
  th.setAttribute('aria-sort', catDir===1 ? 'ascending' : 'descending');
  var a = th.querySelector('.arrow');
  if(a) a.textContent = catDir===1 ? '▲' : '▼';
  renderCatalog();
}

// Buscar es una orden, no un efecto de teclear: corre con la lupa o con Enter.
function runCatalogSearch(){
  var s = document.getElementById('cat-search');
  catFilter = s ? s.value : '';
  renderCatalog();
}
function catalogSearchKey(e){ if(e.key==='Enter'){ e.preventDefault(); runCatalogSearch(); } }

function renderCatalogDetail(){
  var el = document.getElementById('cat-detail');
  var modal = document.getElementById('cat-modal');
  if(!el) return;
  var p = getProducts().filter(function(x){ return x.number===catSelected; })[0];
  if(!p){
    el.innerHTML = '';
    if(modal) modal.hidden = true;
    return;
  }
  if(modal) modal.hidden = false;
  var canDelete = currentUser && (currentUser.role==='admin' || currentUser.role==='supervisor');
  var sizeOpts = PKGS.map(function(k,i){
    return '<option value="'+i+'"'+(p.pkg===i?' selected':'')+'>'+k.label+'</option>';
  }).join('');
  // Un peso que no está en la lista se conserva como opción propia
  if(p.pkg==null && p.pkgLabel){
    sizeOpts += '<option value="custom" selected>'+esc(p.pkgLabel)+'</option>';
  }

  el.innerHTML =
    '<div class="cd-head">'+
      '<div class="cd-title">'+
        '<h2>'+esc(p.name||'Product '+p.number)+'</h2>'+
        '<div class="cd-num">Product '+esc(p.number)+(p.pkgLabel?' · '+esc(p.pkgLabel):'')+'</div>'+
      '</div>'+
      '<button class="cd-close" type="button" aria-label="Close" title="Close" onclick="closeCatalogCard()">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'+
      '</button>'+
    '</div>'+
    '<div class="cd-body">'+
      '<div class="field-group"><div class="sec-label">Description</div>'+
        '<input type="text" class="field" id="cd-name" value="'+esc(p.name||'')+'"></div>'+
      '<div class="field-group"><div class="sec-label">Package Size</div>'+
        '<div class="select-wrap"><select class="field" id="cd-size">'+sizeOpts+'</select></div></div>'+
      '<div class="field-group"><div class="sec-label">Target Range <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:500">· in the unit of the package (lb or oz)</span></div>'+
        '<div class="pair">'+
          '<input type="text" class="field" id="cd-min" inputmode="decimal" placeholder="Min" value="'+(p.target&&p.target.min!=null?p.target.min:'')+'">'+
          '<input type="text" class="field" id="cd-max" inputmode="decimal" placeholder="Max" value="'+(p.target&&p.target.max!=null?p.target.max:'')+'">'+
        '</div>'+
        '<div class="hint">Leave empty to log weights without scoring them.</div></div>'+
      '<div class="pair">'+
        '<div class="field-group"><div class="sec-label">Bags per case</div>'+
          '<input type="text" class="field" id="cd-bags" inputmode="numeric" value="'+(p.bagsPerCase||'')+'"></div>'+
        '<div class="field-group"><div class="sec-label">Barcode</div>'+
          '<button class="btn-ghost" style="width:100%;justify-content:center" onclick="catalogRescan()">'+
            ((p.barcodes||[]).length ? 'Linked · rescan' : 'Scan to link')+'</button></div>'+
      '</div>'+
      (typeof labTargetsHTML==='function' ? labTargetsHTML('cd', p) : '')+
      labBlockHTML('cd', p)+
      '<div class="cd-meta">'+
        '<div>Created by <span>'+esc(p.createdBy||'—')+'</span></div>'+
        '<div>Added <span>'+((p.createdAt||'').slice(0,10)||'—')+'</span></div>'+
        '<div>Used in <span>'+countProductUse(p.number)+' records</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="cd-actions">'+
      saveBtn('saveCatalogEdits(this)', {texto:'Save changes', grande:true})+
      (canDelete ? '<button class="btn-danger" onclick="deleteCatalogProduct()">Delete</button>' : '')+
    '</div>';
  // El bloque de laboratorio se rellena una vez esta en el DOM
  fillLabBlock('cd', p);
}


// Cliente del producto + los tests que exige. El número suele bastar, pero los
// clientes marcados "all items" (no listan números) hay que asignarlos a mano.

// Cuántos registros usan el producto (para saber qué se arrastra al editarlo)
function countProductUse(number){
  var db = getDB();
  var n = 0;
  ['weights','seals'].forEach(function(col){
    (db[col]||[]).forEach(function(r){ if(String(r.product||'')===String(number)) n++; });
  });
  return n;
}

function saveCatalogEdits(btn){
  var list = getProducts();
  var p = list.filter(function(x){ return x.number===catSelected; })[0];
  if(!p) return;

  var sizeVal = document.getElementById('cd-size').value;
  var mn = parseFloat(document.getElementById('cd-min').value);
  var mx = parseFloat(document.getElementById('cd-max').value);
  var bags = parseInt(document.getElementById('cd-bags').value);

  if(!isNaN(mn) !== !isNaN(mx)){ toast('Enter both min and max, or leave both empty'); return; }
  if(!isNaN(mn) && !isNaN(mx) && mn>=mx){ toast('Min must be lower than max'); return; }

  p.name = document.getElementById('cd-name').value.trim();
  if(sizeVal!=='custom'){
    p.pkg = parseInt(sizeVal);
    p.pkgLabel = PKGS[p.pkg].label;
    // Si no se escribió un target propio, se toma el del tamaño elegido
    if(isNaN(mn) || isNaN(mx)){ mn = PKGS[p.pkg].min; mx = PKGS[p.pkg].max; }
  }
  p.target = (!isNaN(mn) && !isNaN(mx)) ? {min:mn, max:mx} : null;
  p.bagsPerCase = isNaN(bags) ? null : bags;
  if(typeof readLabTargets==='function') p.labTargets = readLabTargets('cd');
  var lab = readLabBlock('cd');
  p.labSamples   = lab.labSamples;
  p.labSample    = lab.labSample;
  p.plate        = lab.plate;
  p.customerMode = lab.customerMode;
  p.customerIds  = lab.customerIds;
  p.customerId   = lab.customerId;
  // Los tests ya no son del producto: salen de su cliente. Lo que quedaba
  // marcado aqui de antes se va al guardar, para que nadie lo tome por vigente.
  delete p.labTests; delete p.externalLab; delete p.labTestsAt; delete p.labTestsBy;
  p.updatedBy = currentUser ? currentUser.name : '—';
  p.updatedAt = localISOStr();

  saveProducts(list);
  // Reescribe el mismo documento: si no, la copia vieja volvería al sincronizar
  if(p._fbId && window.saveToFirebaseAt) window.saveToFirebaseAt('products', p._fbId, p);
  else if(window.saveToFirebase) window.saveToFirebase('products', p);

  logActivity('admin','Product updated',
    p.number+(p.name?' — '+p.name:'')+' · '+productSummary(p),
    currentUser?currentUser.name:'—');

  renderProductOptions('w-product-list');
  renderProductOptions('s-product-list');
  renderCatalog();
  renderCatalogDetail();
  toast('Product updated');
}

function deleteCatalogProduct(){
  var p = getProducts().filter(function(x){ return x.number===catSelected; })[0];
  if(!p) return;
  if(!currentUser || (currentUser.role!=='admin' && currentUser.role!=='supervisor')){
    toast('Only admins and supervisors can delete products'); return;
  }
  var used = countProductUse(p.number);
  var msg = 'Delete product '+p.number+(p.name?' ('+p.name+')':'')+'?';
  if(used) msg += '\n\n'+used+' saved record(s) already use this number. They keep the data they were saved with — only the catalog entry goes away.';
  if(!confirm(msg)) return;

  var rest = getProducts().filter(function(x){ return x.number!==p.number; });
  saveProducts(rest);
  if(p._fbId && window.deleteFromFirebase) window.deleteFromFirebase('products', p._fbId);
  logActivity('admin','Product deleted', p.number+(p.name?' — '+p.name:''), currentUser?currentUser.name:'—');

  catSelected = null;
  renderProductOptions('w-product-list');
  renderProductOptions('s-product-list');
  renderCatalog();
  renderCatalogDetail();
  toast('Product deleted');
}

// Escaneo desde la pantalla de productos
function catalogRescan(){ openScanner('catalog'); }

function catalogScanResult(code){
  var p = findProduct(code);
  if(p){
    if(catSelected && catSelected!==p.number) linkBarcode(p, code);
    catSelected = p.number;
    // queda buscado: al cerrar la ficha, su fila sigue a la vista
    catFilter = p.number;
    var s = document.getElementById('cat-search'); if(s) s.value = p.number;
    renderCatalog();
    renderCatalogDetail();
    toast('Scanned: '+p.number);
  } else if(catSelected){
    // Código nuevo sobre el producto abierto: se le asocia
    var sel = getProducts().filter(function(x){ return x.number===catSelected; })[0];
    if(sel){
      linkBarcode(sel, code);
      renderCatalog();
      renderCatalogDetail();
      toast('Barcode linked to '+sel.number);
      return;
    }
  } else {
    pendingBarcode = normNumber(code);
    openProductModal('catalog');
    toast('New barcode — create the product');
  }
}
