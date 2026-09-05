// ===== DUPLICATE LINE GUARD =====
// Compartido por Weight Log y Bag Seal. Detecta el error de dejar la línea
// anterior seleccionada al pasar a otra máquina: dos registros de la misma
// línea dentro de DUP_WINDOW_MIN minutos respecto a la hora del check.
var dupPending  = null;   // {commit:fn, screen:'screen-weight'|'screen-seal'}
var dupOverride = false;  // el usuario guardó a pesar del aviso

// Registro más cercano en el tiempo para esa línea dentro de la ventana.
// Devuelve {rec, minutes} — minutes > 0 si el registro previo es anterior.
function findRecentForLine(records, line, whenISO){
  if(!line) return null;
  var t = new Date(whenISO).getTime();
  if(isNaN(t)) return null;
  var span = DUP_WINDOW_MIN*60*1000;
  var best = null, bestT = 0;
  (records||[]).forEach(function(r){
    if(String(r.line)!==String(line)) return;
    var rt = new Date(r.date).getTime();
    if(isNaN(rt) || Math.abs(t-rt)>span) return;
    if(!best || Math.abs(t-rt)<Math.abs(t-bestT)){ best=r; bestT=rt; }
  });
  return best ? {rec:best, minutes:Math.round((t-bestT)/60000)} : null;
}

function dupAgoLabel(mins){
  if(mins>0) return mins===1 ? '1 minute ago'   : mins+' minutes ago';
  if(mins<0) return (-mins)===1 ? '1 minute later' : (-mins)+' minutes later';
  return 'just now';
}

// Franja de aviso bajo el selector de línea
function renderDupHint(elId, title, detail){
  var el = document.getElementById(elId);
  if(!el) return;
  if(!title){ el.style.display='none'; el.innerHTML=''; return; }
  el.innerHTML = '<div class="dup-hint-title">'+title+'</div>'+
                 '<div class="dup-hint-detail">'+detail+'</div>';
  el.style.display = 'block';
}

// Modal genérico de aviso.
// opts: {title, detail, primaryLabel, onPrimary, secondaryLabel, onSecondary}
function showGuardModal(opts){
  var m = document.getElementById('dup-modal');
  if(!m){
    if(confirm(opts.title+'\n'+opts.detail+'\n\n'+(opts.secondaryLabel||'Continue')+'?')){
      if(opts.onSecondary) opts.onSecondary();
    } else if(opts.onPrimary) opts.onPrimary();
    return;
  }
  document.getElementById('dup-modal-title').textContent  = opts.title;
  document.getElementById('dup-modal-detail').textContent = opts.detail;
  document.getElementById('dup-modal-ask').textContent =
    opts.ask || 'Is this the right line for this check?';
  var pri = document.getElementById('dup-modal-primary');
  var sec = document.getElementById('dup-modal-secondary');
  pri.textContent = opts.primaryLabel   || 'Change line';
  sec.textContent = opts.secondaryLabel || 'Save anyway';
  pri.onclick = opts.onPrimary   || dupChangeLine;
  sec.onclick = opts.onSecondary || dupSaveAnyway;
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Aviso de línea duplicada — opts: {title, detail, commit, screen}
function showDupModal(opts){
  dupPending = {commit:opts.commit, screen:opts.screen};
  showGuardModal({
    title:opts.title, detail:opts.detail,
    primaryLabel:'Change line',  onPrimary:dupChangeLine,
    secondaryLabel:'Save anyway', onSecondary:dupSaveAnyway
  });
}

function closeDupModal(){
  var m = document.getElementById('dup-modal');
  if(m) m.style.display = 'none';
  document.body.style.overflow = '';
}

// "Change line" → cierra sin guardar y deja listo el selector de línea
function dupChangeLine(){
  var screen = dupPending ? dupPending.screen : 'screen-weight';
  dupPending = null;
  closeDupModal();
  var sel = document.querySelector('#'+screen+' select.line-select');
  if(sel){ sel.focus(); if(sel.scrollIntoView) sel.scrollIntoView({block:'center'}); }
}

function dupSaveAnyway(){
  var pending = dupPending;
  dupPending = null;
  closeDupModal();
  if(!pending) return;
  dupOverride = true;
  pending.commit();
}

// Nota que se agrega al Activity Log cuando se guardó pese al aviso
function dupOverrideNote(){
  if(!dupOverride) return '';
  dupOverride = false;
  return ' · saved over duplicate-line warning';
}
