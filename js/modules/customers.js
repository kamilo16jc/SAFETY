// ===== CLIENTES =====
// Hasta ahora un cliente solo se podia crear —desde la ficha de un producto— y
// nunca mas se le podia mirar ni corregir. Con el certificado de por medio eso
// dejo de valer: de aqui salen el telefono, el fax, el contacto, el correo, el
// empaque y los cinco objetivos que imprime el COA, y tambien los tests que un
// producto hereda cuando no eligio los suyos.
//
// Esta pantalla es ese sitio: ver, corregir y borrar.

var custQuery = '', custOpen = null;

function initCustomers(){
  custOpen = null;
  var q = document.getElementById('cu-search');
  if(q) q.value = custQuery;
  renderCustomers();
}

function saveCustomerList(list){
  var db = getDB();
  if(!db.customers) db.customers = {list:[], tests:[]};
  db.customers.list = list;
  saveDB(db);
  if(window.saveCustomersToFirebase) window.saveCustomersToFirebase(db.customers);
}

// Cuantos productos apuntan a este cliente, contando los dos caminos: el que
// se le asigno a mano y el que se deduce de su lista de numeros.
function custProductCount(c){
  var n = 0;
  (getProducts()||[]).forEach(function(p){
    if(p.customerId === c.customerId) { n++; return; }
    if((p.customerIds||[]).indexOf(c.customerId) >= 0) { n++; return; }
    if((c.products||[]).some(function(x){ return normNumber(x) === normNumber(p.number); })) n++;
  });
  return n;
}

function custMatches(c){
  if(!custQuery) return true;
  var hay = (String(c.company||'')+' '+String(c.customerId||'')+' '+
             String(c.contact||'')+' '+String(c.email||'')).toLowerCase();
  return hay.indexOf(custQuery) >= 0;
}

function onCustSearch(v){
  custQuery = String(v||'').trim().toLowerCase();
  renderCustomers();
}

function renderCustomers(){
  var host = document.getElementById('cu-sheet');
  if(!host) return;
  var todos = getCustomers().slice().sort(function(a,b){
    return String(a.company||'').localeCompare(String(b.company||''));
  });
  var list = todos.filter(custMatches);

  var kp = document.getElementById('cu-kpis');
  if(kp){
    var conTests = todos.filter(function(c){ return (c.tests||[]).length; }).length;
    var sinDatos = todos.filter(function(c){ return !c.phone && !c.email && !c.contact; }).length;
    kp.innerHTML =
      kpiCard(todos.length, 'customers', {icono:'user'}) +
      kpiCard(conTests, 'carry lab tests', {tono:conTests?'warn':'', icono:'droplet'}) +
      kpiCard(sinDatos, 'without contact', {tono:sinDatos?'bad':'', icono:'alert'});
    renderIcons(kp);
  }

  if(!list.length){
    host.innerHTML = '<div class="sheet-empty">'+
      (todos.length ? 'No customer matches that search.'
                    : 'No customers yet. They are created from a product’s Laboratory block.')+
      '</div>';
    return;
  }

  host.innerHTML =
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Customer</th><th>ID</th><th>Contact</th><th>Phone</th>'+
      '<th class="num">Products</th><th>Lab tests</th><th></th><th></th>'+
    '</tr></thead><tbody>'+
    list.map(function(c, i){
      var tests = (c.tests||[]).length;
      return '<tr'+(custOpen===c.customerId?' class="done"':'')+'>'+
        '<td class="rn">'+(i+1)+'</td>'+
        '<td class="wide"><b>'+esc(c.company||'—')+'</b></td>'+
        '<td class="code">'+esc(c.customerId||'—')+'</td>'+
        '<td class="soft">'+esc(c.contact||'—')+'</td>'+
        '<td class="soft">'+esc(c.phone||'—')+'</td>'+
        '<td class="num">'+custProductCount(c)+'</td>'+
        '<td>'+(tests
          ? '<span class="pill warn" title="'+esc((c.tests||[]).join(' · '))+'">'+tests+'</span>'
          : '<span class="soft">—</span>')+'</td>'+
        '<td><button class="sheet-btn" onclick="editCustomer(\''+esc(c.customerId)+'\')">Edit</button></td>'+
        '<td><button class="run-del" title="Delete customer" '+
          'onclick="deleteCustomer(\''+esc(c.customerId)+'\')">×</button></td>'+
      '</tr>'+
      (custOpen===c.customerId ? '<tr><td colspan="9">'+custEditorHTML(c)+'</td></tr>' : '');
    }).join('')+
    '</tbody></table></div>';
  renderIcons(host);
}

// ---- El editor: los mismos campos que pide el certificado ----
function custEditorHTML(c){
  var v = function(x){ return esc(x==null?'':x); };
  var t = c.targets || {};
  var campo = function(f, rot, val){
    return '<div class="sb-field"><label for="cu-'+f+'">'+rot+'</label>'+
      '<input type="text" class="field" id="cu-'+f+'" value="'+v(val)+'"></div>';
  };
  return '<div class="cu-edit">'+
    '<div class="sheet-bar">'+
      campo('company','Customer name', c.company)+
      campo('id','Customer ID', c.customerId)+
      campo('prod','Product name', c.productName)+
      campo('pack','Product packaging', c.packaging)+
    '</div>'+
    '<div class="sheet-bar">'+
      campo('contact','Contact', c.contact)+
      campo('email','Email', c.email)+
      campo('phone','Phone', c.phone)+
      campo('fax','Fax', c.fax)+
      campo('code','Customer code', c.code)+
    '</div>'+
    // Los objetivos son del producto, no del cliente: dos productos del mismo
    // cliente tienen humedades distintas. Se ponen en Add Product y en el
    // catalogo, y desde ahi los toma el certificado.
    
    // Las reglas del laboratorio son del cliente: el producto las hereda.
    // Create Product ya no las pregunta, asi que este es el unico sitio donde
    // se dicen.
    '<div class="sub-label">Lab rules</div>'+
    '<div class="sheet-bar">'+
      '<div class="sb-field"><label for="cu-per">Samples per order</label>'+
        '<input type="text" class="field" id="cu-per" inputmode="numeric" value="'+
        v(c.samplesPerOrder == null ? 1 : c.samplesPerOrder)+'"></div>'+
      '<label class="lab-check" style="margin:0">'+
        '<input type="checkbox" id="cu-numbered"'+(c.numbered?' checked':'')+'>'+
        '<span>Samples are numbered</span></label>'+
    '</div>'+
    custTestsHTML(c)+
    '<div class="sheet-actions">'+
      '<button class="save-btn" onclick="saveCustomerEdit(\''+esc(c.customerId)+'\')">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
        '<path d="m5 12.5 4.5 4.5L19 7"/></svg>Save</button>'+
      '<button class="btn-ghost" onclick="closeCustomer()">Cancel</button>'+
    '</div>'+
  '</div>';
}

function editCustomer(id){
  custOpen = (custOpen === id) ? null : id;
  renderCustomers();
}
function closeCustomer(){ custOpen = null; renderCustomers(); }

function saveCustomerEdit(id){
  var list = getCustomers();
  var c = list.filter(function(x){ return x.customerId === id; })[0];
  if(!c) return;
  var g = function(f){ var e = document.getElementById('cu-'+f); return e ? e.value.trim() : ''; };

  var nuevoId = g('id').toUpperCase();
  if(!g('company')){ toast('Enter the customer name'); return; }
  if(!nuevoId){ toast('Enter the customer ID'); return; }
  if(nuevoId !== id && list.some(function(x){ return x.customerId === nuevoId; })){
    toast('That customer ID already exists'); return;
  }

  c.company     = g('company');
  c.customerId  = nuevoId;
  c.productName = g('prod');
  c.packaging   = g('pack');
  c.contact     = g('contact');
  c.email       = g('email');
  c.phone       = g('phone');
  c.fax         = g('fax');
  c.code        = g('code').toUpperCase();
  // Los objetivos numericos viven en el producto. Los de texto que quedan en
  // clientes viejos solo se tocan si sus campos siguen en pantalla: si no,
  // guardar borraba lo que el certificado todavia lee.
  if(document.getElementById('cu-tmoist')){
    c.targets   = {moisture:g('tmoist'), fat:g('tfat'), ph:g('tph'),
                   yeast:g('tyeast'), mold:g('tmold')};
  }
  var per = document.getElementById('cu-per');
  if(per) c.samplesPerOrder = Math.max(1, parseInt(per.value, 10) || 1);
  var num = document.getElementById('cu-numbered');
  if(num) c.numbered = !!num.checked;
  if(document.querySelector('.cu-test')){
    var marcados = [];
    Array.prototype.forEach.call(document.querySelectorAll('.cu-test:checked'), function(b){
      marcados.push(b.getAttribute('data-lt-label'));
    });
    c.tests = marcados;
  }
  c.updatedBy   = currentUser ? currentUser.name : '—';
  c.updatedAt   = localISOStr();

  // Si cambio el codigo, los productos que apuntaban al viejo se quedarian
  // huerfanos: se reapuntan aqui mismo.
  if(nuevoId !== id){
    var prods = getProducts();
    var tocados = 0;
    prods.forEach(function(p){
      if(p.customerId === id){ p.customerId = nuevoId; tocados++; }
      var ids = p.customerIds || [];
      var k = ids.indexOf(id);
      if(k >= 0){ ids[k] = nuevoId; tocados++; }
    });
    if(tocados) saveProducts(prods);
  }

  saveCustomerList(list);
  logActivity('admin','Customer updated', c.company+' ('+c.customerId+')',
              currentUser?currentUser.name:'—');
  custOpen = null;
  renderCustomers();
  toast('Customer saved');
}

// ===== LOS TESTS DEL CLIENTE =====
// Antes solo se podian quitar. Desde que Create Product dejo de preguntarlos,
// este es el sitio donde se eligen: misma ventana y mismo catalogo que usaba
// el producto, pero guardando nombres, que es como el cliente los tiene.
function custTestsHTML(c){
  var cat = (typeof labTestCatalog === 'function') ? labTestCatalog() : {};
  var hay = Object.keys(cat).some(function(k){ return (cat[k] || []).length; });
  if(!hay) return '<div class="hint">No lab test catalog loaded yet.</div>';
  var puestos = (c.tests || []).map(function(t){ return labNorm(labTestName(t)); });
  var grupo = function(kind, titulo){
    if(!(cat[kind] || []).length) return '';
    return '<div class="lt-group"><div class="lt-title">'+titulo+'</div>'+
      cat[kind].map(function(lbl){
        var marcada = puestos.indexOf(labNorm(lbl)) >= 0;
        return '<label class="lt-item"><input type="checkbox" class="cu-test" '+
          'data-lt-label="'+esc(lbl)+'"'+(marcada?' checked':'')+'>'+
          '<span>'+esc(lbl)+'</span></label>';
      }).join('')+'</div>';
  };
  return '<div class="lt-ask-row">'+
      '<button type="button" class="btn-ghost" onclick="custTestsOpen()">Choose lab tests</button>'+
      '<span class="lt-count" id="cu-test-count">'+custTestsLabel((c.tests||[]).length)+'</span>'+
      ((c.tests||[]).length
        ? ' <button type="button" class="lt-clear" onclick="clearCustomerTests(\''+esc(c.customerId)+'\')">Remove them</button>'
        : '')+
    '</div>'+
    '<div class="lt-modal" id="cu-ltmodal" hidden><div class="lt-sheet">'+
      '<div class="lt-head"><b>Lab tests \u00b7 '+esc(c.company || c.customerId)+'</b>'+
        '<button type="button" class="ico-btn" aria-label="Close" onclick="custTestsClose()">'+
        '<span data-icon="close"></span></button></div>'+
      '<div class="lt-box">'+grupo('micro','Micro')+grupo('chem','Chemistry')+grupo('nlea','NLEA')+'</div>'+
      '<div class="lt-foot"><button type="button" class="save-btn" onclick="custTestsClose()">Done</button>'+
      '</div></div></div>';
}
function custTestsLabel(n){ return n ? (n + ' test' + (n===1?'':'s')) : 'none'; }
function custTestsOpen(){ var m = document.getElementById('cu-ltmodal'); if(m) m.hidden = false; }
function custTestsClose(){
  var m = document.getElementById('cu-ltmodal'); if(m) m.hidden = true;
  var n = document.querySelectorAll('.cu-test:checked').length;
  var e = document.getElementById('cu-test-count'); if(e) e.textContent = custTestsLabel(n);
}

// Los tests del cliente son los que un producto hereda si no eligio los suyos.
// Quitarlos de aqui corta la herencia de todos sus productos de una vez.
function clearCustomerTests(id){
  var list = getCustomers();
  var c = list.filter(function(x){ return x.customerId === id; })[0];
  if(!c) return;
  var n = (c.tests||[]).length;
  if(!confirm('Remove the '+n+' lab test(s) on '+(c.company||id)+'?\n\n'+
              'Products that did not pick their own tests will stop inheriting them.')) return;
  c.tests = [];
  saveCustomerList(list);
  logActivity('admin','Customer lab tests removed', (c.company||id)+' · '+n+' test(s)',
              currentUser?currentUser.name:'—');
  renderCustomers();
  toast('Tests removed');
}

function deleteCustomer(id){
  var list = getCustomers();
  var c = list.filter(function(x){ return x.customerId === id; })[0];
  if(!c) return;
  if(typeof canDeleteRecords === 'function' && !canDeleteRecords()){
    toast('Your role cannot delete'); return;
  }
  var n = custProductCount(c);
  var aviso = 'Delete '+(c.company||id)+'?';
  if(n) aviso += '\n\n'+n+' product(s) point to this customer and will be left without one.';
  aviso += '\n\nThis cannot be undone.';
  if(!confirm(aviso)) return;

  var resto = list.filter(function(x){ return x.customerId !== id; });
  saveCustomerList(resto);
  logActivity('admin','Customer deleted', (c.company||id)+(n?' · '+n+' product(s) affected':''),
              currentUser?currentUser.name:'—');
  custOpen = null;
  renderCustomers();
  toast('Customer deleted');
}

// ---- Limpieza: borrar TODOS, o todos menos los que se quieran conservar ----
// Los clientes que llegaron con la importacion arrastran tests que nadie
// marco, y eso enreda cada producto suyo. Esto los quita de una vez; lo que se
// escriba se conserva, separado por comas (nombre o ID, da igual).
function deleteAllCustomers(){
  if(typeof canDeleteRecords === 'function' && !canDeleteRecords()){
    toast('Your role cannot delete'); return;
  }
  var list = getCustomers();
  if(!list.length){ toast('There are no customers'); return; }

  var salvar = prompt(
    'Delete every customer.' + '\n\n' +
    'Type the ones to KEEP, separated by commas (name or ID).' + '\n' +
    'Leave it empty to delete all ' + list.length + '.', '');
  if(salvar === null) return;                       // se arrepintio

  var quedan = String(salvar).split(',').map(function(s){ return s.trim().toLowerCase(); })
    .filter(Boolean);
  var conservar = list.filter(function(c){
    return quedan.some(function(q){
      return String(c.company||'').toLowerCase().indexOf(q) >= 0 ||
             String(c.customerId||'').toLowerCase() === q;
    });
  });
  var fuera = list.length - conservar.length;
  if(!fuera){ toast('Nothing matched — no customer was deleted'); return; }

  var aviso = 'Delete ' + fuera + ' customer(s)?';
  if(conservar.length){
    aviso += '\n\n' + 'Keeping: ' + conservar.map(function(c){ return c.company||c.customerId; }).join(', ');
  }
  aviso += '\n\n' + 'This cannot be undone.';
  if(!confirm(aviso)) return;

  saveCustomerList(conservar);
  logActivity('admin','Customers deleted',
    fuera+' deleted'+(conservar.length ? ' · kept '+conservar.length : '')+' of '+list.length,
    currentUser?currentUser.name:'—');
  custOpen = null;
  renderCustomers();
  toast(fuera+' customer(s) deleted');
}

function exportCustomersCSV(){
  var out = [['Customer','ID','Code','Contact','Email','Phone','Fax','Product','Packaging',
              'Target moisture','Target fat','Target pH','Target yeast','Target mold',
              'Lab tests','Products']];
  getCustomers().forEach(function(c){
    var t = c.targets || {};
    out.push([c.company||'', c.customerId||'', c.code||'', c.contact||'', c.email||'',
              c.phone||'', c.fax||'', c.productName||'', c.packaging||'',
              t.moisture||'', t.fat||'', t.ph||'', t.yeast||'', t.mold||'',
              (c.tests||[]).join(' | '), custProductCount(c)]);
  });
  downloadCSV('customers-'+localDateStr()+'.csv', out);
}
