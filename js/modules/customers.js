// ===== CLIENTES =====
// Hasta ahora un cliente solo se podia crear —desde la ficha de un producto— y
// nunca mas se le podia mirar ni corregir. Con el certificado de por medio eso
// dejo de valer: de aqui salen el telefono, el fax, el contacto y el correo que
// imprime el COA, y tambien los tests del laboratorio.
//
// Un cliente compra muchas referencias, asi que aqui no va ningun producto: el
// nombre y el empaque salen de cada producto. Los tests si son del cliente:
// todas sus referencias llevan los mismos al laboratorio.
//
// Esta pantalla es ese sitio: ver, corregir y borrar.

var custQuery = '', custOpen = null, custNuevo = false;

function initCustomers(){
  custOpen = null;
  custNuevo = false;
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
    if(p.customerId === custKey(c)) { n++; return; }
    if((p.customerIds||[]).indexOf(custKey(c)) >= 0) { n++; return; }
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

// Buscar es una orden: corre con la lupa o con Enter, no mientras se escribe
function runCustSearch(){
  var q = document.getElementById('cu-search');
  custQuery = String(q ? q.value : '').trim().toLowerCase();
  renderCustomers();
}
function custSearchKey(e){ if(e.key==='Enter'){ e.preventDefault(); runCustSearch(); } }

// Va al laboratorio externo? Los clientes de antes no lo tienen escrito: se
// deduce de lo que ya traen (tests marcados o prefijo de la forma).
function custGoesToLab(c){
  if(!c) return false;
  if(c.lab != null) return !!c.lab;
  return (c.tests||[]).length > 0 || !!c.prefix;
}
function custLabToggle(on){
  var box = document.getElementById('cu-lab-box');
  if(box) box.hidden = !on;
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

  // El alta va arriba del todo: se abre, se llena y se guarda sin perder de
  // vista la lista de los que ya hay.
  var alta = custNuevo ? '<div class="cu-alta">'+custEditorHTML({}, true)+'</div>' : '';

  if(!list.length){
    host.innerHTML = alta + '<div class="sheet-empty">'+
      (todos.length ? 'No customer matches that search.'
                    : 'No customers yet. Create the first one with New customer.')+
      '</div>';
    renderIcons(host);
    return;
  }

  host.innerHTML = alta +
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Customer</th><th>ID</th><th>Contact</th><th>Phone</th>'+
      '<th class="num">Products</th><th>Lab tests</th><th></th><th></th>'+
    '</tr></thead><tbody>'+
    list.map(function(c, i){
      var tests = custGoesToLab(c) ? (c.tests||[]).length : 0;
      var k = custKey(c);        // la llave: el ID puede repetirse
      return '<tr'+(custOpen===k?' class="done"':'')+'>'+
        '<td class="rn">'+(i+1)+'</td>'+
        '<td class="wide"><b>'+esc(c.company||'—')+'</b></td>'+
        '<td class="code">'+esc(c.customerId||'—')+'</td>'+
        '<td class="soft">'+esc(c.contact||'—')+'</td>'+
        '<td class="soft">'+esc(c.phone||'—')+'</td>'+
        '<td class="num">'+custProductCount(c)+'</td>'+
        '<td>'+(tests
          ? '<span class="pill warn" title="'+esc((c.tests||[]).join(' · '))+'">'+tests+'</span>'
          : '<span class="soft">—</span>')+'</td>'+
        '<td><button class="sheet-btn" onclick="editCustomer(\''+esc(k)+'\')">Edit</button></td>'+
        '<td><button class="run-del" title="Delete customer" '+
          'onclick="deleteCustomer(\''+esc(k)+'\')">×</button></td>'+
      '</tr>'+
      (custOpen===k ? '<tr><td colspan="9">'+custEditorHTML(c)+'</td></tr>' : '');
    }).join('')+
    '</tbody></table></div>';
  renderIcons(host);
}

// ---- El editor: los mismos campos que pide el certificado ----
function custEditorHTML(c, nuevo){
  c = c || {};
  var v = function(x){ return esc(x==null?'':x); };
  var campo = function(f, rot, val){
    return '<div class="sb-field"><label for="cu-'+f+'">'+rot+'</label>'+
      '<input type="text" class="field" id="cu-'+f+'" value="'+v(val)+'"></div>';
  };
  var vaLab = custGoesToLab(c);
  return '<div class="cu-edit">'+
    (nuevo ? '<div class="sub-label">New customer</div>' : '')+
    '<div class="sheet-bar">'+
      campo('company','Customer name', c.company)+
      campo('id','Customer ID', c.customerId)+
    '</div>'+
    '<div class="sheet-bar">'+
      campo('contact','Contact', c.contact)+
      campo('email','Email', c.email)+
      campo('phone','Phone', c.phone)+
      campo('fax','Fax', c.fax)+
      campo('code','Customer code', c.code)+
    '</div>'+
    // El formato del LOT de sus productos: Caputo (YYDDD) o dia primero
    // (DDDYY). Weights y Seal Bags ponen el del dia segun esto.
    '<div class="sub-label">LOT number</div>'+
    '<div class="sheet-bar">'+
      '<div class="sb-field"><label for="cu-lotfmt">LOT format of its products</label>'+
        '<div class="select-wrap"><select class="field" id="cu-lotfmt">'+
          '<option value=""'+(c.lotFormat==='dddyy'?'':' selected')+'>Caputo · YYDDD (today '+
            (typeof lotCodigo==='function' ? lotCodigo(localDateStr(),'yyddd') : '')+')</option>'+
          '<option value="dddyy"'+(c.lotFormat==='dddyy'?' selected':'')+'>Day first · DDDYY (today '+
            (typeof lotCodigo==='function' ? lotCodigo(localDateStr(),'dddyy') : '')+')</option>'+
        '</select></div></div>'+
    '</div>'+
    // Primero la pregunta: van sus muestras al laboratorio? Solo si van se
    // piden la forma y los tests.
    '<div class="sub-label">Laboratory</div>'+
    '<div class="sheet-bar">'+
      '<label class="lab-check cu-lab-ask"><input type="checkbox" id="cu-lab"'+(vaLab?' checked':'')+
        ' onchange="custLabToggle(this.checked)">'+
        '<span><b>Samples go to the external lab</b><br>'+
        'Every product of this customer is sent with the same tests.</span></label>'+
    '</div>'+
    '<div id="cu-lab-box"'+(vaLab?'':' hidden')+'>'+
      // La forma del laboratorio y su prefijo arman el codigo de la muestra.
      '<div class="sub-label">Lab form</div>'+
      '<div class="sheet-bar">'+
        campo('prefix','Form prefix', c.prefix)+
        '<div class="sb-field"><label for="cu-form">Form</label>'+
          '<div class="select-wrap"><select class="field" id="cu-form">'+
          ((typeof customerFormOptions==='function')
            ? customerFormOptions(c.form || 'general')
            : '<option value="general">general</option>')+
          '</select></div></div>'+
      '</div>'+
      '<div class="sub-label">Lab tests</div>'+
      custTestsHTML(c)+
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
    '<div class="sheet-actions">'+
      saveBtn(nuevo ? 'createCustomer(this)'
                    : 'saveCustomerEdit(\''+esc(custKey(c))+'\',this)',
              {texto:(nuevo ? 'Create customer' : 'Save'),
               hecho:(nuevo ? 'Created' : 'Saved'), grande:true})+
      '<button class="btn-ghost" onclick="'+(nuevo?'cancelNewCustomer()':'closeCustomer()')+'">Cancel</button>'+
    '</div>'+
  '</div>';
}

function newCustomer(){
  custNuevo = true;
  custOpen  = null;
  renderCustomers();
  var e = document.getElementById('cu-company');
  if(e){ e.focus(); e.scrollIntoView({block:'center'}); }
}
function cancelNewCustomer(){ custNuevo = false; renderCustomers(); }

// Alta: los mismos campos del editor, para no tener dos formularios que se
// separen con el tiempo. El ID SI puede repetirse (varios clientes comparten
// codigo): cada cliente nace con su propia llave, uid.
function createCustomer(btn){
  var g = function(f){ var e = document.getElementById('cu-'+f); return e ? e.value.trim() : ''; };
  var company = g('company');
  var id = g('id').toUpperCase();
  if(!company){ toast('Enter the customer name'); return; }
  if(!id){ toast('Enter the customer ID'); return; }
  var list = getCustomers();
  var mismos = list.filter(function(x){ return x.customerId === id; }).length;

  var per = document.getElementById('cu-per');
  var num = document.getElementById('cu-numbered');
  var lab = custLabRead();

  var uid = newCustUid();
  list.push({
    uid: uid,
    customerId: id,
    company: company,
    contact: g('contact'),
    email: g('email'),
    phone: g('phone'),
    fax: g('fax'),
    code: g('code').toUpperCase(),
    prefix: g('prefix').toUpperCase(),
    form: g('form') || 'general',
    samplesPerOrder: per ? Math.max(1, parseInt(per.value, 10) || 1) : 1,
    numbered: num ? !!num.checked : false,
    lotFormat: ((document.getElementById('cu-lotfmt')||{}).value === 'dddyy') ? 'dddyy' : '',
    lab: lab.lab,
    tests: lab.tests,
    targets: {},
    createdBy: currentUser ? currentUser.name : '—',
    createdAt: localISOStr()
  });
  saveCustomerList(list);
  logActivity('admin','Customer created', company+' ('+id+')',
              currentUser?currentUser.name:'—');
  custNuevo = false;
  custOpen  = uid;
  flashSaved(btn);
  renderCustomers();
  toast(company+' created'+(mismos ? ' · ID '+id+' is shared' : ''));
}

function editCustomer(id){
  custOpen = (custOpen === id) ? null : id;
  custNuevo = false;        // un solo editor abierto: los dos usan los mismos campos
  renderCustomers();
}

// Lo que dice el editor del laboratorio. Si no va, el cliente queda sin tests:
// asi ninguno de sus productos hereda nada que no se va a mandar.
function custLabRead(){
  var chk = document.getElementById('cu-lab');
  var va = chk ? !!chk.checked : false;
  var tests = [];
  if(va){
    Array.prototype.forEach.call(document.querySelectorAll('#cu-lab-box .cu-test:checked'), function(b){
      tests.push(b.getAttribute('data-lt-label'));
    });
  }
  return {lab: va, tests: tests};
}
function closeCustomer(){ custOpen = null; renderCustomers(); }

function saveCustomerEdit(id, btn){
  var list = getCustomers();
  var c = list.filter(function(x){ return custKey(x) === id; })[0];
  if(!c) return;
  var g = function(f){ var e = document.getElementById('cu-'+f); return e ? e.value.trim() : ''; };

  var nuevoId = g('id').toUpperCase();
  if(!g('company')){ toast('Enter the customer name'); return; }
  if(!nuevoId){ toast('Enter the customer ID'); return; }
  // El ID puede repetirse. Un cliente de antes no tiene uid: su llave es su ID
  // de siempre, y se queda fija aunque el ID cambie, asi sus productos (que
  // apuntan a la llave) lo siguen encontrando.
  if(!c.uid) c.uid = id;

  c.company     = g('company');
  c.customerId  = nuevoId;
  // El producto y su empaque ya no son del cliente (compra varias
  // referencias): lo que quedaba guardado de antes se va al guardar.
  delete c.productName;
  delete c.packaging;
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
  var pf = document.getElementById('cu-prefix');
  if(pf) c.prefix = pf.value.trim().toUpperCase();
  var fm = document.getElementById('cu-form');
  if(fm) c.form = fm.value || 'general';
  var per = document.getElementById('cu-per');
  if(per) c.samplesPerOrder = Math.max(1, parseInt(per.value, 10) || 1);
  var num = document.getElementById('cu-numbered');
  if(num) c.numbered = !!num.checked;
  var lf = document.getElementById('cu-lotfmt');
  if(lf){ if(lf.value === 'dddyy') c.lotFormat = 'dddyy'; else delete c.lotFormat; }
  // Sin catalogo cargado no hay casillas: los tests que ya tenia se conservan
  if(document.getElementById('cu-lab')){
    var lab = custLabRead();
    c.lab = lab.lab;
    if(!lab.lab) c.tests = [];
    else if(document.querySelector('#cu-lab-box .cu-test')) c.tests = lab.tests;
  }
  c.updatedBy   = currentUser ? currentUser.name : '—';
  c.updatedAt   = localISOStr();

  // Cambiar el ID ya no deja productos huerfanos: apuntan a la llave, que no
  // cambia. (Antes se reapuntaban, y con IDs repetidos eso movia tambien los
  // productos del otro cliente.)

  saveCustomerList(list);
  logActivity('admin','Customer updated', c.company+' ('+c.customerId+')',
              currentUser?currentUser.name:'—');
  custOpen = null;
  flashSaved(btn);
  renderCustomers();
  toast('Customer saved');
}

// ===== LOS TESTS DEL CLIENTE =====
// Los tests van por cliente: si compra diez referencias, las diez llevan los
// mismos al laboratorio. Se muestran todos los del catalogo, a la vista, para
// marcar los suyos; se guardan por nombre, que es como el cliente los tiene.
function custTestsHTML(c){
  var cat = (typeof labTestCatalog === 'function') ? labTestCatalog() : {};
  var hay = Object.keys(cat).some(function(k){ return (cat[k] || []).length; });
  if(!hay) return '<div class="hint">No lab test catalog loaded yet: the tests come from the lab forms.</div>';
  var puestos = (c.tests || []).map(function(t){ return labNorm(labTestName(t)); });
  var enCatalogo = {};
  var item = function(lbl, marcada){
    return '<label class="lt-item"><input type="checkbox" class="cu-test" '+
      'data-lt-label="'+esc(lbl)+'"'+(marcada?' checked':'')+' onchange="custTestsCount()">'+
      '<span>'+esc(lbl)+'</span></label>';
  };
  var grupo = function(kind, titulo){
    if(!(cat[kind] || []).length) return '';
    return '<div class="lt-group"><div class="lt-title">'+titulo+'</div><div class="cu-tlist">'+
      cat[kind].map(function(lbl){
        enCatalogo[labNorm(lbl)] = 1;
        return item(lbl, puestos.indexOf(labNorm(lbl)) >= 0);
      }).join('')+'</div></div>';
  };
  var html = grupo('micro','Micro')+grupo('chem','Chemistry')+grupo('nlea','NLEA');
  // Lo que el cliente ya traia y el catalogo no tiene se muestra aparte y
  // marcado: si no, guardar lo borraba sin que nadie lo viera.
  var sueltos = (c.tests || []).filter(function(t){ return !enCatalogo[labNorm(labTestName(t))]; });
  if(sueltos.length){
    html += '<div class="lt-group"><div class="lt-title">Other · not in the lab forms</div><div class="cu-tlist">'+
      sueltos.map(function(t){ return item(labTestName(t), true); }).join('')+'</div></div>';
  }
  return '<div class="cu-tests">'+html+'</div>'+
    '<div class="cu-tests-foot"><span class="lt-count" id="cu-test-count">'+
      custTestsLabel((c.tests || []).length)+'</span></div>';
}
function custTestsLabel(n){ return n ? (n + ' test' + (n===1?'':'s') + ' selected') : 'No tests selected'; }
function custTestsCount(){
  var n = document.querySelectorAll('#cu-lab-box .cu-test:checked').length;
  var e = document.getElementById('cu-test-count'); if(e) e.textContent = custTestsLabel(n);
}

function deleteCustomer(id){
  var list = getCustomers();
  var c = list.filter(function(x){ return custKey(x) === id; })[0];
  if(!c) return;
  if(typeof canDeleteRecords === 'function' && !canDeleteRecords()){
    toast('Your role cannot delete'); return;
  }
  var n = custProductCount(c);
  var aviso = 'Delete '+(c.company||id)+'?';
  if(n) aviso += '\n\n'+n+' product(s) point to this customer and will be left without one.';
  aviso += '\n\nThis cannot be undone.';
  if(!confirm(aviso)) return;

  // Solo este cliente, aunque otro comparta su ID
  var resto = list.filter(function(x){ return custKey(x) !== id; });
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
  var out = [['Customer','ID','Code','Contact','Email','Phone','Fax',
              'Target moisture','Target fat','Target pH','Target yeast','Target mold',
              'External lab','Lab tests','Products']];
  getCustomers().forEach(function(c){
    var t = c.targets || {};
    var lab = custGoesToLab(c);
    out.push([c.company||'', c.customerId||'', c.code||'', c.contact||'', c.email||'',
              c.phone||'', c.fax||'',
              t.moisture||'', t.fat||'', t.ph||'', t.yeast||'', t.mold||'',
              lab ? 'Yes' : 'No', lab ? (c.tests||[]).join(' | ') : '', custProductCount(c)]);
  });
  downloadCSV('customers-'+localDateStr()+'.csv', out);
}
