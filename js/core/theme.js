// ===== DARK MODE =====
function toggleDarkMode() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('dark-btn').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('safety_theme', isDark ? 'light' : 'dark');
}
function initTheme() {
  var saved = localStorage.getItem('safety_theme') || localStorage.getItem('caputo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('dark-btn');
  if(btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

