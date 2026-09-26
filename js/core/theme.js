// ===== DARK MODE =====
function toggleDarkMode() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  var btn = document.getElementById('dark-btn');
  if(btn) btn.innerHTML = isDark ? ICONS.moon : ICONS.sun;
  localStorage.setItem('safety_theme', isDark ? 'light' : 'dark');
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
}

