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

// ===== QUE TESTS LE TOCAN A UN PRODUCTO =====
// Un test se elige al crear el cliente o al crear el producto, y el del
// producto manda sobre el del cliente. Si no se eligio ninguno en ninguno de
// los dos lados, ese producto NO va al laboratorio: no lleva forma.
//
// Los dos lados no guardan igual —el cliente guarda el nombre y el producto
// guarda {sheet, label} para saber en que hoja de la forma va la columna—,
// asi que aqui se dejan como una lista de nombres, que es lo que se enseña.
function labTestName(t){
  return (typeof t === 'string') ? t : ((t && t.label) || '');
}

// "Composite: 2-5 Samples" va guardado junto a los tests del producto, pero no
// es un test: es la casilla de la forma que dice como se manda la muestra. No
// cuenta para decidir si hay que pedirle algo al laboratorio, ni sale como punto.
function labIsComposite(nombre){
  return labNorm(nombre).indexOf('composite') === 0;
}

function labTestsOf(p, c){
  var limpiar = function(lista){
    return (lista || []).map(labTestName).filter(function(x){
      return String(x||'').trim() && !labIsComposite(x);
    });
  };
  var propios = limpiar(p && p.labTests);
  if(propios.length) return propios;
  if(c === undefined) c = (typeof productCustomer==='function') ? productCustomer(p) : null;
  return limpiar(c && c.tests);
}

// Sin esto no hay nada que pedirle al laboratorio
function hasLabTests(p, c){ return labTestsOf(p, c).length > 0; }

// ===== CADA TEST, UN PUNTO DE COLOR =====
// Escribir los nombres completos dentro de la hoja la volvia ilegible: una
// celda con "Listeria Mono, Salmonella, Coliform & E. coli" tapaba el resto de
// la fila. Cada test pasa a ser un punto con su color; el nombre sale al pasar
// el raton por encima, y debajo de la hoja queda la leyenda de los que salen
// en pantalla, que es lo que sirve en el telefono, donde no hay raton.
//
// El color es SIEMPRE el mismo para el mismo test, para que la vista se
// aprenda de memoria. Los que no estan en la lista sacan su color del propio
// nombre, asi que tampoco cambian de un dia para otro.
var LAB_TEST_COLORS = {
  'listeria mono':      '#7c3aed',
  'salmonella':         '#0369a1',
  'coliform & e. coli': '#0e7490',
  'coliform':           '#0e7490',
  'e. coli':            '#0891b2',
  'staph':              '#a16207',
  'apc':                '#4d7c0f',
  'yeast & mold rapid': '#b45309',
  'rapid yeast & mold': '#b45309',
  'yeast & mold':       '#b45309',
  'salt':               '#64748b',
  'sodium':             '#475569',
  'sorbic':             '#9d174d',
  'moisture':           '#0d9488',
  'fat':                '#c2410c',
  'ph':                 '#6d28d9'
};

function labTestColor(nombre){
  var k = labNorm(nombre);
  if(LAB_TEST_COLORS[k]) return LAB_TEST_COLORS[k];
  // Por familia: "listeria mono 25g" sigue siendo listeria
  for(var fam in LAB_TEST_COLORS){
    if(k.indexOf(fam) === 0) return LAB_TEST_COLORS[fam];
  }
  // Y si no, un tono sacado del nombre: distinto para cada test, igual siempre
  var h = 0;
  for(var i = 0; i < k.length; i++) h = ((h * 31) + k.charCodeAt(i)) >>> 0;
  return 'hsl(' + (h % 360) + ' 45% 38%)';
}

// Los puntos de una fila
function testDotsHTML(tests){
  tests = (tests || []).filter(function(t){ return String(t||'').trim(); });
  if(!tests.length) return '<span class="soft">\u2014</span>';
  return '<span class="tdots">' + tests.map(function(t){
    return '<i class="tdot" style="background:' + labTestColor(t) + '" title="' + esc(t) +
           '" role="img" aria-label="' + esc(t) + '" onclick="labDotTap(this)"></i>';
  }).join('') + '</span>';
}

// En el telefono no hay raton: al tocar el punto se dice cual es
function labDotTap(el){
  if(typeof toast === 'function') toast(el.getAttribute('title') || '');
}

// La leyenda de los tests que salen en pantalla, sin repetir
function testsLegendHTML(listas){
  var vistos = {}, orden = [];
  (listas || []).forEach(function(tests){
    (tests || []).forEach(function(t){
      var k = labNorm(t);
      if(!k || vistos[k]) return;
      vistos[k] = 1; orden.push(t);
    });
  });
  if(!orden.length) return '';
  return '<div class="tlegend">' + orden.map(function(t){
    return '<span><i class="tdot" style="background:' + labTestColor(t) + '"></i>' + esc(t) + '</span>';
  }).join('') + '</div>';
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
    var m = map[t];
    if(m){
      var lbl = (hdrs[m.sheet]||{})[m.col];
      if(lbl) out.push({sheet:m.sheet, label:lbl});
      return;
    }
    // Un cliente creado a mano guarda la ETIQUETA EXACTA de su forma, que no
    // esta en el mapa de nombres genericos: se busca tal cual en la forma.
    ['micro','chem','nlea'].forEach(function(kind){
      var col = labTestColumn(form, kind, t);
      if(col && (hdrs[kind]||{})[col]) out.push({sheet:kind, label:hdrs[kind][col]});
    });
  });
  // La casilla de composite, si la forma del cliente la usa
  var cc = ((getDB().labTestMap||{}).compositeCol || {})[form];
  if(cc && c.composite){
    var cl = (hdrs.micro||{})[cc];
    if(cl) out.push({sheet:'micro', label:cl});
  }
  return out;
}

// Tests que ofrece UNA forma, para elegirlos al crear el cliente
function formTestCatalog(form){
  var hdrs = getFormHeaders()[form] || {};
  var out = {micro:[], chem:[], nlea:[]};
  Object.keys(out).forEach(function(kind){
    var cols = hdrs[kind] || {};
    Object.keys(cols).forEach(function(c){ if(cols[c]) out[kind].push(cols[c]); });
    out[kind].sort();
  });
  return out;
}

function productTestsVerified(p){ return !!(p && p.labTests && p.labTests.length); }

// ---- Editor (dentro de la ficha del producto en el catálogo) ----
function renderLabTestPicker(p){
  p = p || {};
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
function readLabTestPicker(p, root){
  var boxes = (root || document).querySelectorAll('[data-lt-kind]');
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
