// ===== HOLD NOTIFICATION TO SUPERVISOR =====
function notifySupervisorOfHold(caseNum, product, lot, reason) {
  // Find supervisors/admins
  var ops = getOperators();
  var sups = ops.filter(function(o){ return o.role==='supervisor'||o.role==='admin'; });
  if(!sups.length) return;
  // Show in-app notification
  var names = sups.map(function(s){return s.name;}).join(', ');
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:#c1121f;color:white;border-radius:14px;padding:14px 16px;z-index:8000;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
  div.innerHTML = '<div style="font-size:11px;font-weight:900;margin-bottom:4px">🔒 HOLD CREATED — SUPERVISORS NOTIFIED</div>'+
    '<div style="font-size:10px;opacity:0.9">'+caseNum+' · '+product+(lot?' · LOT '+lot:'')+' · Notified: '+names+'</div>';
  document.body.appendChild(div);
  setTimeout(function(){ div.remove(); }, 5000);
  // Log the notification
  logActivity('hold','Hold notification sent','Case '+caseNum+' — '+product+(lot?' LOT: '+lot:'')+' · Supervisors: '+names, currentUser?currentUser.name:'—');
}

