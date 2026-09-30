// ===== LA MARCA =====
// El mismo dibujo en dos tintas: la palabra va en azul marino sobre fondo
// claro y en hueso sobre fondo oscuro, asi se lee igual en los dos temas.
function paintBrand(root){
  var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
  var imgs = (root||document).querySelectorAll('[data-brand]');
  Array.prototype.forEach.call(imgs, function(img){
    var anim = img.getAttribute('data-brand') === 'anim';
    img.src = 'assets/nexora' + (anim ? '-anim' : '') + (oscuro ? '-dark' : '') + '.svg';
  });
}

// ===== DARK MODE =====
function toggleDarkMode() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  var btn = document.getElementById('dark-btn');
  if(btn) btn.innerHTML = isDark ? ICONS.moon : ICONS.sun;
  localStorage.setItem('safety_theme', isDark ? 'light' : 'dark');
  paintBrand();
  // el color de la funcion se recalcula: en oscuro va mas claro
  if(typeof applyScreenAccent==='function'){
    applyScreenAccent((document.querySelector('.screen.active')||{}).id||'screen-home');
  }
}
function initTheme() {
  var saved = localStorage.getItem('safety_theme') || localStorage.getItem('caputo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('dark-btn');
  if(btn) btn.innerHTML = saved === 'dark' ? ICONS.sun : ICONS.moon;
  paintBrand();
}

