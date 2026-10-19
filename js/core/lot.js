// ===== EL LOT DEL DIA =====
// El LOT es la fecha juliana de produccion, y hay dos formatos:
//  - Caputo (todos los productos)          YYDDD: 19 oct 2026 = 26292, el dia
//    siguiente 26293... y el 1 de enero vuelve a empezar: 27001.
//  - Los clientes con "LOT format: day first"  DDDYY: 19 oct 2026 = 29226.
// Quien usa el segundo se marca en Customers (lotFormat 'dddyy'); el nombre
// del cliente no va en el codigo, el repositorio es publico.
// "Next day": produccion a veces adelanta producto del dia siguiente y le pone
// el LOT de ese dia.
// El dia de produccion: el 2o turno trabaja hasta las 2:00 AM con el LOT del
// dia en que empezo.
//
// En Weights y Seal Bags el campo LOT ya trae el del dia segun el cliente del
// producto, y al lado un selector con las cuatro opciones y el calendario.
// Se puede escribir a mano igual.

function lotIso(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function lotFecha(iso){
  var p = String(iso||'').slice(0,10).split('-');
  return (p.length===3 && +p[0]) ? new Date(+p[0], +p[1]-1, +p[2], 12) : new Date();
}
function lotMasDias(iso, n){ var d = lotFecha(iso); d.setDate(d.getDate()+n); return lotIso(d); }
function lotDiaDelAno(d){
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) -
                     new Date(d.getFullYear(), 0, 1, 12)) / 864e5) + 1;
}
function lotCodigo(iso, fmt){
  var d = lotFecha(iso);
  var yy = String(d.getFullYear()).slice(-2), ddd = String(lotDiaDelAno(d)).padStart(3,'0');
  return fmt === 'dddyy' ? ddd+yy : yy+ddd;
}

// ---- Formato segun el cliente ----
function lotFormatoDe(c){ return (c && c.lotFormat === 'dddyy') ? 'dddyy' : 'yyddd'; }
function lotFormatoProducto(p){
  var c = (p && typeof productCustomer === 'function') ? productCustomer(p) : null;
  return lotFormatoDe(c);
}
// El nombre que se ve para el formato DDDYY: el del cliente que lo usa
function lotNombreDddyy(){
  var cs = (typeof getCustomers === 'function') ? getCustomers() : [];
  var c = cs.filter(function(x){ return x && x.lotFormat === 'dddyy'; })[0];
  return c ? c.company : 'Day first';
}

// El dia de produccion de un registro: su fecha, salvo que sea el 2o turno
// despues de medianoche (sigue con el LOT del dia anterior)
function lotDiaProduccion(iso, turno){
  var hoy = localDateStr();
  iso = String(iso||'').slice(0,10) || hoy;
  var t = turno || (typeof expectedShift === 'function' ? expectedShift() : 1);
  var now = new Date(), m = now.getHours()*60 + now.getMinutes();
  var fin = (typeof SECOND_SHIFT_END === 'number') ? SECOND_SHIFT_END : 120;
  if(+t === 2 && iso === hoy && m < fin) return lotMasDias(iso, -1);
  return iso;
}

// ---- Las dos pantallas que lo usan ----
var LOT_PANTALLAS = {
  weight: {lot:'w-lot', product:'w-product', date:'w-date'},
  seal:   {lot:'s-lot', product:'s-product', date:'s-date'}
};
function lotContexto(scr){
  var cfg = LOT_PANTALLAS[scr];
  var pe = document.getElementById(cfg.product), de = document.getElementById(cfg.date);
  var p = (pe && pe.value && typeof findProduct === 'function') ? findProduct(pe.value) : null;
  var turno = (typeof st === 'object' && st) ? st.shift : null;
  var dia = lotDiaProduccion(de && de.value, turno);
  return {producto:p, dia:dia, formato:lotFormatoProducto(p)};
}
function lotDelDia(scr){ var c = lotContexto(scr); return lotCodigo(c.dia, c.formato); }

// Las opciones del selector, en el orden que pidio QA
function lotOpciones(dia){
  var nom = lotNombreDddyy(), man = lotMasDias(dia, 1);
  return [
    {v:lotCodigo(dia,'yyddd'), t:'Caputo'},
    {v:lotCodigo(dia,'dddyy'), t:nom},
    {v:lotCodigo(man,'yyddd'), t:'Next day Caputo'},
    {v:lotCodigo(man,'dddyy'), t:'Next day '+nom}
  ];
}

function lotPintarSelector(scr){
  var cfg = LOT_PANTALLAS[scr];
  var sel = document.getElementById(cfg.lot+'-pick');
  if(!sel) return;
  var dia = lotContexto(scr).dia;
  sel.innerHTML = '<option value="" selected disabled hidden>LOT</option>' +
    lotOpciones(dia).map(function(o){
      return '<option value="'+esc(o.v)+'">'+esc(o.v)+' · '+esc(o.t)+'</option>';
    }).join('') +
    '<option value="__cal">Calendar…</option>';
}

// Pone el LOT del dia si el campo esta vacio o sigue con el que puso el sistema
// (lo que QA eligio o escribio no se toca)
function lotRefresh(scr){
  var cfg = LOT_PANTALLAS[scr];
  if(!cfg) return;
  var inp = document.getElementById(cfg.lot);
  if(!inp) return;
  var def = lotDelDia(scr);
  if(!inp.value.trim() || inp.value === inp.dataset.auto){
    inp.value = def;
    inp.dataset.auto = def;
    inp.classList.add('lot-auto');
    inp.title = 'LOT of the day. Pick another one or type it.';
  }
  lotPintarSelector(scr);
  if(scr === 'weight' && typeof wpComparar === 'function') wpComparar();
}

// Lo que QA elige o escribe es suyo: el sistema ya no lo cambia solo
function lotPropio(inp){
  delete inp.dataset.auto;
  inp.classList.remove('lot-auto');
  inp.title = '';
}
function lotPoner(scr, codigo){
  var inp = document.getElementById(LOT_PANTALLAS[scr].lot);
  if(!inp) return;
  inp.value = codigo;
  lotPropio(inp);
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new Event('change', {bubbles:true}));
  if(scr === 'weight' && typeof wpComparar === 'function') wpComparar();
  toast('LOT '+codigo);
}
function lotElegido(scr, sel){
  var v = sel.value;
  sel.selectedIndex = 0;
  if(!v) return;
  if(v === '__cal'){ lotCalendario(scr); return; }
  lotPoner(scr, v);
}

// Arma el campo: el input se queda (con su id, que es el que se guarda) y al
// lado va el selector
function lotMontar(scr){
  var cfg = LOT_PANTALLAS[scr];
  var inp = document.getElementById(cfg.lot);
  if(!inp || document.getElementById(cfg.lot+'-pick')) return;
  var caja = document.createElement('div');
  caja.className = 'lot-field';
  inp.parentNode.insertBefore(caja, inp);
  caja.appendChild(inp);
  inp.setAttribute('inputmode', 'numeric');
  inp.setAttribute('autocomplete', 'off');
  var btn = document.createElement('div');
  btn.className = 'lot-pick';
  btn.innerHTML = '<span data-icon="calendar"></span><span class="lot-pick-txt">Choose</span>'+
    '<select id="'+cfg.lot+'-pick" aria-label="Choose the LOT"></select>';
  caja.appendChild(btn);
  if(typeof renderIcons === 'function') renderIcons(btn);
  var sel = btn.querySelector('select');
  // las opciones se rehacen al abrirlo: la fecha o el turno pueden haber cambiado
  ['focus','mousedown','touchstart'].forEach(function(ev){
    sel.addEventListener(ev, function(){ lotPintarSelector(scr); }, {passive:true});
  });
  sel.addEventListener('change', function(){ lotElegido(scr, sel); });
  inp.addEventListener('input', function(){ if(inp.value !== inp.dataset.auto) lotPropio(inp); });
  var de = document.getElementById(cfg.date);
  if(de) de.addEventListener('change', function(){ lotRefresh(scr); });
  var pe = document.getElementById(cfg.product);
  if(pe) pe.addEventListener('input', function(){ lotRefresh(scr); });
  lotPintarSelector(scr);
}

// ---- El calendario ----
// Un mes con los dos LOT de cada dia. Tocar uno lo pone en el campo.
var lotCal = {scr:null, y:0, m:0};
function lotCalendario(scr){
  var dia = lotContexto(scr).dia, f = lotFecha(dia);
  lotCal = {scr:scr, y:f.getFullYear(), m:f.getMonth(), marcado:dia};
  var ov = document.getElementById('lot-cal');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'lot-cal';
    ov.className = 'lot-cal-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'LOT calendar');
    ov.addEventListener('click', function(e){
      if(e.target === ov) lotCalCerrar();
      var b = e.target.closest('[data-lot]');
      if(b){ lotPoner(lotCal.scr, b.getAttribute('data-lot')); lotCalCerrar(); }
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && document.getElementById('lot-cal') && !document.getElementById('lot-cal').hidden) lotCalCerrar();
    });
    document.body.appendChild(ov);
  }
  ov.hidden = false;
  lotCalPintar();
}
function lotCalCerrar(){ var ov = document.getElementById('lot-cal'); if(ov) ov.hidden = true; }
function lotCalMover(n){
  var d = new Date(lotCal.y, lotCal.m + n, 1);
  lotCal.y = d.getFullYear(); lotCal.m = d.getMonth();
  lotCalPintar();
}
function lotCalHoy(){
  var d = lotFecha(lotDiaProduccion(localDateStr()));
  lotCal.y = d.getFullYear(); lotCal.m = d.getMonth();
  lotCalPintar();
}
function lotCalPintar(){
  var ov = document.getElementById('lot-cal');
  if(!ov) return;
  var MES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var nom = lotNombreDddyy();
  var hoy = lotDiaProduccion(localDateStr());
  var primero = new Date(lotCal.y, lotCal.m, 1, 12);
  var dias = new Date(lotCal.y, lotCal.m + 1, 0).getDate();
  var celdas = '';
  for(var i = 0; i < primero.getDay(); i++) celdas += '<div class="lc-d lc-vacio"></div>';
  for(var d = 1; d <= dias; d++){
    var iso = lotIso(new Date(lotCal.y, lotCal.m, d, 12));
    var a = lotCodigo(iso, 'yyddd'), b = lotCodigo(iso, 'dddyy');
    celdas += '<div class="lc-d'+(iso === hoy ? ' lc-hoy' : '')+(iso === lotCal.marcado ? ' lc-marca' : '')+'">'+
      '<span class="lc-n">'+d+'</span>'+
      '<button type="button" class="lc-a" data-lot="'+a+'" aria-label="Caputo '+a+'">'+a+'</button>'+
      '<button type="button" class="lc-b" data-lot="'+b+'" aria-label="'+esc(nom)+' '+b+'">'+b+'</button>'+
    '</div>';
  }
  ov.innerHTML =
    '<div class="lot-cal">'+
      '<div class="lc-head">'+
        '<button type="button" class="ico-btn" onclick="lotCalMover(-1)" aria-label="Previous month">‹</button>'+
        '<b>'+MES[lotCal.m]+' '+lotCal.y+'</b>'+
        '<button type="button" class="ico-btn" onclick="lotCalMover(1)" aria-label="Next month">›</button>'+
        '<span class="lc-gap"></span>'+
        '<button type="button" class="btn-ghost" onclick="lotCalHoy()">Today</button>'+
        '<button type="button" class="ico-btn" onclick="lotCalCerrar()" aria-label="Close">×</button>'+
      '</div>'+
      '<div class="lc-leyenda"><span><i class="lc-a-dot"></i>Caputo · YYDDD</span>'+
        '<span><i class="lc-b-dot"></i>'+esc(nom)+' · DDDYY</span></div>'+
      '<div class="lc-grid">'+
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(w){ return '<div class="lc-w">'+w+'</div>'; }).join('')+
        celdas+
      '</div>'+
      '<div class="lc-pie">Tap a LOT to use it.</div>'+
    '</div>';
}

// ---- Arranque ----
(function(){
  lotMontar('weight');
  lotMontar('seal');
  window.addEventListener('nexora:screen', function(e){
    if(e.detail === 'screen-weight') lotRefresh('weight');
    if(e.detail === 'screen-seal')   lotRefresh('seal');
  });
})();
