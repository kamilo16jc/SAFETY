// Navegación única: conserva los permisos y el alcance por módulo.
var SNAV_MIN = 1024;
var snavOpen = '';
function snavActivo(){ return document.body.classList.contains('ui-fluent'); }
function renderSideNav(){
  var host=document.getElementById('snav');
  if(!host) return;
  if(!snavActivo() || !currentUser){host.innerHTML='';return;}
  var mods=myModules();
  if(snavOpen && !mods.some(function(m){return m.id===snavOpen;})) snavOpen='';
  var here=(document.querySelector('.screen.active')||{}).id;
  host.innerHTML='<button class="nx-nav-close" type="button" onclick="nxToggleNav(false)">Close navigation <span aria-hidden="true">×</span></button>'+
    '<button type="button" class="nx-nav-overview'+(here==='screen-home'?' on':'')+'" onclick="goTo(\'screen-home\')"'+(here==='screen-home'?' aria-current="page"':'')+'><span data-icon="chart"></span>Overview</button>'+
    '<div class="nx-nav-label">Workspaces</div>'+mods.map(function(m){
      return '<div class="nx-nav-group">'+snavTileHTML(m)+(m.id===snavOpen?'<div class="snav-list" id="snav-list-'+m.id+'">'+snavSubHTML(m)+'</div>':'')+'</div>';
    }).join('')+
    '<div class="nx-nav-bottom"><img data-brand="static" src="assets/caputo.svg" alt="Caputo"><span>Quality control<br>NEXORA workspace</span></div>';
  document.body.classList.toggle('snav-open',!!snavOpen);
  renderIcons(host);
  if(typeof paintBrand==='function') paintBrand(host);
  snavHighlight(here);
}
function snavTileHTML(m){
  var open=m.id===snavOpen;
  return '<button class="snav-tile'+(open?' open':'')+'" type="button" data-mod="'+m.id+'" style="--mcol:'+m.ink+'" aria-expanded="'+open+'" aria-label="'+esc(m.name)+'" onclick="snavToggle(\''+m.id+'\')">'+
    '<span class="snav-glyph" data-icon="'+m.icon+'"></span><span class="nx-nav-name">'+esc(m.name)+'</span><span class="nx-nav-chevron" aria-hidden="true">›</span></button>';
}
function snavSubHTML(m){
  return moduleItemsFor(m).map(function(item){return snavItemHTML(item,m);}).join('');
}
function snavItemHTML(item,m){
  if(item.soon) return '<span class="snav-item soon"><span class="snav-iico" data-icon="'+item.icon+'"></span><span class="snav-ilbl">'+esc(item.name)+'</span></span>';
  return '<button class="snav-item" type="button" data-screen="'+item.screen+'" onclick="snavGo(\''+m.id+'\',\''+item.screen+'\')"><span class="snav-iico" data-icon="'+item.icon+'"></span><span class="snav-ilbl">'+esc(item.name)+'</span></button>';
}
function snavToggle(id){
  snavOpen=snavOpen===id?'':id;
  renderSideNav();
  var toggle=document.querySelector('.snav-tile[data-mod="'+id+'"]');
  if(toggle) toggle.focus({preventScroll:true});
}
function snavGo(mod,screen){
  // La misma validación que usa el resto del sistema, también en el buscador.
  if(!canSeeScreen(screen,currentUser,mod)){toast('You do not have access to that function');return;}
  activeModule=mod;snavOpen=mod;
  if(typeof ribbonRemember==='function') ribbonRemember(screen,mod);
  renderSideNav();goTo(screen);
}
function snavMark(screen){
  var m=moduleOfScreen(screen);
  if(m && m!==snavOpen && canSeeModule(m)){snavOpen=m;renderSideNav();return;}
  snavHighlight(screen);
}
function snavHighlight(screen){
  var host=document.getElementById('snav');if(!host)return;
  host.querySelectorAll('.snav-item').forEach(function(b){
    var on=b.getAttribute('data-screen')===screen;
    b.classList.toggle('on',on);
    if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  var overview=host.querySelector('.nx-nav-overview');
  if(overview){overview.classList.toggle('on',screen==='screen-home');if(screen==='screen-home')overview.setAttribute('aria-current','page');else overview.removeAttribute('aria-current');}
}
function snavFecha(){return new Date().toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'});}
function snavPie(){var m=moduleById(snavOpen);return m?m.name:'';}
