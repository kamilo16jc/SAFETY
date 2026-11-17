// ===== OPERATIONS › ATTENDANCE =====
// La hoja del dia y turno: cada empleado activo de ese turno con su estado
// (P L E A X), la hora de entrada y salida y una nota. Se marca con un clic;
// el registro se crea al marcar. La lista de empleados se arma aqui mismo
// (tarjeta "Employees") y vive solo en Firestore.
//
// Linea (pedido del usuario, 17 nov 2026: "agrega las lines para identificar
// donde trabaja ese operador"): cada empleado tiene su linea fija (Line 1-6 o
// Chopped area) y la hoja del dia la propone; si ese dia lo mueven, se cambia
// en su fila y queda en el registro del dia (attendance.line).

var ATT_STATUS = [
  {k:'present', label:'Present',    short:'P', tono:'ok'},
  {k:'late',    label:'Late',       short:'L', tono:'warn'},
  {k:'left',    label:'Left early', short:'E', tono:'warn'},
  {k:'absent',  label:'Absent',     short:'A', tono:'bad'},
  {k:'excused', label:'Excused',    short:'X', tono:'soft'}
];
var ATT_AREAS = ['Production', 'Packaging', 'Sanitation', 'Warehouse', 'Maintenance', 'Shipping'];
var attView = 'day';

function attStatus(k){ return ATT_STATUS.filter(function(s){ return s.k === k; })[0] || null; }
function getEmployees(){ return opsLista('employees'); }
function attEmp(id){ return opsBuscar('employees', id); }
function attNombreKey(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function attTurnoTxt(s){ return s === 'any' ? 'Both' : s === '2' ? '2nd' : '1st'; }
// Por area (Line 2 antes que Line 10) y los que no tienen area al final
function attCmpArea(a, b){
  var x = String(a || '').trim(), y = String(b || '').trim();
  if(!x !== !y) return x ? -1 : 1;
  return x.localeCompare(y, undefined, {numeric:true});
}
// Orden de las lineas: 1..6, Chopped area y al final los que no tienen
function attLineaOrden(v){
  v = String(v || '');
  if(!v) return 999;
  if(v === OPS_CHOPPED) return 500;
  return parseInt(v, 10) || 600;
}
// La linea de un registro del dia: la que se le puso ese dia, o la fija del empleado
function attLineaDe(r, e){
  if(r && r.line != null) return String(r.line);
  e = e || (r ? attEmp(r.employeeId) : null);
  return String((e && e.line) || '');
}
function attHorasMin(r){ return r ? opsMinutos(r.timeIn, r.timeOut) : null; }
// Llego a trabajar (aunque tarde o se fuera antes)
function attVino(r){ return !!r && (r.status === 'present' || r.status === 'late' || r.status === 'left'); }

function initAttendance(){
  opsInitFiltro('att');
  attConstruir();
  attListas();
  renderAttendance();
}
function attAplicar(){ opsAplicar('att', renderAttendance); }
function setAttView(v){ attView = v; renderAttendance(); }

function attListas(){
  var l = document.getElementById('att-emp-list');
  if(l) l.innerHTML = getEmployees().filter(function(e){ return e.active !== false; })
    .map(function(e){ return '<option value="'+esc(e.name)+'">'+esc((e.line ? opsLineaTxt(e.line)+' · ' : '')+(e.empNo ? '#'+e.empNo+' · ' : '')+(e.area || ''))+'</option>'; }).join('');
  var a = document.getElementById('att-area-list');
  if(a){
    var vistas = {}, out = [];
    ATT_AREAS.concat(getEmployees().map(function(e){ return e.area; })).forEach(function(x){
      x = String(x || '').trim();
      if(x && !vistas[x.toLowerCase()]){ vistas[x.toLowerCase()] = 1; out.push(x); }
    });
    a.innerHTML = out.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('');
  }
}

// ===== EL ESQUELETO: la hoja del dia y la lista de empleados =====
function attConstruir(){
  var host = document.getElementById('att-sheet');
  if(!host || document.getElementById('att-body')) return;
  var turnos = '<option value="1">1st</option><option value="2">2nd</option><option value="any">Both</option>';
  host.innerHTML =
    '<div id="att-day"><div class="sheet-wrap"><table class="sheet ops-sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Employee</th><th>Emp #</th><th>Line</th><th>Area</th><th>Status</th>'+
      '<th>In</th><th>Out</th><th class="num">Hours</th><th class="wide">Notes</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="att-new"><tr class="newrow">'+
      '<td class="rn">New</td>'+
      '<td colspan="2"><input class="cell" id="att-n-name" list="att-emp-list" placeholder="Someone not on this list (another shift, new)" '+
        'autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();attAgregar();}"></td>'+
      '<td><select class="cell" id="att-n-line" aria-label="Line">'+opsLineOptions('', 'Line', true)+'</select></td>'+
      '<td class="soft"></td>'+
      '<td><select class="cell" id="att-n-status">'+ATT_STATUS.map(function(s){ return '<option value="'+s.k+'">'+s.label+'</option>'; }).join('')+'</select></td>'+
      '<td colspan="4" class="soft">Each employee of the shift is listed below: tap a letter to mark them</td>'+
      '<td><button class="sheet-btn" onclick="attAgregar()">Add</button></td>'+
    '</tr></tbody>'+
    '<tbody id="att-body"></tbody></table></div></div>'+
    '<div id="att-roster" hidden><div class="sheet-wrap"><table class="sheet ops-sheet"><thead><tr>'+
      '<th class="rn">#</th><th>Name</th><th>Emp #</th><th>Shift</th><th>Line</th><th>Area</th><th>Active</th><th></th>'+
    '</tr></thead>'+
    '<tbody id="att-rnew"><tr class="newrow">'+
      '<td class="rn">New</td>'+
      '<td><input class="cell" id="att-r-name" placeholder="Full name" autocomplete="off" '+
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();attEmpAgregar();}"></td>'+
      '<td><input class="cell ops-short" id="att-r-no" placeholder="Emp #" autocomplete="off"></td>'+
      '<td><select class="cell" id="att-r-shift">'+turnos+'</select></td>'+
      '<td><select class="cell" id="att-r-line" aria-label="Line">'+opsLineOptions('', '—', true)+'</select></td>'+
      '<td><input class="cell" id="att-r-area" list="att-area-list" placeholder="Area" autocomplete="off" '+
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();attEmpAgregar();}"></td>'+
      '<td class="soft">—</td>'+
      '<td><button class="sheet-btn" onclick="attEmpAgregar()">Add</button></td>'+
    '</tr></tbody>'+
    '<tbody id="att-rbody"></tbody></table></div></div>';
}

// ===== LAS FILAS DEL DIA =====
// Los activos de ese turno + quien ya tiene marca ese dia (de otro turno, o
// dado de baja despues)
function attFilas(f){
  var recs = opsDelDia('attendance', f);
  var porEmp = {};
  recs.forEach(function(r){ porEmp[String(r.employeeId)] = r; });
  var vistos = {}, filas = [];
  getEmployees().forEach(function(e){
    if(e.active === false) return;
    if(!(String(e.shift) === String(f.shift) || e.shift === 'any')) return;
    vistos[String(e.id)] = 1;
    filas.push({e:e, r:porEmp[String(e.id)] || null});
  });
  recs.forEach(function(r){
    var k = String(r.employeeId);
    if(vistos[k]) return;
    vistos[k] = 1;
    filas.push({e: attEmp(r.employeeId) || {id:r.employeeId, name:r.name, empNo:r.empNo, area:r.area, line:r.line}, r:r, fuera:true});
  });
  return filas.sort(function(a, b){
    return (attLineaOrden(attLineaDe(a.r, a.e)) - attLineaOrden(attLineaDe(b.r, b.e))) ||
      attCmpArea(a.e.area, b.e.area) || String(a.e.name || '').localeCompare(String(b.e.name || ''), undefined, {numeric:true});
  });
}
function attConteo(filas){
  var c = {total: filas.length, sin: 0, vino: 0};
  ATT_STATUS.forEach(function(s){ c[s.k] = 0; });
  filas.forEach(function(x){
    var st = x.r && x.r.status;
    if(!st) c.sin++;
    else { c[st] = (c[st] || 0) + 1; if(attVino(x.r)) c.vino++; }
  });
  return c;
}

function renderAttendance(){
  attConstruir();
  var f = opsFiltro('att');
  var day = document.getElementById('att-day'), ros = document.getElementById('att-roster');
  if(day) day.hidden = attView !== 'day';
  if(ros) ros.hidden = attView !== 'roster';
  var filas = attFilas(f);
  var c = attConteo(filas);
  var activos = getEmployees().filter(function(e){ return e.active !== false; }).length;
  var kp = document.getElementById('att-kpis');
  if(kp){
    kp.innerHTML =
      kpiCard(c.vino+(c.total ? ' / '+c.total : ''), 'at work', {tono:'ok', icono:'check', on:attView === 'day', click:"setAttView('day')"}) +
      kpiCard(c.late + c.left, 'late or left early', {tono:'warn', icono:'clock', click:"setAttView('day')"}) +
      kpiCard(c.absent, 'absent', {tono:'bad', icono:'ban', click:"setAttView('day')"}) +
      kpiCard(c.sin, 'not marked', {tono:'bad', icono:'alert', click:"setAttView('day')"}) +
      kpiCard(activos, 'employees', {icono:'user', on:attView === 'roster', click:"setAttView('roster')"});
    renderIcons(kp);
  }
  if(attView === 'roster') return renderAttRoster();
  var body = document.getElementById('att-body');
  if(!body) return;
  if(!filas.length){
    body.innerHTML = '<tr><td colspan="11" class="sheet-empty" style="border:0">'+
      (getEmployees().length ? 'Nobody is on the '+opsTurno(f.shift)+' list. Open Employees to set each person’s shift.'
                             : 'No employees yet. Open the Employees card and add the people of each shift.')+'</td></tr>';
    return;
  }
  body.innerHTML = filas.map(function(x, i){ return attFilaHTML(x, i + 1); }).join('');
  renderIcons(body);
}

function attFilaHTML(x, i){
  var e = x.e, r = x.r, id = String(e.id).replace(/'/g, '');
  var st = r && r.status;
  var botones = ATT_STATUS.map(function(s){
    return '<button type="button" class="att-b '+s.tono+(st === s.k ? ' on' : '')+'" data-tip="'+s.label+'" '+
      'aria-label="'+s.label+'" aria-pressed="'+(st === s.k)+'" onclick="attMarcar(\''+id+'\',\''+s.k+'\')">'+s.short+'</button>';
  }).join('');
  var min = attHorasMin(r);
  return '<tr'+(st ? '' : ' class="att-pend"')+'>'+
    '<td class="rn">'+i+'</td>'+
    '<td class="code">'+esc(e.name || '—')+(x.fuera ? ' <span class="tag">'+(e.active === false ? 'inactive' : 'other shift')+'</span>' : '')+'</td>'+
    '<td class="soft">'+esc(e.empNo || '—')+'</td>'+
    '<td><select class="cell'+(r && r.line != null && String(r.line) !== String(e.line || '') ? ' att-moved' : '')+'" aria-label="Line of '+esc(e.name)+' this day" '+
      'onchange="attCampo(\''+id+'\',\'line\',this)">'+opsLineOptions(attLineaDe(r, e), '—', true)+'</select></td>'+
    '<td class="soft">'+esc(e.area || '—')+'</td>'+
    '<td><div class="att-st">'+botones+'</div></td>'+
    '<td><input type="time" class="cell ops-time" value="'+esc(r && r.timeIn || '')+'" aria-label="Time in" onchange="attCampo(\''+id+'\',\'timeIn\',this)"></td>'+
    '<td><input type="time" class="cell ops-time" value="'+esc(r && r.timeOut || '')+'" aria-label="Time out" onchange="attCampo(\''+id+'\',\'timeOut\',this)"></td>'+
    '<td class="num">'+(min == null ? '—' : opsHoras(min))+'</td>'+
    '<td class="wide"><input class="cell" value="'+esc(r && r.notes || '')+'" placeholder="Note" aria-label="Note" onchange="attCampo(\''+id+'\',\'notes\',this)"></td>'+
    '<td class="acts">'+(r ? '<button class="run-del" type="button" title="Clear the mark" aria-label="Clear the mark of '+esc(e.name)+'" onclick="attQuitar(\''+id+'\')"><span data-icon="close"></span></button>' : '')+'</td>'+
  '</tr>';
}

// ---- Marcar ----
function attRegistro(empId, f, crear){
  var r = opsDelDia('attendance', f).filter(function(x){ return String(x.employeeId) === String(empId); })[0] || null;
  if(r || !crear) return {r:r, nuevo:false};
  var e = attEmp(empId) || {};
  r = {id:newRecordId(), date:f.date, shift:String(f.shift), employeeId:e.id != null ? e.id : empId,
       name:e.name || '', empNo:e.empNo || '', area:e.area || '', line:String(e.line || ''), status:'', timeIn:'', timeOut:'', notes:'',
       createdAt:localISOStr(), createdBy:opsQuien()};
  return {r:r, nuevo:true};
}
function attMarcar(empId, k){
  var f = opsFiltro('att');
  var x = attRegistro(empId, f, true);
  if(!x.nuevo && x.r.status === k) return;
  x.r.status = k;
  opsGuardar('attendance', x.r, x.nuevo);
  opsRepintar('screen-attendance', renderAttendance);
}
function attCampo(empId, campo, el){
  var f = opsFiltro('att');
  var v = String(el.value || '').trim();
  var x = attRegistro(empId, f, v !== '' || campo === 'line');
  if(!x.r) return;
  if(x.nuevo && (campo === 'timeIn' || campo === 'timeOut')) x.r.status = 'present';
  if(!x.nuevo && x.r[campo] === v) return;
  x.r[campo] = v;
  opsGuardar('attendance', x.r, x.nuevo);
  opsRepintar('screen-attendance', renderAttendance);
}
function attQuitar(empId){
  var x = attRegistro(empId, opsFiltro('att'), false);
  if(!x.r) return;
  if(!opsPuedeBorrar()) return;
  opsBorrar('attendance', x.r.id);
  opsRepintar('screen-attendance', renderAttendance);
}
// Todos los que no tienen marca, presentes
function attTodosPresentes(){
  var f = opsFiltro('att');
  var faltan = attFilas(f).filter(function(x){ return !(x.r && x.r.status); });
  if(!faltan.length){ toast('Everyone already has a mark'); return; }
  if(!confirm('Mark '+faltan.length+' employee(s) without a mark as Present?')) return;
  faltan.forEach(function(x){
    var y = attRegistro(x.e.id, f, true);
    y.r.status = 'present';
    opsGuardar('attendance', y.r, y.nuevo);
  });
  opsLog('Attendance marked', faltan.length+' present · '+opsFechaTxt(f.date)+' · '+opsTurno(f.shift));
  opsRepintar('screen-attendance', renderAttendance);
  toast(faltan.length+' marked present');
}
// Alguien que no esta en la lista del turno (de otro turno o nuevo)
function attAgregar(){
  var inp = document.getElementById('att-n-name');
  var nombre = String(inp && inp.value || '').trim();
  if(!nombre){ toast('Write the employee name'); return; }
  var f = opsFiltro('att');
  var e = getEmployees().filter(function(x){
    return attNombreKey(x.name) === attNombreKey(nombre) || (x.empNo && String(x.empNo) === nombre);
  })[0];
  if(!e){
    if(!confirm(nombre+' is not on the employee list. Add them to the list ('+opsTurno(f.shift)+')?')) return;
    e = {id:newRecordId(), name:nombre, empNo:'', shift:String(f.shift), line:(document.getElementById('att-n-line') || {}).value || '',
         area:'', active:true, createdAt:localISOStr(), createdBy:opsQuien()};
    opsGuardar('employees', e, true);
    opsLog('Employee added', nombre);
    attListas();
  }
  var x = attRegistro(e.id, f, true);
  if(!x.nuevo && x.r.status){ toast(e.name+' is already on this sheet'); return; }
  x.r.status = (document.getElementById('att-n-status') || {}).value || 'present';
  var lnN = (document.getElementById('att-n-line') || {}).value || '';
  if(lnN) x.r.line = lnN;
  opsGuardar('attendance', x.r, x.nuevo);
  inp.value = '';
  var selN = document.getElementById('att-n-line'); if(selN) selN.value = '';
  opsRepintar('screen-attendance', renderAttendance);
  toast(e.name+' · '+attStatus(x.r.status).label);
}

// ===== LA LISTA DE EMPLEADOS =====
function renderAttRoster(){
  var body = document.getElementById('att-rbody');
  if(!body) return;
  var l = getEmployees().slice().sort(function(a, b){
    return ((a.active === false) - (b.active === false)) ||
      String(a.shift).localeCompare(String(b.shift)) ||
      (attLineaOrden(a.line) - attLineaOrden(b.line)) ||
      attCmpArea(a.area, b.area) ||
      String(a.name || '').localeCompare(String(b.name || ''), undefined, {numeric:true});
  });
  if(!l.length){
    body.innerHTML = '<tr><td colspan="8" class="sheet-empty" style="border:0">No employees yet. Add each person in the top row with their shift, line and area.</td></tr>';
    return;
  }
  body.innerHTML = l.map(function(e, i){
    var id = String(e.id).replace(/'/g, '');
    var sel = function(v, t){ return '<option value="'+v+'"'+(String(e.shift) === v ? ' selected' : '')+'>'+t+'</option>'; };
    return '<tr'+(e.active === false ? ' class="att-off"' : '')+'>'+
      '<td class="rn">'+(i + 1)+'</td>'+
      '<td><input class="cell" value="'+esc(e.name || '')+'" aria-label="Name" onchange="attEmpCampo(\''+id+'\',\'name\',this)"></td>'+
      '<td><input class="cell ops-short" value="'+esc(e.empNo || '')+'" aria-label="Employee number" onchange="attEmpCampo(\''+id+'\',\'empNo\',this)"></td>'+
      '<td><select class="cell" aria-label="Shift" onchange="attEmpCampo(\''+id+'\',\'shift\',this)">'+sel('1', '1st')+sel('2', '2nd')+sel('any', 'Both')+'</select></td>'+
      '<td><select class="cell" aria-label="Line" onchange="attEmpCampo(\''+id+'\',\'line\',this)">'+opsLineOptions(e.line || '', '—', true)+'</select></td>'+
      '<td><input class="cell" list="att-area-list" value="'+esc(e.area || '')+'" aria-label="Area" onchange="attEmpCampo(\''+id+'\',\'area\',this)"></td>'+
      '<td><button class="cell-tog'+(e.active === false ? '' : ' on')+'" onclick="attEmpActivo(\''+id+'\')">'+(e.active === false ? 'Inactive' : '✓ Active')+'</button></td>'+
      '<td class="acts"><button class="run-del" type="button" title="Delete" aria-label="Delete '+esc(e.name)+'" onclick="attEmpBorrar(\''+id+'\')"><span data-icon="close"></span></button></td>'+
    '</tr>';
  }).join('');
  renderIcons(body);
}
function attEmpAgregar(){
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  var nombre = g('att-r-name');
  if(!nombre){ toast('Write the employee name'); return; }
  var repetido = getEmployees().filter(function(x){ return attNombreKey(x.name) === attNombreKey(nombre); })[0];
  if(repetido && !confirm(nombre+' is already on the list. Add another person with the same name?')) return;
  var e = {id:newRecordId(), name:nombre, empNo:g('att-r-no'), shift:g('att-r-shift') || '1', line:g('att-r-line'), area:g('att-r-area'),
           active:true, createdAt:localISOStr(), createdBy:opsQuien()};
  opsGuardar('employees', e, true);
  opsLog('Employee added', nombre+' · '+attTurnoTxt(e.shift)+' shift'+(e.line ? ' · '+opsLineaTxt(e.line) : ''));
  ['att-r-name', 'att-r-no'].forEach(function(id){ var x = document.getElementById(id); if(x) x.value = ''; });
  attListas();
  opsRepintar('screen-attendance', renderAttendance);
  var n = document.getElementById('att-r-name'); if(n) n.focus();
  toast(nombre+' added');
}
function attEmpCampo(id, campo, el){
  var e = attEmp(id);
  if(!e) return;
  var v = String(el.value || '').trim();
  if(campo === 'name' && !v){ el.value = e.name || ''; toast('The name cannot be empty'); return; }
  if(String(e[campo] || '') === v) return;
  e[campo] = v;
  opsGuardar('employees', e, false);
  attListas();
  opsRepintar('screen-attendance', renderAttendance);
}
function attEmpActivo(id){
  var e = attEmp(id);
  if(!e) return;
  e.active = e.active === false;
  opsGuardar('employees', e, false);
  opsRepintar('screen-attendance', renderAttendance);
  toast(e.name+(e.active ? ' is active again' : ' is inactive: no longer listed on the daily sheet'));
}
function attEmpBorrar(id){
  var e = attEmp(id);
  if(!e || !opsPuedeBorrar()) return;
  if(!confirm('Delete '+e.name+' from the list? Their attendance records stay. To keep them on file, set them Inactive instead.')) return;
  opsBorrar('employees', id);
  opsLog('Employee deleted', e.name);
  attListas();
  opsRepintar('screen-attendance', renderAttendance);
}

// ===== REPORTE DEL DIA =====
function attFilasReporte(f){
  return attFilas(f).map(function(x){
    var r = x.r, s = r && attStatus(r.status), min = attHorasMin(r);
    return [x.e.name || '', x.e.empNo || '', opsLineaTxt(attLineaDe(r, x.e)), x.e.area || '', s ? s.label : 'Not marked',
            opsHora12(r && r.timeIn), opsHora12(r && r.timeOut), min == null ? '' : opsHoras(min), r && r.notes || ''];
  });
}
function attDayPdf(){
  var f = opsFiltro('att');
  var c = attConteo(attFilas(f));
  return opsPdf({
    title: 'Attendance', sub: opsFechaTxt(f.date)+' · '+opsTurno(f.shift),
    file: 'Attendance_'+f.date+'_shift'+f.shift+'.pdf',
    sections: [{
      title: 'Employees',
      kpis: [['At work', c.vino+' of '+c.total], ['Late', c.late], ['Left early', c.left], ['Absent', c.absent], ['Excused', c.excused], ['Not marked', c.sin]],
      cols: [{h:'Employee', w:44}, {h:'Emp #', w:15}, {h:'Line', w:20}, {h:'Area', w:22}, {h:'Status', w:20}, {h:'In', w:15}, {h:'Out', w:15}, {h:'Hours', w:13, al:'right'}, {h:'Notes', w:60}],
      rows: attFilasReporte(f), empty: 'No employees on this shift'
    }]
  });
}
function attDayExcel(){
  var f = opsFiltro('att');
  var filas = attFilasReporte(f);
  if(!filas.length){ toast('Nothing to export'); return; }
  downloadSheet('attendance-'+f.date+'-shift'+f.shift+'.xlsx',
    [['Date', 'Shift', 'Employee', 'Emp #', 'Line', 'Area', 'Status', 'In', 'Out', 'Hours', 'Notes']].concat(filas.map(function(r){
      return [f.date, opsTurno(f.shift)].concat(r);
    })), 'Attendance');
}
