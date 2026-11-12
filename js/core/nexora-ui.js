// Interacciones de presentación; sin escrituras ni consultas de datos remotos.
var nxLoginBusy=false;
var nxCommandTrigger=null;
var NX_SCREEN_NOTES={
 'screen-production':'Plan the shift. Keep every line and sample connected.',
 'screen-orders':'Enter each order once: its PO and its products. Sample Analysis fills them in by itself.',
 'screen-coa':'Prepare certificates from completed laboratory results.',
 'screen-labresults':'Review external laboratory reports and final results.',
 'screen-coastatus':'Follow each sample from collection to certificate.',
 'screen-coastock':'Give a customer to a product made for stock, by its LOT and date.',
 'screen-admin':'Manage people, roles and workspace permissions.',
 'screen-analysis':'Capture moisture, fat, pH and microbiological results.',
 'screen-yeast':'Track incubation dates, plate readings and pending samples.',
 'screen-lab':'Organize samples and their laboratory workflow.',
 'screen-raw':'Record incoming material checks and plate results.',
 'screen-dry':'Manage samples and quality results for Dry 1935.',
 'screen-formag':'Keep Formag sample records in one workspace.',
 'screen-rd':'Document development samples and their results.',
 'screen-grilling':'Record grilling tests and product performance.',
 'screen-temp':'Record environmental conditions at each checkpoint.',
 'screen-gmp':'Review operating practices and document findings.',
 'screen-preop':'Inspect the plant after sanitation, before the next production.',
 'screen-dashboard':'Explore quality performance across the selected period.',
 'screen-products':'Find products, specifications and package targets.',
 'screen-customers':'Maintain customer information and product relationships.',
 'screen-addproduct':'Define product information, packaging and quality targets.',
 'screen-hold':'Track held product, corrective actions and dispositions.',
 'screen-lotsearch':'Connect records by product, lot, customer or date.',
 'screen-activity':'Review the history of actions in your workspace.'
};
function nxSetLoginBusy(v){
  nxLoginBusy=!!v;
  var b=document.getElementById('nx-sign-in');
  if(b){b.disabled=v;b.classList.toggle('nx-login-busy',v);b.setAttribute('aria-busy',String(v));b.querySelector('span').textContent=v?'Signing in…':'Enter workspace';}
  if(v){var e=document.getElementById('login-error');if(e)e.style.display='none';}
}
function nxTogglePassword(){
  var p=document.getElementById('login-pass'),b=document.getElementById('nx-pass-toggle');
  if(!p||!b)return;
  var show=p.type==='password';p.type=show?'text':'password';
  b.setAttribute('aria-pressed',String(show));b.setAttribute('aria-label',show?'Hide password':'Show password');
}
// Pantallas de tabla (hoja de captura): en escritorio el menu de la izquierda
// se esconde solo para que la tabla use todo el ancho y no haya que correr la
// barra para llegar a las columnas. El boton de arriba lo abre encima, igual
// que en el telefono; al elegir otra funcion se vuelve a cerrar.
var NX_SHEET_SCREENS={
 'screen-analysis':1,'screen-yeast':1,'screen-lab':1,'screen-raw':1,'screen-dry':1,
 'screen-formag':1,'screen-rd':1,'screen-grilling':1,'screen-production':1,'screen-orders':1,
 'screen-samplelist':1,'screen-coa':1,'screen-labresults':1,'screen-coastatus':1,'screen-coastock':1,
 'screen-customers':1,'screen-products':1,'screen-hold':1,'screen-admin':1,'screen-lotsearch':1
};
function nxNavAuto(){return document.body.classList.contains('nx-nav-auto');}
function nxNavDrawer(){return window.innerWidth<1024||nxNavAuto();}
function nxSheetMode(id){document.body.classList.toggle('nx-nav-auto',!!NX_SHEET_SCREENS[id]);}
function nxToggleNav(force){
  var open=typeof force==='boolean'?force:!document.body.classList.contains('nx-nav-open');
  document.body.classList.toggle('nx-nav-open',open);
  var top=document.querySelector('.topstack');if(top)top.inert=open;
  document.querySelectorAll('.screen').forEach(function(s){s.inert=open;});
  var trigger=document.getElementById('nx-menu-btn');
  if(trigger)trigger.setAttribute('aria-expanded',String(open));
  if(open){
    var first=document.querySelector('#snav button');if(first)first.focus();
  } else if(trigger && nxNavDrawer()){trigger.focus({preventScroll:true});}
}
function nxFocusContent(e){
  if(e)e.preventDefault();
  var s=document.querySelector('.screen.active');if(!s)return;
  var h=s.querySelector('h1,.form-title')||s;
  h.setAttribute('tabindex','-1');h.focus({preventScroll:true});
}
function nxOpenCommand(){
  if(!currentUser)return;
  var d=document.getElementById('nx-command');if(!d)return;
  nxCommandTrigger=document.activeElement;
  var menu=document.getElementById('user-menu');if(menu)menu.classList.remove('open');
  document.getElementById('nx-command-input').value='';
  nxSearchModules();
  if(!d.open)d.showModal();
  document.getElementById('nx-command-input').focus();
}
function nxCloseCommand(){
  var d=document.getElementById('nx-command');if(d&&d.open)d.close();
  if(nxCommandTrigger && document.contains(nxCommandTrigger))nxCommandTrigger.focus();
}
function nxSearchModules(){
  if(!currentUser)return;
  var q=document.getElementById('nx-command-input').value.trim().toLowerCase(),items=[];
  myModules().forEach(function(m){moduleItemsFor(m).forEach(function(i){
    if(!i.soon && (!q || (m.name+' '+i.name).toLowerCase().indexOf(q)>=0)) items.push({m:m,i:i});
  });});
  var host=document.getElementById('nx-command-results');
  host.innerHTML=items.length?items.map(function(x){
    return '<button class="nx-command-item" type="button" data-module="'+x.m.id+'" data-screen="'+x.i.screen+'"><span data-icon="'+x.i.icon+'"></span><span><b>'+esc(x.i.name)+'</b><small>'+esc(x.m.name)+'</small></span></button>';
  }).join(''):'<div class="kd-none">No matching functions in your assigned workspaces.</div>';
  renderIcons(host);
  host.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){
    nxCloseCommand();snavGo(b.dataset.module,b.dataset.screen);nxFocusContent();
  });});
}
function nxMarkKpiDirty(dirty){
  var b=document.getElementById('nx-kpi-apply');if(!b)return;
  var pending=dirty!==false;b.classList.toggle('pending',pending);b.setAttribute('aria-label',pending?'Apply pending line and shift filters':'Apply line and shift filters');
}
function nxEnhanceScreen(id){
  var s=document.getElementById(id);if(!s)return;
  if(NX_SCREEN_NOTES[id] && !s.querySelector('.nx-screen-sub')){
    var t=s.querySelector('.form-title');
    if(t){var p=document.createElement('p');p.className='nx-screen-sub';p.textContent=NX_SCREEN_NOTES[id];t.insertAdjacentElement('afterend',p);}
  }
  // Los controles antiguos que sólo tenían placeholder obtienen un nombre.
  s.querySelectorAll('input,select,textarea').forEach(function(e){
    if(e.type==='hidden'||e.hasAttribute('aria-label')||e.hasAttribute('aria-labelledby')||e.closest('label'))return;
    if(e.id && document.querySelector('label[for="'+e.id+'"]'))return;
    var text=e.getAttribute('placeholder');
    if(!text){var prev=e.previousElementSibling;if(prev&&prev.classList.contains('sec-label'))text=prev.textContent;}
    if(text)e.setAttribute('aria-label',text);
  });
  s.querySelectorAll('[aria-label="Buscar"]').forEach(function(b){b.setAttribute('aria-label','Apply filters');b.title='Apply filters';});
  s.querySelectorAll('.sheet-bar,.filter-grid').forEach(function(bar){
    if(bar.dataset.nxEnter)return;bar.dataset.nxEnter='true';
    bar.addEventListener('keydown',function(e){
      if(e.key!=='Enter'||e.target.tagName!=='INPUT'||e.target.type==='file')return;
      var apply=bar.querySelector('button[id$="-go"]');
      if(apply){e.preventDefault();apply.click();}
    });
  });
}
window.addEventListener('nexora:screen',function(e){
  var open=document.body.classList.contains('nx-nav-open');
  if(open)nxToggleNav(false);
  nxSheetMode(e.detail);
  nxEnhanceScreen(e.detail);
  if(e.detail==='screen-login'){
    var menu=document.getElementById('user-menu');if(menu)menu.classList.remove('open');
    nxCloseCommand();
    var p=document.getElementById('login-pass');if(p)p.type='password';
    var b=document.getElementById('nx-pass-toggle');if(b){b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Show password');}
  }
  if(open)nxFocusContent();
});
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&currentUser){e.preventDefault();nxOpenCommand();}
  if(e.key==='Escape'){
    if(document.body.classList.contains('nx-nav-open'))nxToggleNav(false);
    var m=document.getElementById('user-menu');if(m)m.classList.remove('open');
  }
  if(e.key==='Tab' && document.body.classList.contains('nx-nav-open') && nxNavDrawer()){
    var buttons=document.querySelectorAll('#snav button'),first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
window.addEventListener('resize',function(){if(!nxNavDrawer() && document.body.classList.contains('nx-nav-open'))nxToggleNav(false);});
function nxInitUI(){
  nxEnhanceScreen('screen-login');
  var modal=document.getElementById('nx-command');if(modal)renderIcons(modal);
  var d=document.getElementById('nx-command');
  if(d)d.addEventListener('click',function(e){if(e.target===d){var r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)nxCloseCommand();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',nxInitUI);else nxInitUI();

// Etiqueta de los botones de solo icono ([data-tip]): sale al pasar el raton o
// con el teclado, y se pega al body (position:fixed) para que el scroll de una
// tabla no la corte. Se acomoda para no salirse de la pantalla.
(function(){
  var tip = null, dueno = null;
  function quitar(){ if(tip){ tip.remove(); tip = null; } dueno = null; }
  function poner(el){
    var txt = el.getAttribute('data-tip');
    if(!txt) return;
    quitar();
    dueno = el;
    tip = document.createElement('div');
    tip.className = 'nx-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = txt;
    document.body.appendChild(tip);
    var r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), m = 8;
    var x = Math.min(Math.max(m, r.left + r.width/2 - t.width/2), window.innerWidth - t.width - m);
    var y = r.top - t.height - 8;
    if(y < m) y = r.bottom + 8;
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
  }
  document.addEventListener('mouseover', function(e){
    var el = e.target.closest && e.target.closest('[data-tip]');
    if(el && el !== dueno) poner(el); else if(!el && dueno) quitar();
  });
  document.addEventListener('focusin', function(e){
    var el = e.target.closest && e.target.closest('[data-tip]');
    if(el && el.matches(':focus-visible')) poner(el);
  });
  ['focusout', 'scroll', 'click'].forEach(function(ev){ document.addEventListener(ev, quitar, true); });
})();

// ===== HOJAS COMO EXCEL (pedido del usuario, 10 nov 2026) =====
// Las flechas del teclado se mueven de celda en celda en todas las hojas:
//   ↑ ↓   a la celda de arriba / abajo en la misma columna
//   ← →   a la de al lado, cuando el cursor ya esta en la orilla del texto
//   Enter en una fila guardada: a la de abajo (y se guarda, como en Excel)
// Al llegar a una celda se selecciona lo que tiene: lo que se escriba lo
// reemplaza. Las fechas y las listas desplegables conservan sus flechas.
// Un clic en una parte de la hoja donde no se escribe: las flechas mueven la hoja.
(function(){
  function editable(el){
    return !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !el.disabled && !el.readOnly &&
           el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio' && el.offsetParent !== null;
  }
  function celdaDe(el){
    var td = el && el.closest ? el.closest('td') : null;
    return (td && td.closest('table.sheet')) ? td : null;
  }
  // La columna "de verdad" de una celda (las de la fila nueva pueden abarcar varias)
  function colDe(td){
    var c = 0, x = td.previousElementSibling;
    while(x){ c += x.colSpan || 1; x = x.previousElementSibling; }
    return c;
  }
  function tdEnCol(tr, col){
    var c = 0;
    for(var i = 0; i < tr.cells.length; i++){
      var td = tr.cells[i], n = td.colSpan || 1;
      if(col >= c && col < c + n) return td;
      c += n;
    }
    return null;
  }
  function controlDe(td){
    if(!td) return null;
    var l = td.querySelectorAll('input,select,textarea');
    for(var i = 0; i < l.length; i++) if(editable(l[i])) return l[i];
    return null;
  }
  function ir(el){
    el.focus({preventScroll:true});
    try { el.scrollIntoView({block:'nearest', inline:'nearest'}); } catch(e){}
    try { if(el.select && el.tagName !== 'SELECT') el.select(); } catch(e){}
  }
  function vertical(el, dir){
    var td = celdaDe(el), tabla = td.closest('table'), col = colDe(td), filas = [];
    for(var b = 0; b < tabla.tBodies.length; b++)
      for(var r = 0; r < tabla.tBodies[b].rows.length; r++) filas.push(tabla.tBodies[b].rows[r]);
    for(var j = filas.indexOf(td.parentElement) + dir; j >= 0 && j < filas.length; j += dir){
      var c = controlDe(tdEnCol(filas[j], col));
      if(c){ ir(c); return true; }
    }
    return false;
  }
  function horizontal(el, dir){
    var tr = celdaDe(el).parentElement, l = [];
    var todos = tr.querySelectorAll('input,select,textarea');
    for(var i = 0; i < todos.length; i++) if(editable(todos[i])) l.push(todos[i]);
    var n = l[l.indexOf(el) + dir];
    if(n){ ir(n); return true; }
    return false;
  }
  // ← → mueven de celda solo en la orilla del texto (o si todo esta seleccionado)
  function enOrilla(el, dir){
    if(el.tagName === 'SELECT') return true;
    try {
      var s = el.selectionStart, e = el.selectionEnd, L = String(el.value || '').length;
      if(s == null) return true;
      if(s === 0 && e === L) return true;
      return dir < 0 ? (s === 0 && e === 0) : (s === L && e === L);
    } catch(x){ return true; }
  }
  document.addEventListener('keydown', function(e){
    if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var el = e.target;
    if(!editable(el) || !celdaDe(el)) return;
    var t = String(el.type || '').toLowerCase();
    if(t === 'date' || t === 'time' || t === 'datetime-local' || t === 'month' || t === 'week') return;
    var k = e.key;
    if(k === 'ArrowUp' || k === 'ArrowDown'){
      if(el.tagName === 'SELECT') return;                         // escogen la opcion
      if(el.getAttribute('list') && el.value) return;             // sugerencias (catalogo, ordenes)
      if(vertical(el, k === 'ArrowDown' ? 1 : -1)) e.preventDefault();
    } else if(k === 'ArrowLeft' || k === 'ArrowRight'){
      var d = k === 'ArrowRight' ? 1 : -1;
      if(enOrilla(el, d) && horizontal(el, d)) e.preventDefault();
    } else if(k === 'Enter'){
      var tr = el.closest('tr');
      if(!tr || tr.classList.contains('newrow') || el.hasAttribute('onkeydown') || el.tagName === 'TEXTAREA') return;
      if(vertical(el, 1)) e.preventDefault();
    }
  });
  // Clic en una parte de la hoja donde no se escribe: la hoja toma el teclado
  // y las flechas la mueven (a lo ancho y a lo alto)
  document.addEventListener('mousedown', function(e){
    var t = e.target;
    var w = t && t.closest ? t.closest('.sheet-wrap,.table-scroll') : null;
    if(!w || t.closest('input,select,textarea,button,a,label,summary,[onclick],[contenteditable]')) return;
    if(!w.hasAttribute('tabindex')) w.setAttribute('tabindex', '-1');
    setTimeout(function(){ w.focus({preventScroll:true}); }, 0);
  });
})();


// ===== LEYENDAS DETRAS DE UN "?" (pedido del usuario, 11 nov 2026) =====
// Minimalismo: la leyenda de estados de una pantalla (.legend) ya no ocupa
// sitio. Un "?" en la barra de filtros, junto al "...", la abre como burbuja;
// se cierra con otro toque, tocando fuera o con Esc.
(function(){
  function cerrar(salvo){
    document.querySelectorAll('.nx-q-box').forEach(function(bx){
      if(bx === salvo) return;
      var lg = bx.querySelector('.legend'), b = bx.querySelector('.nx-q-btn');
      if(lg) lg.hidden = true;
      if(b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function montar(){
    document.querySelectorAll('.screen .legend').forEach(function(lg, i){
      if(lg.closest('.nx-q-box')) return;
      var scr = lg.closest('.screen'), bar = scr && scr.querySelector('.sheet-bar');
      if(!bar) return;
      if(!lg.id) lg.id = 'nx-legend-' + (scr.id || i);
      lg.hidden = true;
      lg.setAttribute('role', 'note');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'nx-q-btn'; b.textContent = '?';
      b.title = 'What do the statuses mean?';
      b.setAttribute('aria-label', 'What do the statuses mean?');
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', lg.id);
      var bx = document.createElement('div');
      bx.className = 'nx-q-box';
      bx.appendChild(b); bx.appendChild(lg);
      // el "?" y el "..." van juntos al final de la barra
      var more = bar.querySelector(':scope > .more-box');
      var fin = document.createElement('div');
      fin.className = 'nx-bar-end';
      if(more){ bar.insertBefore(fin, more); fin.appendChild(bx); fin.appendChild(more); }
      else { bar.appendChild(fin); fin.appendChild(bx); }
      b.addEventListener('click', function(e){
        e.stopPropagation();
        var abrir = lg.hidden;
        cerrar(bx);
        lg.hidden = !abrir;
        b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      });
    });
  }
  document.addEventListener('click', function(e){ if(!e.target.closest('.nx-q-box')) cerrar(null); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrar(null); });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
