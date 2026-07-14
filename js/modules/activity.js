// ===== ACTIVITY LOG =====
var activityFilter = 'all';

function logActivity(type, action, details, user) {
  var db = getDB();
  if(!db.activityLog) db.activityLog = [];
  var entry = {
    id: Date.now(),
    type: type,
    action: action,
    details: details,
    user: user || (currentUser ? currentUser.name : 'Unknown'),
    date: localISOStr()
  };
  db.activityLog.push(entry);
  // Keep last 500 entries
  if(db.activityLog.length > 500) db.activityLog = db.activityLog.slice(-500);
  saveDB(db);
  // Sync to Firebase
  if(window.saveActivityToFirebase) window.saveActivityToFirebase(entry);
}

function setActivityFilter(btn) {
  activityFilter = btn.getAttribute('data-val');
  document.querySelectorAll('[data-group="alog"]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  renderActivityLog();
}

function initActivity() {
  activityDaysLoaded = 7;
  activitySelectedDate = null;
  activityFilter = 'all';
  var label = document.getElementById('activity-date-label');
  if(label) label.textContent = '📅 Today (last 24h)';
  var resetBtn = document.getElementById('activity-reset-btn');
  if(resetBtn) resetBtn.style.display = 'none';
  document.querySelectorAll('[data-group="alog"]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-val')==='all'); });
  document.querySelectorAll('[data-group="alog"]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-val')==='all'); });
  renderActivityLog();
}

var activityDaysLoaded = 7;
var activitySelectedDate = null; // null = today (24h), otherwise a Date object
var calCurrentMonth = null;

// ===== ACTIVITY CALENDAR =====
function openActivityCalendar() {
  calCurrentMonth = new Date();
  calCurrentMonth.setDate(1);
  renderCalendar();
  document.getElementById('activity-cal-modal').style.display = 'flex';
}

function closeActivityCalendar() {
  document.getElementById('activity-cal-modal').style.display = 'none';
}

function calNavMonth(dir) {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() + dir);
  renderCalendar();
}

function renderCalendar() {
  var now   = new Date();
  var year  = calCurrentMonth.getFullYear();
  var month = calCurrentMonth.getMonth();
  document.getElementById('cal-month-label').textContent =
    calCurrentMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month+1, 0).getDate();
  var grid = document.getElementById('cal-days-grid');
  grid.innerHTML = '';

  // Empty cells before first day
  for(var i=0; i<firstDay; i++) {
    grid.innerHTML += '<div></div>';
  }

  for(var d=1; d<=daysInMonth; d++) {
    var cellDate = new Date(year, month, d);
    var isToday  = cellDate.toDateString() === now.toDateString();
    var isFuture = cellDate > now;
    var isSelected = activitySelectedDate && cellDate.toDateString() === activitySelectedDate.toDateString();
    var bg = isSelected ? 'var(--accent)' : isToday ? 'var(--surface2)' : 'var(--surface)';
    var color = isSelected ? 'white' : isFuture ? 'var(--muted)' : 'var(--text)';
    var border = isToday ? '2px solid var(--accent)' : '1px solid var(--border)';
    var cursor = isFuture ? 'default' : 'pointer';
    var dayData = isFuture ? '' : 'data-caldate="'+cellDate.toISOString()+'"';
    grid.innerHTML += '<div '+dayData+' style="text-align:center;padding:8px 2px;border-radius:8px;font-size:13px;font-weight:700;background:'+bg+';color:'+color+';border:'+border+';cursor:'+cursor+'">'+d+'</div>';
  }

  grid.onclick = function(e) {
    var cell = e.target.closest('[data-caldate]');
    if(!cell) return;
    var date = new Date(cell.getAttribute('data-caldate'));
    selectActivityDate(date);
    closeActivityCalendar();
  };
}

function selectActivityDate(date) {
  activitySelectedDate = date;
  var label = date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('activity-date-label').textContent = '📅 ' + label;
  document.getElementById('activity-reset-btn').style.display = 'inline-block';
  loadActivityForDate(date);
}

function resetActivityToToday() {
  activitySelectedDate = null;
  document.getElementById('activity-date-label').textContent = '📅 Today (last 24h)';
  document.getElementById('activity-reset-btn').style.display = 'none';
  renderActivityLog();
}

function loadActivityForDate(date) {
  if(window._fbLoadActivity) {
    var start = new Date(date); start.setHours(0,0,0,0);
    var end   = new Date(date); end.setHours(23,59,59,999);
    window._fbLoadActivityRange(start, end, function(){ renderActivityLog(); });
  } else {
    renderActivityLog();
  }
}

function loadMoreActivity() {
  activityDaysLoaded += 7;
  var btn = document.getElementById('load-more-activity');
  if(btn) btn.textContent = 'Loading...';
  if(window._fbLoadActivity) {
    window._fbLoadActivity(activityDaysLoaded, function(){
      renderActivityLog();
      if(btn) btn.textContent = 'Load 7 More Days';
    });
  }
}

function loadActivityFromFirebase(days, callback) {
  if(!window._fbLoadActivity) { if(callback) callback(); return; }
  window._fbLoadActivity(days, callback);
}

function renderActivityLog() {
  var db = getDB();
  var now = new Date();
  var logs = (db.activityLog || []).slice().reverse();

  // Filter by date selection
  if(activitySelectedDate) {
    var start = new Date(activitySelectedDate); start.setHours(0,0,0,0);
    var end   = new Date(activitySelectedDate); end.setHours(23,59,59,999);
    logs = logs.filter(function(l){
      var d = new Date(l.date);
      return d >= start && d <= end;
    });
  } else {
    // Default: last 24 hours
    var cutoff = new Date(now.getTime() - 24*60*60*1000);
    logs = logs.filter(function(l){ return new Date(l.date) >= cutoff; });
  }

  if(activityFilter !== 'all') logs = logs.filter(function(l){ return l.type === activityFilter; });
  var icons = {weight:'⚖️', seal:'🧪', gmp:'📋', hold:'🔒', admin:'⚙️', login:'👤'};
  var el = document.getElementById('activity-log-list');
  if(!logs.length) { el.innerHTML = '<div class="empty">No activity recorded yet</div>'; return; }
  el.innerHTML = logs.slice(0,100).map(function(l) {
    var dt = l.date ? new Date(l.date).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-start">'+
      '<div style="font-size:18px;margin-top:1px">'+(icons[l.type]||'📝')+'</div>'+
      '<div style="flex:1">'+
        '<div style="font-size:11px;font-weight:700;color:var(--text)">'+l.action+'</div>'+
        '<div style="font-size:10px;color:var(--muted)">'+l.details+'</div>'+
        '<div style="font-size:10px;color:var(--muted);margin-top:2px">By: '+l.user+' · '+dt+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

