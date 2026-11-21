// ===== EL ASISTENTE: ENTENDER LA PREGUNTA =====
// Convierte lo que escribe la persona (español o inglés) en la orden fija de
// js/modules/agente-fuentes.js. Fase 1: con reglas y sinonimos, sin internet.
// Fase 2: si esto no entiende, una IA traducira la pregunta (con los datos
// tapados) a la MISMA orden; nunca vera un registro.
//
// agEntender(texto) -> {entendido, tipo, fuente, accion, filtros, campo, limite, lang, ...}
//   tipo: consulta | pendientes | lot | traza | abrir | ayuda

// ---- De que modulo habla (sinonimos ya sin acentos ni mayusculas) ----
var AG_SIN = {
  weights:   ['peso', 'pesos', 'pesaje', 'pesajes', 'pesada', 'pesadas', 'weight', 'weights', 'weighing', 'weight check', 'weight checks', 'revision de peso', 'revisiones de peso'],
  seals:     ['seal', 'seals', 'sello', 'sellos', 'sellado', 'sellados', 'bag seal', 'bag seals', 'seal bags', 'dunk tank'],
  temps:     ['temperatura', 'temperaturas', 'temp', 'temps', 'temperature', 'temperatures', 'checkpoint', 'checkpoints', 'humedad relativa', 'humidity'],
  gmps:      ['gmp', 'gmps', 'auditoria gmp', 'auditorias gmp', 'gmp audit', 'gmp audits', 'auditoria', 'auditorias', 'audit', 'audits'],
  metal:     ['metal detector', 'metal detectors', 'detector de metales', 'detector de metal', 'detectores de metal', 'detector', 'detectores', 'metal', 'md'],
  preop:     ['pre op', 'preop', 'pre-op', 'pre operacional', 'preoperacional', 'pre operational', 'pre-operational', 'inspeccion pre op'],
  capa:      ['capa', 'capas', 'accion correctiva', 'acciones correctivas', 'corrective action', 'corrective actions'],
  holds:     ['hold', 'holds', 'retenido', 'retenidos', 'retencion', 'retenciones', 'hold case', 'hold cases', 'producto retenido'],
  shifts:    ['shift report', 'shift reports', 'reporte de turno', 'reportes de turno', 'reporte del turno', 'reportes del turno', 'novedad', 'novedades', 'incidente', 'incidentes'],
  runs:      ['schedule', 'production schedule', 'programacion', 'programa de produccion', 'corrida', 'corridas', 'programado', 'programados', 'programada', 'programo', 'se programo', 'scheduled', 'run', 'runs', 'lab samples', 'muestras de lab', 'muestras para el lab',
              'corrio', 'se corrio', 'corrieron', 'se corrieron', 'corriendo', 'se corre', 'ran', 'running', 'was run', 'recoger', 'recogidas', 'recogida', 'collected', 'collect'],
  plates:    ['placa', 'placas', 'plate', 'plates', 'yeast and mold', 'levaduras y mohos', 'lectura de placas', 'leer placas', 'leer las placas', 'incubadora', 'incubando', 'incubating'],
  analysis:  ['analisis', 'sample analysis', 'analisis de muestra', 'analisis de muestras', 'muestra', 'muestras', 'sample', 'samples', 'humedad', 'grasa', 'ph', 'moisture', 'fat', 'yeast', 'mold', 'levadura', 'levaduras', 'moho', 'mohos', 'coa', 'coas', 'certificado', 'certificados', 'lab result', 'lab results', 'resultado de laboratorio', 'resultados de laboratorio'],
  raw:       ['raw', 'raw analysis', 'analisis raw', 'analisis de raw', 'materia prima', 'materias primas', 'raw material', 'raw materials'],
  orders:    ['coa order', 'coa orders', 'orden de coa', 'ordenes de coa', 'ordenes', 'orders', 'pedido', 'pedidos'],
  attendance:['asistencia', 'attendance', 'falto', 'faltaron', 'faltas', 'ausente', 'ausentes', 'absent', 'absences', 'tardanza', 'tardanzas', 'llego tarde', 'llegaron tarde', 'quien vino', 'who came'],
  output:    ['output', 'produccion', 'producido', 'producida', 'produjo', 'produjeron', 'cajas', 'cases', 'libras producidas', 'produced', 'how much was made', 'cuanto se hizo',
              'se hizo', 'se hicieron', 'hicieron', 'se produjo', 'made', 'was made', 'were made'],
  downtime:  ['downtime', 'paro', 'paros', 'parada', 'paradas', 'parado', 'linea parada', 'lineas paradas', 'stop', 'stops', 'line stop', 'line down', 'tiempo muerto'],
  employees: ['empleado', 'empleados', 'employee', 'employees', 'trabajador', 'trabajadores', 'personal', 'roster'],
  products:  ['catalogo', 'catalog', 'especificacion', 'especificaciones', 'spec', 'specs', 'bolsas por caja', 'bags per case',
              'rango de peso', 'weight range', 'target', 'tamano', 'tamano de bolsa', 'bag size', 'formato de lot', 'lot format']
};
// Si empatan, gana la que va primero
var AG_ORDEN = ['metal', 'preop', 'gmps', 'seals', 'temps', 'weights', 'capa', 'holds', 'shifts', 'attendance', 'downtime', 'output', 'orders', 'raw', 'plates', 'analysis', 'runs', 'employees', 'products'];

// ---- Palabras mal escritas ----
// "analisyis" -> "analisis", "verificasion" -> "verificacion", "temperatras"
// -> "temperaturas". Se compara cada palabra con el vocabulario del asistente
// (misma primera letra; 1 letra de diferencia, 2 en palabras largas). Las que
// ya son palabras comunes no se tocan.
var AG_COMUNES = ('cual cuales cuando donde dame datos dato fueron todos todas tiene tienen hubo esta este estos estas para sobre desde hasta entre ' +
  'resultado resultados result results which what when where show give have with from that this there were about check checks ' +
  'verificacion verificaciones verifico chequeo chequeos hecho hizo hicimos registro registros informacion info sabes quiero necesito ' +
  'please porfavor favor puedes podrias dime decir saber como estan estuvo estuvieron cuantos cuantas cuanto mucho mucha muchos ' +
  'algun alguna algunos ninguno nada todo cada otro otra otros mismo misma tiempo minutos horas semana semanas mes meses ' +
  'analisis analisys ultimo ultima ultimos ultimas linea lineas turno turnos producto productos cliente clientes orden ordenes ' +
  'quien quienes porque tambien solo sola only also just more less than then them they their your mine your ' +
  'prueba pruebas test tests laboratorio lab testeo testeado testeada vencimiento especificacion especificaciones ' +
  // palabras de todos los dias que se parecen a otras del asistente: NUNCA se corrigen
  'falta faltan faltaba faltaria toca tocan queda quedan hace hacer tiene pasa paso pasaron pasado dime sabes fueron sera seria ' +
  'last least list past next many much does done made make tell need needs want were what with would could should each every ' +
  'first second third some none other others again still since until after before during over under into those these ' +
  'line lines shift shifts today week weeks month months year years ready open closed missing pending plate plates sample samples ' +
  'customer customers order orders highest lowest average worst best percent compliance latest recent where there their ' +
  'mismo puede pueden debe deben hacia hecha hechos menos mayor menor alta alto bajo baja altas bajos ' +
  'nuevo nueva nuevos viejo vieja manana tarde noche ayer antes despues luego ahora siempre nunca ' +
  // verbos para pedir algo
  'muestrame muestreme mostrame mostrar ensename ensenar busca buscame buscar encuentra encontrar consulta consultar revisa revisar ' +
  'checa checar verifica verificar quisiera ayudame ayuda dinos cuentame explica explicame lista listame trae traeme ' +
  'show find search give tell check look lookup display bring want please').split(' ');
var _agVocab = null;
function agVocab(){
  if(_agVocab) return _agVocab;
  var v = {};
  var add = function(s){ String(s).split(' ').forEach(function(w){ if(w.length >= 4 && /^[a-z]+$/.test(w)) v[w] = 1; }); };
  Object.keys(AG_SIN).forEach(function(k){ AG_SIN[k].forEach(add); });
  Object.keys(AG_PANTALLAS_SIN).forEach(function(k){ AG_PANTALLAS_SIN[k].forEach(add); });
  Object.keys(AG_MESES).forEach(add); Object.keys(AG_DIAS).forEach(add);
  AG_COMUNES.forEach(add);
  ('promedio average porcentaje cumplimiento compliance percent peor peores worst mejor mejores best maximo maxima minimo minima highest lowest ' +
   'cuantos cuantas latest recent reciente fallo fallaron fallas fuera rango failed failures abierto abiertos abierta abiertas pendiente pendientes ' +
   'cerrado cerrados vencido vencidos atrasado overdue liberado released ausente ausentes absent faltaron tarde humedad moisture grasa ' +
   'levadura levaduras moho mohos libras cajas temperatura hoy ayer anoche manana today yesterday tonight morning noche dias').split(' ').forEach(add);
  _agVocab = Object.keys(v);
  return _agVocab;
}
// Distancia de edicion con intercambio de letras vecinas (Damerau, corta)
function agDistancia(a, b, tope){
  if(Math.abs(a.length - b.length) > tope) return tope + 1;
  var d = [], i, j;
  for(i = 0; i <= a.length; i++){ d[i] = [i]; }
  for(j = 0; j <= b.length; j++){ d[0][j] = j; }
  for(i = 1; i <= a.length; i++){
    var min = 99;
    for(j = 1; j <= b.length; j++){
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if(d[i][j] < min) min = d[i][j];
    }
    if(min > tope) return tope + 1;
  }
  return d[a.length][b.length];
}
function agCorregir(t){
  var voc = agVocab(), set = {}, cambios = [];
  voc.forEach(function(w){ set[w] = 1; });
  // los nombres de los clientes (de los datos) y de los productos no se tocan
  (typeof getCustomers === 'function' ? getCustomers() : []).forEach(function(c){ agN(c.company).split(' ').forEach(function(w){ set[w] = 1; }); });
  (typeof getProducts === 'function' ? getProducts() : []).forEach(function(p){ agN(p.name).split(' ').forEach(function(w){ set[w] = 1; }); });
  // solo palabras de 5 letras o mas, y solo hacia palabras de 5 o mas: las
  // cortas se parecen a demasiadas (last/list, falta/falla)
  var out = t.replace(/[a-z]{5,}/g, function(w){
    if(set[w]) return w;
    var tope = w.length >= 8 ? 2 : 1, mejor = null, md = tope + 1;
    for(var i = 0; i < voc.length; i++){
      var v = voc[i];
      if(v.length < 5 || v[0] !== w[0] || Math.abs(v.length - w.length) > tope) continue;
      var dd = agDistancia(w, v, tope);
      if(dd < md){ md = dd; mejor = v; }
    }
    if(mejor){ cambios.push([w, mejor]); return mejor; }
    return w;
  });
  return {t:out, cambios:cambios};
}

// ---- Pantallas para "abre..." / "donde registro..." ----
var AG_PANTALLAS_SIN = {
  'screen-weight':['pesos', 'peso', 'weights', 'weight'], 'screen-seal':['sellos', 'sellado', 'seal', 'seals', 'seal bags'],
  'screen-temp':['temperaturas', 'temperatura', 'temperatures', 'temperature'], 'screen-gmp':['gmp'],
  'screen-metal':['metal', 'detector', 'metal detector', 'detector de metales'], 'screen-preop':['pre op', 'preop', 'pre-op'],
  'screen-capa':['capa', 'capas'], 'screen-hold':['hold', 'holds'], 'screen-shift':['shift report', 'reporte de turno', 'shift reports'],
  'screen-samplelist':['list samples', 'lista de muestras', 'lista de samples'], 'screen-analysis':['sample analysis', 'analisis'],
  'screen-yeast':['yeast', 'levaduras', 'yeast and mold', 'levaduras y mohos', 'placas', 'plates'], 'screen-lab':['lab samples', 'muestras de lab'],
  'screen-grilling':['grilling', 'grilling cheese'], 'screen-raw':['raw', 'raw analysis', 'materia prima'],
  'screen-production':['schedule', 'production schedule', 'programacion'], 'screen-orders':['coa orders', 'ordenes de coa', 'orders', 'ordenes'],
  'screen-attendance':['attendance', 'asistencia'], 'screen-output':['output', 'produccion'], 'screen-downtime':['downtime', 'paros'],
  'screen-opsreports':['operations search'], 'screen-products':['catalogo', 'catalog', 'product catalog', 'productos'],
  'screen-addproduct':['create product', 'crear producto', 'nuevo producto'], 'screen-customers':['customers', 'clientes'],
  'screen-coa':['coa generator', 'generar coa', 'coa'], 'screen-coastatus':['coa status', 'estado del coa'], 'screen-coastock':['stock customers'],
  'screen-lotsearch':['search', 'buscar', 'busqueda'], 'screen-dashboard':['dashboard', 'tablero'], 'screen-activity':['activity log', 'bitacora', 'actividad'],
  'screen-admin':['users', 'usuarios', 'roles', 'users and roles']
};

var AG_MESES = {enero:1, ene:1, january:1, jan:1, febrero:2, feb:2, february:2, marzo:3, mar:3, march:3, abril:4, abr:4, april:4, apr:4,
  mayo:5, may:5, junio:6, jun:6, june:6, julio:7, jul:7, july:7, agosto:8, ago:8, august:8, aug:8, septiembre:9, setiembre:9, sep:9, sept:9, september:9,
  octubre:10, oct:10, october:10, noviembre:11, nov:11, november:11, diciembre:12, dic:12, december:12, dec:12};
var AG_DIAS = {domingo:0, sunday:0, lunes:1, monday:1, martes:2, tuesday:2, miercoles:3, wednesday:3, jueves:4, thursday:4, viernes:5, friday:5, sabado:6, saturday:6};

function agTiene(t, frase){ return t.indexOf(' ' + frase + ' ') >= 0; }
function agQuita(t, re){ return t.replace(re, ' ').replace(/\s+/g, ' ').replace(/^ ?/, ' ').replace(/ ?$/, ' '); }
function agIso(y, m, d){ return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
function agMasDias(iso, n){
  var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.toISOString().slice(0, 10);
}
function agDiaSemana(iso){ var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
// Una fecha sin año: la mas reciente que no este en el futuro
function agSinAno(m, d, hoy){
  var y = +hoy.slice(0, 4), f = agIso(y, m, d);
  if(f > agMasDias(hoy, 1)) f = agIso(y - 1, m, d);
  return f;
}

function agEsEspanol(t){
  return /\b(que|cual|cuales|cuando|cuantos|cuantas|cuanto|dame|muestrame|ensename|ultimo|ultima|ultimos|ultimas|linea|turno|hoy|ayer|semana|del|los|las|verificacion|pesos|como|donde|abre|abrir|fue|hubo|hay|esta|estan|mes|dia|dias|promedio|peor|mejor|abiertos|pendientes|de la|el|la|se|por|para|con|sin|quien|quienes)\b/.test(t);
}

function agEntender(texto){
  var hoy = localDateStr();
  var t = ' ' + agN(texto) + ' ';
  var q = {entendido:false, tipo:'consulta', fuente:null, accion:'lista', filtros:{}, campo:null, limite:null,
           lang: agEsEspanol(t) ? 'es' : 'en', texto:String(texto || '')};
  var x = q.filtros, m;
  // primero se arreglan las palabras mal escritas ("analisyis" -> "analisis")
  var cor = agCorregir(t);
  t = cor.t; q.corregido = cor.cambios;

  // ---- Ayuda ----
  if(/^ ?(ayuda|help|\?|que puedes hacer|que sabes hacer|que sabes|what can you do|how does this work|como funciona|como te uso) ?$/.test(t)){
    q.entendido = true; q.tipo = 'ayuda'; return q;
  }

  // ---- Fechas (antes que todo: "last week" no es "el ultimo") ----
  var fechas = [];
  var poner = function(a, b){ x.desde = a; x.hasta = b || a; };
  if((m = /\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/.exec(t))){ fechas.push(agIso(m[1], m[2], m[3])); t = agQuita(t, m[0]); }
  var reMes = '(' + Object.keys(AG_MESES).join('|') + ')';
  var reDM = new RegExp('\\b(\\d{1,2})\\s+(?:de\\s+)?' + reMes + '(?:\\s+(?:de\\s+|del\\s+)?(20\\d\\d))?\\b', 'g');
  var reMD = new RegExp('\\b' + reMes + '\\s+(\\d{1,2})(?:\\s+(20\\d\\d))?\\b', 'g');
  t = t.replace(reDM, function(s, d, mes, y){ fechas.push(y ? agIso(y, AG_MESES[mes], d) : agSinAno(AG_MESES[mes], +d, hoy)); return ' '; });
  t = t.replace(reMD, function(s, mes, d, y){ fechas.push(y ? agIso(y, AG_MESES[mes], d) : agSinAno(AG_MESES[mes], +d, hoy)); return ' '; });
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, function(s, mm, dd, y){
    if(+mm > 12 || +dd > 31) return s;
    fechas.push(y ? agIso(y.length === 2 ? '20' + y : y, mm, dd) : agSinAno(+mm, +dd, hoy)); return ' ';
  });
  if(fechas.length){ fechas.sort(); poner(fechas[0], fechas[fechas.length - 1]); }
  var rel = [
    // "anoche" es el 2o turno de ayer (despues de medianoche sigue siendo de ayer)
    [/\b(anoche|last night|ayer en la noche|ayer por la noche)\b/, function(){ poner(agMasDias(hoy, -1)); if(!x.turno) x.turno = '2'; }],
    [/\b(esta manana|this morning|hoy en la manana)\b/, function(){ poner(hoy); if(!x.turno) x.turno = '1'; }],
    [/\b(hoy|today|de hoy|del dia de hoy)\b/, function(){ poner(hoy); }],
    [/\b(anteayer|antier|antes de ayer|day before yesterday)\b/, function(){ poner(agMasDias(hoy, -2)); }],
    [/\b(ayer|yesterday)\b/, function(){ poner(agMasDias(hoy, -1)); }],
    [/\b(semana pasada|la semana pasada|last week|previous week)\b/, function(){ var l = agMasDias(hoy, -((agDiaSemana(hoy) + 6) % 7)); poner(agMasDias(l, -7), agMasDias(l, -1)); }],
    [/\b(esta semana|this week|en la semana|de la semana)\b/, function(){ poner(agMasDias(hoy, -((agDiaSemana(hoy) + 6) % 7)), hoy); }],
    [/\b(mes pasado|el mes pasado|last month|previous month)\b/, function(){ var p = hoy.split('-'), y = +p[0], mo = +p[1] - 1; if(!mo){ mo = 12; y--; } var ini = agIso(y, mo, 1); poner(ini, agMasDias(hoy.slice(0, 8) + '01', -1)); }],
    [/\b(este mes|this month|del mes|en el mes)\b/, function(){ poner(hoy.slice(0, 8) + '01', hoy); }],
    [/\b(?:ultimos|ultimas|en los ultimos|last|past|the last|the past)\s+(\d{1,3})\s+(?:dias|days)\b/, function(mm){ poner(agMasDias(hoy, -(+mm[1] - 1)), hoy); }],
    [/\b(ultima semana|past week|last 7 days)\b/, function(){ poner(agMasDias(hoy, -6), hoy); }],
    [/\b(este ano|this year|en el ano)\b/, function(){ poner(hoy.slice(0, 5) + '01-01', hoy); }]
  ];
  if(!fechas.length) rel.some(function(r){ var mm = r[0].exec(t); if(!mm) return false; r[1](mm); t = agQuita(t, mm[0]); return true; });
  if(!x.desde){
    m = /\b(?:el |este |el pasado |last |on )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.exec(t);
    if(m){ var dw = AG_DIAS[m[1]], hw = agDiaSemana(hoy); poner(agMasDias(hoy, -((hw - dw + 7) % 7))); t = agQuita(t, m[0]); }
  }

  // ---- Linea y turno ----
  if((m = /\b(?:linea|line|lin|ln|l)\s*(?:#|no\.?|numero)?\s*(\d{1,2})\b/.exec(t))){ x.linea = String(+m[1]); t = agQuita(t, m[0]); }
  else if(/\b(chopped|chopping|chop)\b/.test(t)){ x.linea = 'chopped'; t = agQuita(t, /\b(chopped|chopping|chop)( area)?\b/); }
  else if(/\b(forklift|montacargas)\b/.test(t)){ x.linea = 'forklift'; t = agQuita(t, /\b(forklift|montacargas)\b/); }
  var t1 = /\b((1er|1ro|primer|primero|1st|first|1)\s+(turno|shift)|(turno|shift)\s+(1|uno|one|de la manana|de dia)|day shift|morning shift)\b/;
  var t2 = /\b((2do|2o|segundo|2nd|second|2)\s+(turno|shift)|(turno|shift)\s+(2|dos|two|de la noche|de la tarde|de noche)|night shift|evening shift|nocturno)\b/;
  if((m = t2.exec(t))){ x.turno = '2'; t = agQuita(t, m[0]); }
  else if((m = t1.exec(t))){ x.turno = '1'; t = agQuita(t, m[0]); }

  // ---- Cuantos ("los ultimos 5") ----
  if((m = /\b(?:ultimos|ultimas|last|top|primeros|first|los|las)\s+(\d{1,3})\b(?!\s*(dias|days))/.exec(t)) && +m[1] > 0 && +m[1] <= 200){
    q.limite = +m[1]; q.accion = 'lista'; q._limiteDicho = true; t = agQuita(t, m[0]);
  }

  // ---- Orden, PO, LOT, producto ----
  if((m = /\b(?:orden|order|pedido)\s*(?:de coa\s*)?(?:#|no\.?|numero|number|num)?\s*([a-z0-9\-]*\d[a-z0-9\-]*)\b/.exec(t))){ x.orden = m[1].toUpperCase(); t = agQuita(t, m[0]); q._palabraOrden = true; }
  if((m = /\b(?:po|p\.o\.|purchase order)\s*(?:#|no\.?|numero|number)?\s*([a-z0-9\-]*\d[a-z0-9\-]*)\b/.exec(t))){ x.po = m[1].toUpperCase(); t = agQuita(t, m[0]); }
  if((m = /\b(?:lot|lote|lots|lotes)\s*(?:#|no\.?|numero|number|num)?\s*([a-z0-9\-]*\d[a-z0-9\-]*)\b/.exec(t))){ x.lot = m[1].toUpperCase(); t = agQuita(t, m[0]); }
  if((m = /\b(?:producto|product|item|prod|articulo|codigo|code)\s*(?:#|no\.?|numero|number|num)?\s*([a-z0-9\-]*\d[a-z0-9\-]*)\b/.exec(t))){
    var pp = (typeof findProduct === 'function') ? findProduct(m[1]) : null;
    x.producto = pp ? pp.number : m[1].toUpperCase(); t = agQuita(t, m[0]); q._palabraProducto = true;
  }
  // numeros sueltos: un producto del catalogo, o algo con forma de LOT
  t = t.replace(/\b([a-z]*-?\d[a-z0-9\-]{2,})\b/g, function(s){
    var p = (typeof findProduct === 'function') ? findProduct(s) : null;
    if(p && !x.producto){ x.producto = p.number; return ' '; }
    if(!x.lot && /^(2\d{4}|\d{3}2\d)$/.test(s)){ x.lot = s.toUpperCase(); return ' '; }
    if(!x.orden && /^\d{6,9}$/.test(s)){ x.orden = s; return ' '; }
    return s;
  });

  // ---- Cliente (el nombre sale de los datos, nunca del codigo) ----
  var cs = (typeof getCustomers === 'function') ? getCustomers() : [];
  var vacias = {cheese:1, cheeses:1, foods:1, food:1, inc:1, llc:1, company:1, the:1, corp:1, corporation:1, group:1, distributors:1, distribution:1, quesos:1, queso:1, sales:1, products:1, dairy:1, international:1, foodservice:1, usa:1, demo:1, sample:1, customer:1};
  var mejor = null;
  cs.forEach(function(c){
    var n = agN(c.company);
    if(!n) return;
    var largo = 0;
    if(agTiene(t, n)) largo = n.length + 10;
    else n.split(' ').forEach(function(w){ if(w.length >= 5 && !vacias[w] && agTiene(t, w)) largo = Math.max(largo, w.length); });
    if(largo && (!mejor || largo > mejor.largo)) mejor = {c:c, largo:largo};
  });
  if(mejor){
    x.cliente = typeof custKey === 'function' ? custKey(mejor.c) : (mejor.c.customerId || '');
    q.clienteTxt = mejor.c.company;
  }

  // ---- Lo que falta en el turno ----
  if(/\b(que (me |nos |le )?(falta|hace falta|queda|toca)|que hay pendiente|que esta pendiente|pendientes? del turno|lo pendiente|what('?s| is) (missing|pending|left|due)|what do i (need|have) to do|what('?s| is) due|to do list|por hacer)\b/.test(t)){
    q.entendido = true; q.tipo = 'pendientes'; return q;
  }

  // ---- Abrir una pantalla ----
  var quiereAbrir = /\b(abre|abrir|abreme|ir a|vamos a|llevame|lleva me|open|go to|take me|navigate|donde (registro|capturo|anoto|pongo|hago|lleno|se registra|se captura|se hace)|where (do i|can i|to) (record|log|enter|add|do|fill)|how (do i|to) (record|log|enter|add|do|fill)|como (registro|capturo|hago|anoto|agrego|lleno))\b/.test(t);

  // ---- La fuente ----
  var puntos = {};
  Object.keys(AG_SIN).forEach(function(k){
    AG_SIN[k].forEach(function(s){ if(agTiene(t, s)) puntos[k] = (puntos[k] || 0) + s.length; });
  });
  // "orden" solo cuenta como COA Orders si no se pregunta por otra cosa de la orden
  if(q._palabraOrden && !Object.keys(puntos).length) puntos.orders = 1;
  // "producto"/"product" a secas solo cuenta si no se pregunta por otra cosa
  if(!Object.keys(puntos).length && /\b(producto|productos|product|products)\b/.test(t)) puntos.products = 1;
  var fuentes = Object.keys(puntos).sort(function(a, b){ return (puntos[b] - puntos[a]) || (AG_ORDEN.indexOf(a) - AG_ORDEN.indexOf(b)); });
  q.fuente = fuentes[0] || null;

  if(quiereAbrir){
    var pant = null, largo = 0;
    Object.keys(AG_PANTALLAS_SIN).forEach(function(sc){
      AG_PANTALLAS_SIN[sc].forEach(function(s){ if(agTiene(t, s) && s.length > largo){ largo = s.length; pant = sc; } });
    });
    if(pant){ q.entendido = true; q.tipo = 'abrir'; q.pantalla = pant; return q; }
  }

  // ---- El LOT del dia ----
  if(/\b(lot|lote|lot number|numero de lot|numero de lote|lots|lotes)\b/.test(t) && !x.lot && !q.fuente){
    q.entendido = true; q.tipo = 'lot'; q.fecha = x.desde || hoy; return q;
  }

  var A = function(re){ return re.test(t); };

  // ---- Campo (antes que la accion: "la temperatura mas alta" es un maximo) ----
  if(A(/\b(humedad relativa|humidity)\b/)) q.campo = 'humidity';
  else if(A(/\b(humedad|moisture)\b/)) q.campo = 'moisture';
  else if(A(/\b(grasa|fat)\b/)) q.campo = 'fat';
  else if(A(/\bph\b/)) q.campo = 'ph';
  else if(A(/\b(levadura|levaduras|yeast)\b/) && q.fuente !== 'plates') q.campo = 'yeast';
  else if(A(/\b(moho|mohos|mold|molds)\b/) && q.fuente !== 'plates') q.campo = 'mold';
  else if(A(/\b(libras|lbs|pounds)\b/)) q.campo = 'lbs';
  else if(A(/\b(cajas|cases)\b/)) q.campo = 'cases';
  else if(A(/\b(temperatura|temperaturas|temperature|temp)\b/) && (!q.fuente || q.fuente === 'temps')) q.campo = 'temp';
  else if(A(/\b(peso promedio|average weight|promedio de peso|peso)\b/) && q.fuente === 'weights' && A(/\b(promedio|average|mas alto|mas bajo|maximo|minimo|highest|lowest|mayor|menor)\b/)) q.campo = 'avg';
  else if(A(/\b(minutos|minutes|tiempo|time)\b/) && q.fuente === 'downtime') q.campo = 'minutes';
  else if(A(/\b(cumplimiento|compliance)\b/) && q.fuente === 'weights') q.campo = 'compliance';
  if(q.campo === 'humidity' && !q.fuente) q.fuente = 'temps';
  if(q.campo === 'temp' && !q.fuente) q.fuente = 'temps';
  var numerico = q.campo && q.campo !== 'compliance';

  // ---- Que se pide ----
  if(numerico && A(/\b(mas alta|mas alto|maxima|maximo|max|mayor|highest|maximum|top)\b/)) q.accion = 'maximo';
  else if(numerico && A(/\b(mas baja|mas bajo|minima|minimo|min|menor|lowest|minimum)\b/)) q.accion = 'minimo';
  // "la peor linea en cumplimiento" es un ranking, no un porcentaje
  else if(A(/\b(peor|peores|worst|mas bajo|lowest|mas fallas|most failures)\b/)) q.accion = 'peor';
  else if(A(/\b(mejor|mejores|best|highest|mas alto)\b/)) q.accion = 'mejor';
  else if(A(/\b(promedio|average|avg|media|mean)\b/)) q.accion = 'promedio';
  else if(A(/\b(porcentaje|cumplimiento|compliance|percent|percentage|%|que tan bien|how well|tasa)\b/)) q.accion = 'porcentaje';
  else if(A(/\b(cuanto|cuanto tiempo|cuantas cajas|cuantas libras|how much|en total|total de|suma|sum of)\b/)) q.accion = 'sumar';
  else if(A(/\b(cuantos|cuantas|how many|numero de|cantidad de|count)\b/)) q.accion = 'contar';
  else if(!q._limiteDicho && A(/\b(ultimo|ultima|last|latest|most recent|mas reciente|reciente|cuando fue|cuando se|cuando hicimos|when was|when were|when did)\b/)) q.accion = 'ultimo';

  // ---- Agrupar: "por linea", "by cause", "cada dia"... ----
  var G = {linea:'linea', line:'linea', lineas:'linea', lines:'linea', dia:'dia', dias:'dia', day:'dia', days:'dia', fecha:'dia', date:'dia',
           producto:'producto', productos:'producto', product:'producto', products:'producto', causa:'causa', causas:'causa', cause:'causa', causes:'causa',
           motivo:'causa', reason:'causa', cliente:'cliente', clientes:'cliente', customer:'cliente', customers:'cliente', area:'area', areas:'area',
           turno:'turno', turnos:'turno', shift:'turno', shifts:'turno', estado:'estado', status:'estado', resultado:'estado', result:'estado'};
  if((m = /\b(?:por|by|per|cada|each|segun|agrupado por|grouped by)\s+(linea|lineas|line|lines|dia|dias|day|days|fecha|date|producto|productos|product|products|causa|causas|cause|causes|motivo|reason|cliente|clientes|customer|customers|area|areas|turno|turnos|shift|shifts|estado|status|resultado|result)\b/.exec(t))){
    q.agrupar = G[m[1]];
    if(['sumar', 'promedio', 'porcentaje'].indexOf(q.accion) < 0) q.accion = 'agrupar';
  }

  // ---- Estado ----
  var E = [
    ['down', /\b(parada ahora|sigue parada|siguen paradas|esta parada|estan paradas|down now|still down|is down|are down)\b/],
    ['absent', /\b(falto|faltaron|faltas|ausente|ausentes|absent|absences|no vino|no vinieron)\b/],
    ['late', /\b(llego tarde|llegaron tarde|tardanza|tardanzas|came late|were late)\b/],
    ['overdue', /\b(vencido|vencidos|vencida|vencidas|atrasado|atrasados|overdue)\b/],
    ['hold', /\b(en hold|on hold|retenido|retenidos|still on hold)\b/],
    ['released', /\b(liberado|liberados|released)\b/],
    ['sincoa', /\b(sin coa|without coa|falta coa|faltan coa|falta el coa|no coa|missing coa|pending coa|coa pendiente|coas pendientes)\b/],
    ['coa', /\b(con coa|coa emitido|coa hecho|with coa|coa issued)\b/],
    ['ready', /\b(toca leer|tocan leer|para leer|listas para leer|lista para leer|por leer|ready|to read|due|vencen hoy)\b/],
    ['waiting', /\b(esperando|en espera|incubando|waiting|incubating|not ready)\b/],
    ['pending', /\b(sin resultado|sin resultados|sin testear|no testeada|no testeadas|no testeado|not tested|without results|por testear|sin recoger|no recogida|no recogidas|por recoger|not collected|missing results)\b/],
    ['fail', /\b(fallo|fallaron|fallado|fallados|fallida|fallidas|fallidos|falla|fallas|fuera de rango|fuera de spec|fuera de especificacion|mal|malos|malas|rechazado|rechazados|no paso|no pasaron|fail|failed|fails|failing|failure|failures|out of range|out of spec|bad|rejected|no conforme|no conformes)\b/],
    ['pass', /\b(pasaron|paso bien|bien|buenos|buenas|pass|passed|in range|dentro de rango|conforme|conformes)\b/],
    ['closed', /\b(cerrado|cerrados|cerrada|cerradas|closed|resuelto|resueltos|resolved|completada|completadas|completed)\b/],
    ['open', /\b(abierto|abiertos|abierta|abiertas|open|pendiente|pendientes|pending|sin cerrar|sin resolver)\b/]
  ];
  for(var i = 0; i < E.length; i++){ if(E[i][1].test(t)){ x.estado = E[i][0]; break; } }
  if(x.estado === 'absent' || x.estado === 'late'){ if(!q.fuente || q.fuente === 'analysis') q.fuente = 'attendance'; }
  if(x.estado === 'down' && !q.fuente) q.fuente = 'downtime';
  if(x.estado === 'hold' && !q.fuente) q.fuente = 'holds';

  if((x.estado === 'ready' || x.estado === 'waiting') && !q.fuente) q.fuente = 'plates';
  if(x.estado === 'sincoa' && !q.fuente) q.fuente = 'analysis';
  // "el resultado / la prueba / el laboratorio" de un producto, LOT u orden: su analisis
  if(!q.fuente && (x.producto || x.lot || x.orden || x.po) &&
     A(/\b(resultado|resultados|result|results|test|tests|testeo|prueba|pruebas|laboratorio|lab|analizado|analisis|analysis|especifica|spec)\b/) &&
     !A(/\b(especificacion|especificaciones|specs|rango|target)\b/)) q.fuente = 'analysis';
  // "cumplimiento" / "la peor linea" sin decir de que: el de los pesos (el principal)
  if(!q.fuente && (q.accion === 'peor' || q.accion === 'mejor' || q.accion === 'porcentaje')) q.fuente = 'weights';
  // Sin fuente: un LOT solo es su traza; un producto solo, todo lo suyo
  if(!q.fuente){
    if(x.lot){ q.entendido = true; q.tipo = 'traza'; return q; }
    if(x.producto){ q.entendido = true; q.tipo = 'producto'; return q; }
    if(x.orden){ q.fuente = 'orders'; }
  }
  if(!q.fuente) return q;

  var f = (typeof agFuente === 'function') ? agFuente(q.fuente) : null;
  // Un estado que la fuente no tiene no filtra (no se inventa)
  if(x.estado && f && !(f.estado || (x.estado === 'overdue' && f.vencido))) delete x.estado;
  // "lo ultimo" de algo que se suma es la lista reciente
  if(q.accion === 'sumar' && f && !f.suma) q.accion = 'contar';
  if(q.accion === 'promedio' && f && !f.numero) q.accion = 'lista';
  // "cajas por producto": de lo que se suma, el total de cada grupo
  if(q.accion === 'agrupar' && f && f.suma) q.accion = 'sumar';
  // la ficha de UN producto ("rango de peso del 01824")
  if(q.fuente === 'products' && x.producto && q.accion === 'lista') q.accion = 'ultimo';
  // las placas para leer: tambien las de dias anteriores que nadie leyo
  if(q.fuente === 'plates' && x.estado === 'ready'){ delete x.desde; delete x.hasta; }
  // Lo pendiente no es solo de hoy: una muestra sin resultados de ayer sigue pendiente
  var esPendiente = ['pending', 'sincoa', 'open', 'overdue', 'hold', 'ready', 'waiting', 'down'].indexOf(x.estado) >= 0;
  // Sin fechas: lo que se cuenta o se lista de algo diario es de HOY (salvo que
  // se busque por LOT, producto u orden, que ya dicen cual)
  if(f && f.serie && !x.desde && q.accion !== 'ultimo' && q.accion !== 'maximo' && q.accion !== 'minimo' && !esPendiente &&
     !x.lot && !x.producto && !x.orden && !x.po && !q._limiteDicho){
    x.desde = hoy; x.hasta = hoy; q._hoyPorDefecto = true;
  }
  if(q.accion === 'ultimo' && q.limite == null) q.limite = 1;
  q.entendido = true;
  return q;
}
