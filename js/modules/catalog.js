// ===== PRODUCTS SCREEN (catálogo) =====
// Tabla del catálogo con búsqueda, orden y panel de edición. El alta sigue
// viviendo en js/modules/products.js (el mismo modal que usan Weight y Seal).
var catSort = 'number', catDir = 1, catFilter = '', catSelected = null;

function initCatalog(){
  var s = document.getElementById('cat-search');
  if(s) s.value = catFilter;
  renderCatalog();
  renderCatalogDetail();
}

function catalogRows(){
  var q = catFilter.trim().toLowerCase();
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
    body.innerHTML = '<tr><td colspan="8" class="cd-empty">'+
      (all.length ? 'No product matches “'+catFilter+'”.' : 'No products yet. Create the first one and it fills in by itself from then on.')+
      '</td></tr>';
  } else {
    body.innerHTML = list.map(function(p){
      var t = catTargetText(p);
      var linked = (p.barcodes||[]).length;
      return '<tr data-num="'+p.number+'" tabindex="0" aria-selected="'+(p.number===catSelected)+'" onclick="selectCatalogRow(this.getAttribute(\'data-num\'))">'+
        '<td class="code">'+p.number+'</td>'+
        '<td class="desc">'+(p.name||'—')+'</td>'+
        '<td class="mono">'+(p.pkgLabel||'—')+'</td>'+
        '<td class="mono">'+(t ? t+' <span style="color:var(--dim)">lbs</span>' : '<span class="tag warn">not set</span>')+'</td>'+
        '<td class="mono num">'+(p.bagsPerCase||'—')+'</td>'+
        '<td>'+(linked ? '<span class="tag ok">Linked</span>' : '<span class="tag">Not linked</span>')+'</td>'+
        '<td class="soft col-by">'+(p.createdBy||'—')+'</td>'+
        '<td class="mono soft">'+((p.createdAt||'').slice(5,10) || '—')+'</td>'+
      '</tr>';
    }).join('');
  }

  var foot = document.getElementById('cat-foot');
  if(foot){
    var sizes = {};
    all.forEach(function(p){ if(p.pkgLabel) sizes[p.pkgLabel]=1; });
    var noTarget = all.filter(function(p){ return !p.target || p.target.min==null; }).length;
    foot.innerHTML =
      '<span><b>'+list.length+'</b> shown</span>'+
      '<span><b>'+all.filter(function(p){return (p.barcodes||[]).length}).length+'</b> with barcode</span>'+
      '<span><b>'+Object.keys(sizes).length+'</b> package sizes in use</span>'+
      '<span><b>'+noTarget+'</b> missing a target range</span>';
  }
  var count = document.getElementById('cat-count');
  if(count) count.textContent = all.length;
}

function selectCatalogRow(number){
  catSelected = number;
  renderCatalog();
  renderCatalogDetail();
}

function sortCatalog(th, key){
  catDir = (key===catSort) ? -catDir : 1;
  catSort = key;
  document.querySelectorAll('#cat-table thead th').forEach(function(o){ o.removeAttribute('aria-sort'); });
  th.setAttribute('aria-sort', catDir===1 ? 'ascending' : 'descending');
  var a = th.querySelector('.arrow');
  if(a) a.textContent = catDir===1 ? '▲' : '▼';
  renderCatalog();
}

function onCatalogSearch(v){
  catFilter = v;
  renderCatalog();
}

function renderCatalogDetail(){
  var el = document.getElementById('cat-detail');
  if(!el) return;
  var p = getProducts().filter(function(x){ return x.number===catSelected; })[0];
  if(!p){
    el.innerHTML = '<div class="cd-empty">Select a product to see and edit its details.</div>';
    return;
  }
  var canDelete = currentUser && (currentUser.role==='admin' || currentUser.role==='supervisor');
  var sizeOpts = PKGS.map(function(k,i){
    return '<option value="'+i+'"'+(p.pkg===i?' selected':'')+'>'+k.label+'</option>';
  }).join('');
  // Un peso que no está en la lista se conserva como opción propia
  if(p.pkg==null && p.pkgLabel){
    sizeOpts += '<option value="custom" selected>'+p.pkgLabel+'</option>';
  }

  el.innerHTML =
    '<div class="cd-head">'+
      '<h2>'+(p.name||'Product '+p.number)+'</h2>'+
      '<div class="cd-num">Product '+p.number+'</div>'+
    '</div>'+
    '<div class="cd-body">'+
      '<div class="field-group"><div class="sec-label">Description</div>'+
        '<input type="text" class="field" id="cd-name" value="'+(p.name||'').replace(/"/g,'&quot;')+'"></div>'+
      '<div class="field-group"><div class="sec-label">Package Size</div>'+
        '<div class="select-wrap"><select class="field" id="cd-size">'+sizeOpts+'</select></div></div>'+
      '<div class="field-group"><div class="sec-label">Target Range (lbs)</div>'+
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
      '<div class="cd-meta">'+
        '<div>Created by <span>'+(p.createdBy||'—')+'</span></div>'+
        '<div>Added <span>'+((p.createdAt||'').slice(0,10)||'—')+'</span></div>'+
        '<div>Used in <span>'+countProductUse(p.number)+' records</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="cd-actions">'+
      '<button class="btn-solid" onclick="saveCatalogEdits()">Save changes</button>'+
      (canDelete ? '<button class="btn-danger" onclick="deleteCatalogProduct()">Delete</button>' : '')+
    '</div>';
}

// Cuántos registros usan el producto (para saber qué se arrastra al editarlo)
function countProductUse(number){
  var db = getDB();
  var n = 0;
  ['weights','seals'].forEach(function(col){
    (db[col]||[]).forEach(function(r){ if(String(r.product||'')===String(number)) n++; });
  });
  return n;
}

function saveCatalogEdits(){
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
  toast('Product updated ✓');
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
    catFilter = '';
    var s = document.getElementById('cat-search'); if(s) s.value='';
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
