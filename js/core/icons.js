// ===== ICONS =====
// Minimal line icons (SF Symbols style): 24x24, stroke currentColor.
var _IC = function(inner){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>';
};
var ICONS = {
  home:      _IC('<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h3.5V15h3v5.5H17A1.5 1.5 0 0 0 18.5 19V9.5"/>'),
  scale:     _IC('<path d="M9.5 6.5a2.5 2.5 0 0 1 5 0"/><path d="M8.2 6.5h7.6l2 11.2a1.6 1.6 0 0 1-1.6 1.8H7.8a1.6 1.6 0 0 1-1.6-1.8Z"/>'),
  droplet:   _IC('<path d="M12 3.5s6 6.4 6 10.2a6 6 0 1 1-12 0C6 9.9 12 3.5 12 3.5Z"/>'),
  chart:     _IC('<path d="M4 20.5h16"/><path d="M7 17v-5"/><path d="M12 17V7"/><path d="M17 17v-8"/>'),
  clipboard: _IC('<rect x="5.5" y="4.5" width="13" height="16" rx="1.8"/><path d="M9.5 4.5V3.8A1.3 1.3 0 0 1 10.8 2.5h2.4a1.3 1.3 0 0 1 1.3 1.3v.7"/><path d="m9 13.5 2.2 2.2 4-4.7"/>'),
  thermo:    _IC('<path d="M10 6a2 2 0 0 1 4 0v7.4a4.2 4.2 0 1 1-4 0Z"/><circle cx="12" cy="16.8" r="1.3" fill="currentColor" stroke="none"/>'),
  lock:      _IC('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  search:    _IC('<circle cx="11" cy="11" r="6.3"/><path d="m15.7 15.7 4.6 4.6"/>'),
  pulse:     _IC('<path d="M3.5 12.5h3.6l2.4-6 4 11 2.4-6h4.6"/>'),
  doc:       _IC('<path d="M7.5 3.5h6.3L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13.5 3.8V8h4.4"/><path d="M9.5 12.5h5"/><path d="M9.5 16h5"/>'),
  sliders:   _IC('<path d="M4 7.5h16"/><path d="M4 12h16"/><path d="M4 16.5h16"/><circle cx="9" cy="7.5" r="1.9" fill="var(--bg)"/><circle cx="15" cy="12" r="1.9" fill="var(--bg)"/><circle cx="7" cy="16.5" r="1.9" fill="var(--bg)"/>'),
  check:     _IC('<circle cx="12" cy="12" r="8.3"/><path d="m8.5 12.3 2.4 2.4 4.6-5.2"/>'),
  moon:      _IC('<path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.3 6.3 0 0 0 9.7 9.7Z"/>'),
  sun:       _IC('<circle cx="12" cy="12" r="3.4"/><path d="M12 3.5V5.4"/><path d="M12 18.6v1.9"/><path d="M3.5 12h1.9"/><path d="M18.6 12h1.9"/><path d="m5.99 5.99 1.35 1.35"/><path d="m16.66 16.66 1.35 1.35"/><path d="m18.01 5.99-1.35 1.35"/><path d="m7.34 16.66-1.35 1.35"/>'),
  logout:    _IC('<path d="M9.5 21H6a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 6 3h3.5"/><path d="M14.5 7.5 19 12l-4.5 4.5"/><path d="M19 12H9.5"/>')
};
// Fill every element carrying data-icon="name"
function renderIcons(root){
  (root||document).querySelectorAll('[data-icon]').forEach(function(el){
    var ic = ICONS[el.getAttribute('data-icon')];
    if(ic) el.innerHTML = ic;
  });
}
