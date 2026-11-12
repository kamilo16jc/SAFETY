// ===== CAMBIAR EL NUMERO (O LA LETRA) DE UNA MUESTRA YA GUARDADA =====
// Pedido del usuario (11 nov 2026): en Sample Analysis el # y en Raw Analysis
// la letra se corrigen en la misma fila guardada. Si el 2 pasa a ser el 3, las
// muestras que se capturaron DESPUES siguen la cuenta desde ahi: 4, 5, 6...
// En RAW igual con letras: si la J pasa a K, las que siguen son L, M, N... y
// despues de la Z vuelve la A.
//
// "Despues" es el orden de captura, el mismo con que se reparten los numeros
// (nextAnalysisSeq / nextSampleLetter), no el orden de la tabla. En Sample
// Analysis cada dia empieza en 1: solo se mueven las del MISMO DIA (la v166
// contaba por año y al corregir una de ayer movio las de hoy).
//
// Si el cambio mueve otras muestras (o repite un numero) se pregunta primero y
// se muestra que va a cambiar; tambien se puede cambiar solo esa. Cada cambio
// queda en el rastro de la muestra (changes) sin marcar el COA como cambiado:
// el certificado no lleva este numero.

var RN = null;   // la pregunta abierta

// ---------- Sample Analysis: el # ----------
function anCapturaOrden(list){
  return list.slice().sort(function(a, b){
    var ka = String(a.createdAt||''), kb = String(b.createdAt||'');
    return ka < kb ? -1 : ka > kb ? 1 : ((+a.id||0) - (+b.id||0));
  });
}

function anSeqEdit(id, el){
  var a = getAnalyses().filter(function(x){ return x.id === id; })[0];
  if(!a) return;
  var antes = +a.seq || 0;
  var txt = String(el.value).trim(), n = parseInt(txt, 10);
  el.value = antes || '';                 // hasta que se confirme, se ve el de antes
  if(!txt) return;
  if(!(n > 0) || String(n) !== txt){ toast('Write a whole number, like 12'); return; }
  if(n === antes) return;

  var dia = String(a.date||'').slice(0, 10);
  var orden = anCapturaOrden(getAnalyses().filter(function(x){ return x.stockOf == null && String(x.date||'').slice(0, 10) === dia; }));
  var pos = orden.indexOf(a);
  var previos = orden.slice(0, pos);
  var cambios = [], k = n;
  orden.slice(pos + 1).forEach(function(x){
    if(!(+x.seq > 0)) return;             // sin numero: no entra en la cuenta
    k++;
    if(+x.seq !== k) cambios.push({id:x.id, rec:x, de:+x.seq, a:k});
  });

  // numeros que ya tienen muestras capturadas antes (esas no se tocan)
  var usados = {};
  previos.forEach(function(x){ if(+x.seq > 0 && !usados[+x.seq]) usados[+x.seq] = x; });
  var choques = [n].concat(cambios.map(function(c){ return c.a; })).filter(function(v){ return usados[v]; });
  // cambiando solo esta: tambien puede repetir el de una que va despues
  var repiteSolo = !!usados[n] || orden.slice(pos + 1).some(function(x){ return +x.seq === n; });

  rnPreguntar({
    titulo: 'Analysis #'+antes+' → #'+n,
    et: function(v){ return '#'+v; },
    de: antes, nuevo: n, id: a.id, rec: a, cambios: cambios,
    queEs: function(r){ return [fmtDate(r.date), r.product, r.cheese].filter(Boolean).join(' · '); },
    coa: [a].concat(cambios.map(function(c){ return c.rec; })).filter(function(r){ return r.coaNo; }).length,
    choques: choques.map(function(v){ return {v:v, rec:usados[v]}; }),
    repiteSolo: repiteSolo,
    aplicar: anRenumerar
  });
}

function anRenumerar(lista){
  var db = getDB(), ahora = localISOStr(), quien = currentUser ? currentUser.name : '—';
  var porId = {};
  (db.analysis||[]).forEach(function(x){ porId[x.id] = x; });
  var hechos = [];
  lista.forEach(function(c){
    var a = porId[c.id];
    if(!a || +a.seq === c.a) return;
    rnRastro(a, 'seq', a.seq, c.a, ahora, quien);
    a.seq = c.a;
    a.editedAt = ahora; a.editedBy = quien;
    hechos.push(a);
  });
  if(!hechos.length) return;
  saveDB(db, 'analysis');
  if(window.saveToFirebase) hechos.forEach(function(a){ window.saveToFirebase('analysis', a); });
  if(typeof stockSync === 'function') hechos.forEach(function(a){ stockSync(a); });
  var p = lista[0];
  if(typeof logActivity === 'function')
    logActivity('analysis', 'Analysis number changed', '#'+p.de+' → #'+p.a+
      (hechos.length > 1 ? ' (+'+(hechos.length-1)+' after it)' : ''), quien);
  if(typeof renderAnalysisRows === 'function') renderAnalysisRows();
  if(typeof anSuggestSeq === 'function') anSuggestSeq();   // la fila nueva sigue a la ultima
  if(typeof refreshRunViews === 'function') refreshRunViews();
  toast(hechos.length > 1 ? hechos.length+' analyses renumbered from #'+p.a : 'Analysis #'+p.a+' saved');
}

// ---------- Raw Analysis: la letra ----------
function rawLetraMas(L, k){
  var i = String(L).toUpperCase().charCodeAt(0) - 65;
  return String.fromCharCode(65 + (((i + k) % 26) + 26) % 26);
}

function rawLetterEdit(id, el){
  var r = getRawRecords().filter(function(x){ return x.id === id; })[0];
  if(!r) return;
  var antes = String(r.sample==null ? '' : r.sample).trim().toUpperCase();
  var L = String(el.value).trim().toUpperCase();
  el.value = r.sample || '';
  if(!L) return;
  if(!/^[A-Z]$/.test(L)){ toast('Write one letter, A to Z'); return; }
  if(L === antes) return;

  var orden = xlEntryOrder(getRawRecords().filter(function(x){ return x && x.section === 'raw'; }));
  var pos = orden.indexOf(r);
  var previos = orden.slice(0, pos);
  var cambios = [], k = L;
  orden.slice(pos + 1).forEach(function(x){
    if(!rawLetterAfter(x.sample)) return;   // lo que no es una letra no entra en la cuenta
    k = rawLetterAfter(k);
    if(String(x.sample).trim().toUpperCase() !== k) cambios.push({id:x.id, rec:x, de:String(x.sample).trim().toUpperCase(), a:k});
  });

  // la misma letra el mismo dia en una muestra de antes
  var dia = function(x){ return String(x.date||'').slice(0, 10); };
  var usada = function(rec, letra){
    return previos.filter(function(x){ return dia(x) === dia(rec) && String(x.sample||'').trim().toUpperCase() === letra; })[0];
  };
  var choques = [];
  [{rec:r, a:L}].concat(cambios).forEach(function(c){
    var u = usada(c.rec, c.a);
    if(u) choques.push({v:c.a, rec:u});
  });
  var repiteSolo = !!usada(r, L) || orden.slice(pos + 1).some(function(x){
    return dia(x) === dia(r) && String(x.sample||'').trim().toUpperCase() === L;
  });

  rnPreguntar({
    titulo: 'Sample '+(antes || '—')+' → '+L,
    et: function(v){ return v; },
    de: antes, nuevo: L, id: r.id, rec: r, cambios: cambios,
    queEs: function(x){ return [fmtDate(x.date), x.material, x.code].filter(Boolean).join(' · '); },
    coa: 0,
    choques: choques,
    repiteSolo: repiteSolo,
    aplicar: rawRenumerar
  });
}

function rawRenumerar(lista){
  var db = getDB(), ahora = localISOStr(), quien = currentUser ? currentUser.name : '—';
  var sugerida = (typeof nextSampleLetter === 'function') ? nextSampleLetter() : '';
  var porId = {};
  (db.raw||[]).forEach(function(x){ porId[x.id] = x; });
  var hechos = [];
  lista.forEach(function(c){
    var r = porId[c.id];
    if(!r || r.sample === c.a) return;
    rnRastro(r, 'sample', r.sample, c.a, ahora, quien);
    r.sample = c.a;
    r.editedAt = ahora; r.editedBy = quien;
    hechos.push(r);
  });
  if(!hechos.length) return;
  saveDB(db, 'raw');
  if(window.saveToFirebase) hechos.forEach(function(r){ window.saveToFirebase('raw', r); });
  var p = lista[0];
  if(typeof logActivity === 'function')
    logActivity('analysis', 'Raw sample letter changed', p.de+' → '+p.a+
      (hechos.length > 1 ? ' (+'+(hechos.length-1)+' after it)' : ''), quien);
  if(typeof renderRawRows === 'function') renderRawRows();
  // la fila nueva: si tenia la letra propuesta, propone la nueva
  var n = document.getElementById('rw-n-sample');
  if(n && rawSection === 'raw' && String(n.value).trim().toUpperCase() === sugerida) n.value = nextSampleLetter();
  toast(hechos.length > 1 ? hechos.length+' samples renamed from '+p.a : 'Sample '+p.a+' saved');
}

// ---------- Comun ----------
function rnRastro(rec, campo, de, a, ahora, quien){
  if(!rec.changes) rec.changes = [];
  rec.changes.push({at:ahora, by:quien, field:campo, from:String(de==null ? '' : de), to:String(a), afterCoa:false});
  if(rec.changes.length > 60) rec.changes = rec.changes.slice(-60);
}

// Pregunta solo si hace falta: si nada mas cambia y no se repite, se guarda y ya
function rnPreguntar(q){
  var uno = {id:q.id, de:q.de, a:q.nuevo};
  if(!q.cambios.length && !q.repiteSolo){ q.aplicar([uno]); return; }
  RN = q;
  var MAX = 6, body = '<div class="rn-ask">';
  if(q.cambios.length){
    body += '<p class="rn-lead">'+(q.cambios.length === 1
      ? 'The sample entered after it follows the count:'
      : 'The <b>'+q.cambios.length+'</b> samples entered after it follow the count:')+'</p>'+
      '<ul class="rn-list">'+q.cambios.slice(0, MAX).map(function(c){
        return '<li><span class="rn-de">'+esc(q.et(c.de))+'</span><span class="rn-fl" aria-hidden="true">→</span>'+
          '<b class="rn-a">'+esc(q.et(c.a))+'</b><span class="rn-que">'+esc(q.queEs(c.rec))+'</span></li>';
      }).join('')+'</ul>';
    if(q.cambios.length > MAX)
      body += '<p class="rn-mas">… and '+(q.cambios.length - MAX)+' more, up to '+
        esc(q.et(q.cambios[q.cambios.length - 1].a))+'</p>';
  }
  if(q.coa)
    body += '<p class="rn-nota">'+(q.coa === 1 ? 'One of them already has' : q.coa+' of them already have')+
      ' a COA. The COA does not show this number, so it stays as it is.</p>';
  if(q.choques.length){
    var ej = q.choques.slice(0, 3).map(function(c){ return esc(q.et(c.v))+' ('+esc(fmtDate(c.rec.date))+')'; }).join(', ');
    body += '<p class="rn-nota warn">'+(q.choques.length === 1 ? ej+' is' : ej+(q.choques.length > 3 ? '…' : '')+' are')+
      ' already used that day by a sample entered before. That one is not changed.</p>';
  } else if(!q.cambios.length && q.repiteSolo){
    body += '<p class="rn-nota warn">'+esc(q.et(q.nuevo))+' is already used by another sample that day.</p>';
  }
  body += '</div>';
  var acts = q.cambios.length
    ? '<button class="btn-solid" id="rn-todos" onclick="rnAplicar(true)">Change '+(q.cambios.length + 1)+' samples</button>'+
      '<button class="btn-ghost" onclick="rnAplicar(false)">Only this one</button>'
    : '<button class="btn-solid" id="rn-todos" onclick="rnAplicar(false)">Change it</button>';
  acts += '<button class="btn-ghost" onclick="rnCancelar()">Cancel</button>';
  openRecordModal(esc(q.titulo), body, acts);
  setTimeout(function(){ var b = document.getElementById('rn-todos'); if(b) b.focus(); }, 30);
}

function rnAplicar(todos){
  var q = RN; RN = null;
  if(typeof closeRecordModal === 'function') closeRecordModal();
  if(!q) return;
  q.aplicar([{id:q.id, de:q.de, a:q.nuevo}].concat(todos ? q.cambios.map(function(c){
    return {id:c.id, de:c.de, a:c.a};
  }) : []));
}
function rnCancelar(){
  RN = null;
  if(typeof closeRecordModal === 'function') closeRecordModal();
}
