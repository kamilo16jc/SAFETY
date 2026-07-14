// ===== CHECK TIMER =====
var checkTimer = null;
var checkInterval = 60; // minutes
var checkCountdown = 0;
var checkTimerEl = null;

function startCheckTimer() {
  stopCheckTimer();
  checkCountdown = checkInterval * 60;
  updateTimerDisplay();
  checkTimer = setInterval(function() {
    checkCountdown--;
    updateTimerDisplay();
    if(checkCountdown <= 0) {
      checkCountdown = checkInterval * 60;
      playAlert('hold');
      toast('⏰ Time for weight check!');
      showCheckReminder();
    }
  }, 1000);
}

function stopCheckTimer() {
  if(checkTimer) { clearInterval(checkTimer); checkTimer = null; }
}

function updateTimerDisplay() {
  var el = document.getElementById('check-timer-display');
  if(!el) return;
  var m = Math.floor(checkCountdown / 60);
  var s = checkCountdown % 60;
  el.textContent = '⏱ ' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  el.style.color = checkCountdown <= 120 ? 'var(--fail)' : 'var(--muted)';
}

function showCheckReminder() {
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  div.innerHTML = '<div style="background:var(--surface);border-radius:20px;padding:30px;text-align:center;max-width:300px;margin:20px">' +
    '<div style="font-size:50px;margin-bottom:12px">⏰</div>' +
    '<div style="font-size:18px;font-weight:900;color:var(--accent);margin-bottom:8px">TIME FOR WEIGHT CHECK!</div>' +
    '<div style="font-size:13px;color:var(--muted);margin-bottom:20px">Please complete your weight log now</div>' +
    '<button onclick="this.closest(\'div\').parentElement.remove();goTo(\'screen-weight\')" style="background:var(--accent);color:white;border:none;border-radius:12px;padding:12px 24px;font-family:Raleway,sans-serif;font-weight:800;font-size:14px;cursor:pointer;width:100%">GO TO WEIGHT LOG</button>' +
    '<button onclick="this.closest(\'div\').parentElement.remove()" style="background:none;border:none;color:var(--muted);font-family:Raleway,sans-serif;font-size:12px;cursor:pointer;margin-top:10px;width:100%">Dismiss</button>' +
  '</div>';
  document.body.appendChild(div);
}

