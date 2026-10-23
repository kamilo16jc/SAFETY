// Interacciones de presentación; sin escrituras ni consultas de datos remotos.
var nxLoginBusy=false;
var nxCommandTrigger=null;
var NX_SCREEN_NOTES={
 'screen-production':'Plan the shift. Keep every line and sample connected.',
 'screen-coa':'Prepare certificates from completed laboratory results.',
 'screen-labresults':'Review external laboratory reports and final results.',
 'screen-coastatus':'Follow each sample from collection to certificate.',
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
function nxToggleNav(force){
  var open=typeof force==='boolean'?force:!document.body.classList.contains('nx-nav-open');
  document.body.classList.toggle('nx-nav-open',open);
  var top=document.querySelector('.topstack');if(top)top.inert=open;
  document.querySelectorAll('.screen').forEach(function(s){s.inert=open;});
  var trigger=document.getElementById('nx-menu-btn');
  if(trigger)trigger.setAttribute('aria-expanded',String(open));
  if(open){
    var first=document.querySelector('#snav button');if(first)first.focus();
  } else if(trigger && window.innerWidth<1024){trigger.focus({preventScroll:true});}
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
  if(e.key==='Tab' && document.body.classList.contains('nx-nav-open') && window.innerWidth<1024){
    var buttons=document.querySelectorAll('#snav button'),first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
window.addEventListener('resize',function(){if(window.innerWidth>=1024 && document.body.classList.contains('nx-nav-open'))nxToggleNav(false);});
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
