// ===== AVISOS DE QA: LO QUE TOCA HACER EN EL TURNO Y SE ESTA PASANDO =====
// Pedido del usuario (20 nov 2026): que el telefono avise solo, con una
// notificacion de verdad, cuando falta:
//   - el GMP (1 por turno)
//   - las 3 temperaturas (principio, mitad y final del turno)
//   - los pesos de cada linea que corre (cada hora; a la hora y cuarto ya es tarde)
//   - el metal detector: una verificacion por SEMANA de cada linea que corrio.
//     Si se tomaron pesos en una linea (p. ej. la 1, que en 2o turno casi no
//     corre) y esa linea no tiene verificacion esta semana, se avisa.
//   - el Pre-Op del dia
//
// Este archivo es el UNICO que decide que avisar. Lo usan los dos lados:
//   - la app (js/core/avisos.js) mientras esta abierta, con lo que tiene en el equipo
//   - el servidor (functions/index.js, safetyReminders) cada 15 minutos, aunque
//     el telefono tenga la app cerrada
// Por eso no toca ni el DOM ni Firestore: recibe los registros y la hora, y
// devuelve la lista de avisos. Cada aviso trae una llave (k) que cambia con
// cada etapa: la misma llave no se manda dos veces.

(function(raiz, hacer){
  var m = hacer();
  if(typeof module === 'object' && module.exports) module.exports = m;
  else raiz.NX_AVISOS = m;
})(typeof self !== 'undefined' ? self : this, function(){

  // Horas de los turnos y tiempos. El administrador las cambia desde la app
  // (config/reminders); esto es lo de fabrica, sacado de lo que se captura de
  // verdad (2o turno: temperaturas ~4:30 PM, ~8:30 PM y ~11:45 PM).
  var DEF = {
    shifts: {'1': {start:'06:00', end:'14:30'}, '2': {start:'15:30', end:'00:30'}},
    preopShift: '2',          // el Pre-Op lo hace el 2o turno (Department 1945)
    weightDue: 60,            // a la hora toca pesar
    weightLate: 75,           // a la hora y cuarto ya es tarde
    weightEvery: 30,          // despues, cada media hora
    weightStop: 180           // 3 horas sin pesos: la linea ya paro, no se insiste
  };
  var TIPOS = ['weight', 'temp', 'gmp', 'metal', 'preop'];
  var PANTALLA = {weight:'screen-weight', temp:'screen-temp', gmp:'screen-gmp', metal:'screen-metal', preop:'screen-preop'};
  var CP = [['begin', 'Beginning'], ['mid', 'Middle'], ['end', 'End']];

  function hm(s){
    var m = /^(\d{1,2}):(\d{2})/.exec(String(s == null ? '' : s));
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function hora12(min){
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), mm = min % 60;
    return (h % 12 || 12) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  // Fechas 'YYYY-MM-DD' sin zona horaria: se cuentan en UTC para que el
  // cambio de horario no mueva el dia
  function diaMas(f, n){
    var p = String(f).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  }
  function diaSemana(f){
    var p = String(f).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();   // 0 = domingo
  }
  function lunes(f){ return diaMas(f, -((diaSemana(f) + 6) % 7)); }
  function turnoTxt(s){ return String(s) === '1' ? '1st shift' : '2nd shift'; }

  function config(c){
    c = c || {};
    var out = {}, k;
    for(k in DEF) out[k] = DEF[k];
    for(k in c) if(c[k] != null && k !== 'shifts') out[k] = c[k];
    out.shifts = {};
    ['1', '2'].forEach(function(s){
      var d = DEF.shifts[s], x = (c.shifts && c.shifts[s]) || {};
      out.shifts[s] = {start: hm(x.start) != null ? x.start : d.start, end: hm(x.end) != null ? x.end : d.end};
    });
    return out;
  }

  // En que turno cae esta hora: {shift, day (el dia de produccion), t (minutos
  // desde que empezo el turno), len, S, E}. Fuera de los dos turnos, null.
  // El 2o turno pasa la medianoche: a las 12:15 AM sigue siendo el dia de ayer.
  function turnoActual(fecha, min, cfg){
    cfg = config(cfg);
    var ss = ['1', '2'];
    for(var i = 0; i < ss.length; i++){
      var s = ss[i], S = hm(cfg.shifts[s].start), E = hm(cfg.shifts[s].end);
      var len = ((E - S) + 1440) % 1440 || 1440;
      var t = ((min - S) + 1440) % 1440;
      if(t < len) return {shift:s, day: min < S ? diaMas(fecha, -1) : fecha, t:t, len:len, S:S, E:E};
    }
    return null;
  }

  // La etapa: la ultima marca que ya se paso (-1 = todavia no toca)
  function etapa(t, marcas){
    var e = -1;
    for(var i = 0; i < marcas.length; i++) if(t >= marcas[i]) e = i;
    return e;
  }
  function lineasTxt(l){ return (l.length === 1 ? 'Line ' : 'Lines ') + l.join(', '); }
  function numLinea(v){ var m = /\d+/.exec(String(v == null ? '' : v)); return m ? m[0] : ''; }

  // D = {weights, temps, gmps, preop, metal, runs}: los registros tal como los
  // guarda la app. Devuelve [{k, tipo, tag, title, body, screen, mod}].
  function pendientes(D, ctx, cfg){
    cfg = config(cfg);
    if(!ctx) return [];
    D = D || {};
    var s = String(ctx.shift), day = ctx.day, cruza = ctx.E <= ctx.S;
    var rel = function(hora){ var x = hm(hora); return x == null ? null : ((x - ctx.S) + 1440) % 1440; };
    var deEste = function(r){ return String(r.date || '').slice(0, 10) === day && (r.shift == null || String(r.shift) === s); };
    var out = [];
    var aviso = function(tipo, k, tag, title, body){
      out.push({k:k, tipo:tipo, tag:tag, title:title, body:body, screen:PANTALLA[tipo], mod:'qa'});
    };

    // ---- Pesos: la ultima revision de cada linea que corre en este turno ----
    var lineas = {};
    (D.weights || []).forEach(function(w){
      if(String(w.shift) !== s) return;
      var f = String(w.date || '').slice(0, 10), hora = w.time || String(w.date || '').slice(11, 16);
      var x = hm(hora);
      if(x == null) return;
      var es = f === day || (cruza && f === diaMas(day, 1) && x < ctx.E);
      if(!es) return;
      var r = rel(hora);
      if(r > ctx.t + 5) return;                        // una hora en el futuro: no es de este turno
      var L = numLinea(w.line);
      if(!L) return;
      if(!lineas[L]) lineas[L] = {ultimo:r, primero:r};
      lineas[L].ultimo = Math.max(lineas[L].ultimo, r);
      lineas[L].primero = Math.min(lineas[L].primero, r);
    });
    // Todas las lineas en UN aviso: con dos lineas corriendo eran el doble de
    // notificaciones. Vuelve a sonar cuando la linea mas atrasada sube de
    // etapa (a lo mucho cada media hora) o cuando esa linea ya se peso y otra
    // sigue pendiente; una linea que se suma a la lista no lo hace sonar solo.
    var marcasW = [cfg.weightDue, cfg.weightLate];
    for(var m = cfg.weightLate + cfg.weightEvery; m < cfg.weightStop; m += cfg.weightEvery) marcasW.push(m);
    var tocan = [], tarde = false, peor = null;
    Object.keys(lineas).sort().forEach(function(L){
      var u = lineas[L].ultimo, pasa = ctx.t - u;
      if(pasa < cfg.weightDue || pasa >= cfg.weightStop) return;
      var x = {L:L, u:u, e:etapa(pasa, marcasW), pasa:pasa};
      if(x.e > 0) tarde = true;
      if(!peor || x.pasa > peor.pasa) peor = x;
      tocan.push(x);
    });
    if(tocan.length){
      aviso('weight', 'w|' + day + '|' + s + '|' + peor.e + '|' + peor.L + ':' + peor.u, 'nx-w',
        (tarde ? 'Weights overdue · ' : 'Weights due · ') + lineasTxt(tocan.map(function(x){ return x.L; })),
        tocan.map(function(x){ return 'Line ' + x.L + ': last check ' + hora12(ctx.S + x.u) + ' (' + x.pasa + ' min)'; }).join(' · '));
    }
    // Lineas en el Production Schedule de este turno que aun no tienen pesos
    var prog = {};
    (D.runs || []).forEach(function(r){
      if(r.cancelled || String(r.date || '').slice(0, 10) !== day || String(r.shift) !== s) return;
      var L = numLinea(r.line);
      if(L && !lineas[L]) prog[L] = 1;
    });
    var sinPeso = Object.keys(prog).sort(), ef = etapa(ctx.t, [90, 120]);
    if(sinPeso.length && ef >= 0){
      aviso('weight', 'wf|' + day + '|' + s + '|' + sinPeso.join(',') + '|' + ef, 'nx-wf',
        'Weights · ' + lineasTxt(sinPeso), 'Scheduled for ' + turnoTxt(s) + ' and no weight check yet');
    }

    // Lo demas (temperaturas, GMP, Pre-Op) solo si el turno trabaja: algo
    // programado en el Schedule o algo ya capturado. Un sabado sin produccion
    // no debe pedir temperaturas.
    var trabaja = Object.keys(lineas).length > 0 || Object.keys(prog).length > 0 ||
      (D.temps || []).some(deEste) || (D.gmps || []).some(deEste);

    // ---- Temperaturas: principio, mitad y final ----
    var temps = (D.temps || []).filter(deEste);
    var len = ctx.len, mitad = Math.round(len / 2);
    // En la practica (2o turno) se toman ~4:30-5:20, ~8:30-9:45 y ~11:10-12:30:
    // el aviso sale cuando ya se esta pasando, no antes de que toque.
    var marcasCp = {begin:[90, 135], mid:[mitad + 30, mitad + 75], end:[len - 45, len - 15]};
    if(trabaja) CP.forEach(function(cp){
      if(temps.some(function(r){ return r.checkpoint === cp[0]; })) return;
      var e = etapa(ctx.t, marcasCp[cp[0]]);
      if(e < 0) return;
      aviso('temp', 't|' + day + '|' + s + '|' + cp[0] + '|' + e, 'nx-t-' + cp[0],
        'Temperature · ' + cp[1], cp[1] + ' checkpoint not recorded for ' + turnoTxt(s));
    });

    // ---- GMP: uno por turno ----
    if(trabaja && !(D.gmps || []).some(deEste)){
      var eg = etapa(ctx.t, [120, len - 90]);
      if(eg >= 0) aviso('gmp', 'g|' + day + '|' + s + '|' + eg, 'nx-gmp',
        'GMP audit pending', 'One per shift · not recorded yet for ' + turnoTxt(s));
    }

    // ---- Pre-Op: el del dia, de lunes a sabado, en su turno ----
    if(trabaja && s === String(cfg.preopShift) && diaSemana(day) !== 0 &&
       !(D.preop || []).some(function(r){ return String(r.date || '').slice(0, 10) === day; })){
      var ep = etapa(ctx.t, [15, 120]);
      if(ep >= 0) aviso('preop', 'p|' + day + '|' + ep, 'nx-preop',
        'Pre-Op inspection', 'Today’s Pre-Op is not recorded yet');
    }

    // ---- Metal detector: una verificacion por semana de cada linea que corrio ----
    var ini = lunes(day), hechas = {};
    (D.metal || []).forEach(function(r){
      var f = String(r.date || '').slice(0, 10);
      if(f >= ini && f <= diaMas(day, 1)) hechas[numLinea(r.line)] = 1;
    });
    // Un aviso por turno con las lineas que faltan, cuando ya arrancaron todas
    // (2 1/2 horas despues de empezar); una linea que arranca despues lo
    // repite a la media hora de su primer peso.
    var faltaMd = Object.keys(lineas).sort().filter(function(L){
      return !hechas[L] && ctx.t >= Math.max(150, lineas[L].primero + 30);
    });
    if(faltaMd.length){
      aviso('metal', 'm|' + day + '|' + s + '|' + faltaMd.join(','), 'nx-md',
        'Metal detector · ' + lineasTxt(faltaMd),
        (faltaMd.length === 1 ? 'Line ' + faltaMd[0] + ' ran' : 'These lines ran') +
        ' this week with no verification yet (one per line, per week)');
    }

    return out;
  }

  return {DEF:DEF, TIPOS:TIPOS, config:config, turnoActual:turnoActual, pendientes:pendientes,
          hm:hm, hora12:hora12, diaMas:diaMas, lunes:lunes, turnoTxt:turnoTxt};
});
