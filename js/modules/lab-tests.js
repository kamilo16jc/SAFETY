// ===== TESTS DE LABORATORIO POR PRODUCTO =====
// El test se guarda con su ETIQUETA EXACTA tal como aparece en la forma, y no
// con un nombre genérico: las variantes de gramaje y de método son pruebas
// distintas. Al generar la forma la etiqueta se resuelve a columna.
//
// Se pre-cargan por defecto según lo que ya sabemos del cliente, pero se pueden
// corregir producto por producto; queda la fecha de actualización.

function getFormHeaders(){ var d=getDB(); return d.labFormHeaders || {}; }

// Normaliza para comparar etiquetas sin que un acento o espacio rompa el match
function labNorm(s){
  return String(s||'').replace(/\s+/g,' ').trim().toLowerCase()
    .replace(/[^a-z0-9&().,/ -]/g,'');
}

// Catálogo de tests disponibles: unión de todas las formas, por hoja
function labTestCatalog(){
  var forms = getFormHeaders(), seen = {}, out = {micro:[], chem:[], nlea:[]};
  Object.keys(forms).forEach(function(f){
    Object.keys(forms[f]).forEach(function(kind){
      if(!out[kind]) out[kind] = [];
      Object.keys(forms[f][kind]).forEach(function(col){
        var lbl = forms[f][kind][col];
        var k = kind+'|'+labNorm(lbl);
        if(seen[k]) return;
        seen[k] = 1;
        out[kind].push(lbl);
      });
    });
  });
  Object.keys(out).forEach(function(k){ out[k].sort(); });
  return out;
}

// ¿En qué formas existe esta etiqueta? (para avisar si el cliente no la tiene)
function labTestForms(kind, label){
  var forms = getFormHeaders(), n = labNorm(label), hit = [];
  Object.keys(forms).forEach(function(f){
    var cols = (forms[f]||{})[kind] || {};
    if(Object.keys(cols).some(function(c){ return labNorm(cols[c])===n; })) hit.push(f);
  });
  return hit;
}

// Columna de una etiqueta dentro de una forma concreta
function labTestColumn(form, kind, label){
  var cols = ((getFormHeaders()[form])||{})[kind] || {};
  var n = labNorm(label);
  var found = null;
  Object.keys(cols).forEach(function(c){ if(!found && labNorm(cols[c])===n) found = c; });
  return found;
}

// ---- Tests de un producto ----
// Si nunca se han definido, se proponen por defecto desde los tests genéricos
// del cliente traducidos a la etiqueta de SU forma (provisional, hay que revisar).
function productTests(p){
  if(p && p.labTests && p.labTests.length) return p.labTests;
  return defaultLabTests(p);
}

function defaultLabTests(p){
  var c = (typeof productCustomer==='function') ? productCustomer(p) : null;
  if(!c) return [];
  var form = c.form || 'general';
  var map  = ((getDB().labTestMap||{}).map || {})[form] || {};
  var hdrs = getFormHeaders()[form] || {};
  var out = [];
  (c.tests||[]).forEach(function(t){
    var m = map[t]; if(!m) return;
    var lbl = (hdrs[m.sheet]||{})[m.col];
    if(lbl) out.push({sheet:m.sheet, label:lbl});
  });
  // La casilla de composite, si la forma del cliente la usa
  var cc = ((getDB().labTestMap||{}).compositeCol || {})[form];
  if(cc && c.composite){
    var cl = (hdrs.micro||{})[cc];
    if(cl) out.push({sheet:'micro', label:cl});
  }
  return out;
}

function productTestsVerified(p){ return !!(p && p.labTests && p.labTests.length); }

// ---- Editor (dentro de la ficha del producto en el catálogo) ----
function renderLabTestPicker(p){
  var cat = labTestCatalog();
  if(!Object.keys(cat).some(function(k){ return cat[k].length; })) return '';
  var cur = productTests(p);
  var has = function(kind,label){
    return cur.some(function(t){ return t.sheet===kind && labNorm(t.label)===labNorm(label); });
  };
  var c = (typeof productCustomer==='function') ? productCustomer(p) : null;
  var form = c ? (c.form||'general') : null;

  var block = function(kind, title){
    if(!cat[kind] || !cat[kind].length) return '';
    return '<div class="lt-group"><div class="lt-title">'+title+'</div>'+
      cat[kind].map(function(lbl){
        // Marca si la forma del cliente NO tiene esa columna
        var inForm = !form || !!labTestColumn(form, kind, lbl);
        return '<label class="lt-item'+(inForm?'':' off')+'">'+
          '<input type="checkbox" data-lt-kind="'+kind+'" data-lt-label="'+esc(lbl)+'"'+
            (has(kind,lbl)?' checked':'')+'>'+
          '<span>'+esc(lbl)+(inForm?'':' <em>· not on this form</em>')+'</span></label>';
      }).join('')+'</div>';
  };

  var upd = p.labTestsAt
    ? 'Updated '+fmtDate(p.labTestsAt)+(p.labTestsBy?' by '+esc(p.labTestsBy):'')
    : 'Not verified yet — these are the defaults from the customer';

  return '<div class="field-group"><div class="sec-label">Lab tests '+
      '<span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:500">· exact test on the form</span></div>'+
    '<div class="lt-status'+(productTestsVerified(p)?' ok':'')+'">'+upd+'</div>'+
    '<div class="lt-box">'+block('micro','Micro')+block('chem','Chemistry')+block('nlea','NLEA')+'</div>'+
  '</div>';
}

// Lee el picker y guarda en el producto (lo llama saveCatalogEdits)
function readLabTestPicker(p){
  var boxes = document.querySelectorAll('[data-lt-kind]');
  if(!boxes.length) return false;
  var sel = [];
  Array.prototype.forEach.call(boxes, function(b){
    if(b.checked) sel.push({sheet:b.getAttribute('data-lt-kind'), label:b.getAttribute('data-lt-label')});
  });
  var before = JSON.stringify(productTests(p));
  if(JSON.stringify(sel)===before && productTestsVerified(p)) return false;   // sin cambios
  p.labTests   = sel;
  p.labTestsAt = localISOStr();
  p.labTestsBy = currentUser ? currentUser.name : '—';
  return true;
}
