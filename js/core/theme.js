// ===== LA MARCA =====
// El logo de Caputo trae su propio fondo blanco, asi que se lee en los dos
// temas; lo unico que cambia es la (R), negra en claro y hueso en oscuro.
// Se mira el fondo de verdad y no solo data-theme: en escritorio la vista de
// oficina se queda en claro aunque el tema diga oscuro, y ahi una (R) hueso
// desaparece sobre el blanco.
function fondoOscuro(){
  var c = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number);
  if(c.length < 3 || c[3] === 0) return document.documentElement.getAttribute('data-theme') === 'dark';
  return (0.299*c[0] + 0.587*c[1] + 0.114*c[2]) < 128;
}
function paintBrand(root){
  var oscuro = fondoOscuro();
  var imgs = (root||document).querySelectorAll('[data-brand]');
  Array.prototype.forEach.call(imgs, function(img){
    img.src = 'assets/caputo' + (oscuro ? '-dark' : '') + '.svg';
  });
}
// Al cruzar los 1024px cambia el fondo (oficina en claro, telefono con el
// tema elegido), y con el la tinta de la (R)
if(window.matchMedia){
  var _mqBrand = matchMedia('(min-width:1024px)');
  var _onBrand = function(){ paintBrand(); };
  if(_mqBrand.addEventListener) _mqBrand.addEventListener('change', _onBrand);
  else if(_mqBrand.addListener) _mqBrand.addListener(_onBrand);
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

