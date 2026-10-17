// ===== HOME: EL TABLERO DE INDICADORES =====
//
// La pantalla de inicio deja de ser un saludo con cuatro contadores y pasa a
// decir, de un vistazo, como va la planta: cumplimiento de peso y de sellado,
// cuanto de lo programado se capturo, que CAPA sigue abierto y que falta por
// mirar hoy.
//
// Todo sale de lo que el sistema ya guarda —db.weights, db.seals, db.runs,
// db.temps, db.gmps, db.metal, db.capa, db.holds—. No hay datos de ejemplo:
// si una coleccion esta vacia el indicador lo dice en vez de inventarse una
// cifra, que en control de calidad es peor que no decir nada.

// ------------------------------------------------------------------
// Lo que se considera "bien". Son los numeros del programa SQF y es lo
// unico que hay que tocar para mover la vara.
// ------------------------------------------------------------------
var KPI_TARGETS = {
  weight:      98,   // % de muestras dentro de rango
  seal:        98,   // % de verificaciones de sellado aprobadas
  checks:      95,   // % de lo programado que se capturo
  capaOverdue:  0,   // CAPA vencidos admitidos
  tempExc:      0    // excursiones de temperatura admitidas
};

// Cuantas capturas pide el programa. Se cuenta contra lo que hay en el
// Production Schedule: una linea que no se programo no debe nada.
//   porLineaTurno -> una vez por cada (dia, linea, turno) programado
//   porTurno      -> una vez por cada (dia, turno) programado
var KPI_PLAN = {
  weight: {base:'porLineaTurno', n:8},   // una revision por hora de turno
  seal:   {base:'porLineaTurno', n:8},
  metal:  {base:'porLineaTurno', n:1},
  temp:   {base:'porTurno',      n:3},   // principio, mitad y final
  gmp:    {base:'porTurno',      n:1}
};

// El rango de temperatura no esta escrito en ningun sitio del sistema, asi que
// mientras no se ponga aqui el tablero NO inventa excursiones: cuenta los
// checkpoints que faltan, que es un dato real y util. En cuanto haya minimo y
// maximo, la casilla pasa sola a contar excursiones.
var KPI_TEMP = { min:null, max:null };

var KPI_MODULOS = [
  {k:'weight', name:'Weights',        screen:'screen-weight', mod:'qa'},
  {k:'seal',   name:'Seal Bags',      screen:'screen-seal',   mod:'qa'},
  {k:'metal',  name:'Metal Detector', screen:'screen-metal',  mod:'qa'},
  {k:'temp',   name:'Temperatures',   screen:'screen-temp',   mod:'qa'},
  {k:'gmp',    name:'GMP Audit',      screen:'screen-gmp',    mod:'qa'}
];

var kpiState = { days:7, line:'all', shift:'all' };

// ------------------------------------------------------------------
// Periodo y filtros
// ------------------------------------------------------------------
function kpiFecha(offsetDias){
  var d = new Date();
  d.setDate(d.getDate() - offsetDias);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// Ventana de dias. salto=1 devuelve la ventana anterior, para comparar.
function kpiVentana(dias, salto){
  var fin = kpiFecha((salto||0) * dias);
  var ini = kpiFecha((salto||0) * dias + dias - 1);
  return {ini:ini, fin:fin};
}
function kpiDia(r){ return String(r.date || r.capaDate || '').slice(0,10); }
function kpiEnVentana(r, v){ var d = kpiDia(r); return !!d && d >= v.ini && d <= v.fin; }

// La linea y el turno solo existen en lo que se captura al pie de la maquina.
// Temperaturas y GMP no llevan linea, y el detector de metales guarda la linea
// como texto libre ("Line 3 / MD-2"), asi que ninguno se filtra por linea.
function kpiPorLinea(r){
  return kpiState.line === 'all' || String(r.line||'') === kpiState.line;
}
function kpiPorTurno(r){
  return kpiState.shift === 'all' || String(r.shift||'') === kpiState.shift;
}

function kpiPesos(v){
  return (getDB().weights||[]).filter(function(r){
    return !r.issue && kpiEnVentana(r,v) && kpiPorLinea(r) && kpiPorTurno(r);
  });
}
function kpiSellos(v){
  return (getDB().seals||[]).filter(function(r){
    return kpiEnVentana(r,v) && kpiPorLinea(r) && kpiPorTurno(r);
  });
}
function kpiCorridas(v){
  return (getDB().runs||[]).filter(function(r){
    return kpiEnVentana(r,v) && kpiPorLinea(r) && kpiPorTurno(r);
  });
}
function kpiTemps(v){
  return (getDB().temps||[]).filter(function(r){ return kpiEnVentana(r,v) && kpiPorTurno(r); });
}
function kpiGmps(v){
  return (getDB().gmps||[]).filter(function(r){ return kpiEnVentana(r,v) && kpiPorTurno(r); });
}
function kpiMetales(v){
  return (getDB().metal||[]).filter(function(r){ return kpiEnVentana(r,v); });
}

// ------------------------------------------------------------------
// Agregados
// ------------------------------------------------------------------
function kpiSuma(lista, f){ return lista.reduce(function(s,x){ return s + (f(x)||0); }, 0); }
function kpiPct(a,b){ return b ? (a/b)*100 : null; }

// Peso: cada registro ya trae cuantas muestras pasaron y cuantas se tomaron.
// Los que no tienen rango objetivo (pass null) no cuentan ni a favor ni en
// contra: no se puede decir si cumplen.
function kpiCompPeso(lista){
  var con = lista.filter(function(r){ return r.pass != null; });
  var ok = kpiSuma(con, function(r){ return r.pass; });
  var n  = kpiSuma(con, function(r){ return r.total; });
  return {ok:ok, n:n, pct:kpiPct(ok,n)};
}
// Sellado: tres verificaciones por registro, cada una pass o fail.
function kpiCompSello(lista){
  var ok = 0, n = 0;
  lista.forEach(function(r){
    SEAL_CHECKS.forEach(function(c){
      var v = (r.checks||{})[c];
      if(!v) return;
      n++; if(v !== 'fail') ok++;
    });
  });
  return {ok:ok, n:n, pct:kpiPct(ok,n)};
}

// Lo programado, a partir del Production Schedule: cuantos (dia,linea,turno) y
// cuantos (dia,turno) distintos hay. Sin programacion no se debe nada.
function kpiProgramado(corridas){
  var lt = {}, t = {};
  corridas.forEach(function(r){
    lt[r.date+'|'+r.line+'|'+r.shift] = 1;
    t[r.date+'|'+r.shift] = 1;
  });
  return {porLineaTurno:Object.keys(lt).length, porTurno:Object.keys(t).length};
}

// Capturado contra esperado, modulo por modulo.
function kpiCapturas(v){
  var prog = kpiProgramado(kpiCorridas(v));
  var hecho = {
    weight: kpiPesos(v).length,
    seal:   kpiSellos(v).length,
    metal:  kpiMetales(v).length,
    temp:   kpiTemps(v).length,
    gmp:    kpiGmps(v).length
  };
  return KPI_MODULOS.map(function(m){
    var p = KPI_PLAN[m.k];
    return {
      k:m.k, name:m.name, screen:m.screen, mod:m.mod,
      done: hecho[m.k],
      sched: prog[p.base] * p.n
    };
  });
}
function kpiTasaCapturas(v){
  var c = kpiCapturas(v);
  var d = kpiSuma(c, function(x){ return Math.min(x.done, x.sched); });
  var s = kpiSuma(c, function(x){ return x.sched; });
  return kpiPct(d, s);
}

// Temperatura: con rango puesto se cuentan excursiones; sin el, los
// checkpoints que faltan frente a lo programado.
function kpiTemperatura(v){
  var lista = kpiTemps(v);
  var hayRango = KPI_TEMP.min != null && KPI_TEMP.max != null;
  if(hayRango){
    var fuera = lista.filter(function(r){
      var t = parseFloat(r.temp);
      return !isNaN(t) && (t < KPI_TEMP.min || t > KPI_TEMP.max);
    });
    return {modo:'exc', n:fuera.length, de:lista.length};
  }
  var esperado = kpiProgramado(kpiCorridas(v)).porTurno * KPI_PLAN.temp.n;
  return {modo:'faltan', n:Math.max(0, esperado - lista.length), de:esperado};
}

function kpiCapaAbiertos(){
  return (typeof getCapa === 'function' ? getCapa() : []).filter(function(c){
    return c.status !== 'closed';
  });
}

// ------------------------------------------------------------------
// Dibujo: utilidades de SVG
// ------------------------------------------------------------------
var KPI_NS = 'http://www.w3.org/2000/svg';
function kpiEl(tag, attrs, padre){
  var e = document.createElementNS(KPI_NS, tag);
  for(var k in attrs) e.setAttribute(k, attrs[k]);
  if(padre) padre.appendChild(e);
  return e;
}
// Barra con la punta redondeada y la base recta, apoyada en el eje.
function kpiBarra(x, y, w, h, horizontal){
  if(h <= 0 || w <= 0) return '';
  var r = Math.min(4, horizontal ? h/2 : w/2, horizontal ? w : h);
  if(horizontal) return 'M'+x+','+y+'h'+(w-r)+'a'+r+','+r+' 0 0 1 '+r+','+r+
                        'v'+(h-2*r)+'a'+r+','+r+' 0 0 1 -'+r+','+r+'h-'+(w-r)+'z';
  return 'M'+x+','+(y+h)+'v-'+(h-r)+'a'+r+','+r+' 0 0 1 '+r+',-'+r+
         'h'+(w-2*r)+'a'+r+','+r+' 0 0 1 '+r+','+r+'v'+(h-r)+'z';
}
function kpiGlobo(caja){
  var t = caja.querySelector('.kd-tip');
  if(!t){ t = document.createElement('div'); t.className = 'kd-tip'; caja.appendChild(t); }
  return {
    ver: function(html, x, y){
      t.innerHTML = html; t.classList.add('show');
      var w = t.offsetWidth, cw = caja.clientWidth;
      t.style.left = Math.max(0, Math.min(cw - w, x - w/2)) + 'px';
      t.style.top  = (y - t.offsetHeight - 10) + 'px';
    },
    ocultar: function(){ t.classList.remove('show'); }
  };
}
function kpiDiaCorto(iso){
  var d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
}

// ------------------------------------------------------------------
// Las casillas de arriba
// ------------------------------------------------------------------
function kpiChispa(valores){
  var v = valores.filter(function(x){ return x != null; });
  if(v.length < 2) return '';
  var w = 96, h = 28, min = Math.min.apply(null,v), max = Math.max.apply(null,v);
  var span = (max - min) || 1;
  var pts = v.map(function(x,i){
    return ((i/(v.length-1))*(w-4)+2).toFixed(1)+','+(h-3-((x-min)/span)*(h-6)).toFixed(1);
  });
  var fin = pts[pts.length-1].split(',');
  return '<svg class="kd-spark" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+
    '<polyline points="'+pts.join(' ')+'" fill="none" stroke="var(--accent)" stroke-width="2" '+
      'stroke-linejoin="round" stroke-linecap="round"/>'+
    '<circle cx="'+fin[0]+'" cy="'+fin[1]+'" r="3" fill="var(--accent)" '+
      'stroke="var(--surface)" stroke-width="1.5"/></svg>';
}
// El cambio contra el periodo anterior. Sin periodo anterior no se dice nada:
// "igual que antes" cuando no hay antes es mentira.
//
// La frase va corta a proposito: con cinco casillas en fila no caben cuatro
// palabras mas, y contra que se compara ya lo dice el selector de periodo.
// La frase entera se queda en el title.
function kpiDelta(ahora, antes, masEsMejor, unidad){
  if(ahora == null || antes == null) return '';
  var d = ahora - antes;
  if(Math.abs(d) < 0.05)
    return '<span class="kd-cap" title="Same as the prior period">No change</span>';
  var mejor = masEsMejor ? d > 0 : d < 0;
  var u = (unidad == null ? ' pts' : (unidad ? ' '+unidad : ''));
  return '<span class="kd-cap" title="vs the prior period" '+
    'style="color:'+(mejor?'var(--pass)':'var(--fail)')+'">'+
    (d > 0 ? '▲' : '▼')+' '+Math.abs(d).toFixed(1)+u+'</span>';
}
function kpiInsignia(estado){
  if(estado === 'none') return '<span class="kd-badge">No data</span>';
  if(estado === 'ok')   return '<span class="kd-badge ok">✓ On target</span>';
  if(estado === 'warn') return '<span class="kd-badge warn">! Watch</span>';
  return '<span class="kd-badge bad">✕ Off target</span>';
}
// bien / vigilar / mal en una sola cuenta: se pasa el valor, el objetivo y de
// que lado cae lo bueno.
function kpiEstado(valor, objetivo, masEsMejor, margen){
  if(valor == null) return 'none';
  var ok = masEsMejor ? valor >= objetivo : valor <= objetivo;
  if(ok) return 'ok';
  var roza = masEsMejor ? valor >= objetivo - margen : valor <= objetivo + margen;
  return roza ? 'warn' : 'bad';
}

function kpiCasilla(o){
  return '<div class="kd-kpi">'+
    '<div class="kd-kpi-top"><span class="kd-kpi-ic" data-icon="'+o.icon+'"></span>'+
      '<span class="kd-kpi-name">'+esc(o.name)+'</span></div>'+
    '<div class="kd-kpi-row"><div class="kd-kpi-val">'+o.value+
      (o.unit ? '<small>'+o.unit+'</small>' : '')+'</div>'+(o.spark||'')+'</div>'+
    '<div class="kd-kpi-row kd-kpi-foot"><div class="kd-kpi-meta">'+
      '<span class="kd-cap">'+esc(o.target)+'</span>'+(o.foot||'')+'</div>'+
      kpiInsignia(o.estado)+'</div>'+
  '</div>';
}

function kpiPintaCasillas(){
  var host = document.getElementById('kd-kpis');
  if(!host) return;
  var v    = kpiVentana(kpiState.days, 0);
  var prev = kpiVentana(kpiState.days, 1);

  // La chispa siempre mira al menos una semana: con un solo dia no hay linea.
  var serie = kpiSerieDiaria(Math.max(kpiState.days, 7));

  var w  = kpiCompPeso(kpiPesos(v)),  wp = kpiCompPeso(kpiPesos(prev));
  var s  = kpiCompSello(kpiSellos(v)), sp = kpiCompSello(kpiSellos(prev));
  var c  = kpiTasaCapturas(v), cp = kpiTasaCapturas(prev);
  var abiertos = kpiCapaAbiertos();
  var tarde    = abiertos.filter(capaOverdue).length;
  var t  = kpiTemperatura(v);

  host.innerHTML = [
    kpiCasilla({
      name:'Weight compliance', icon:'scale',
      value: w.pct == null ? '—' : w.pct.toFixed(1), unit: w.pct == null ? '' : '%',
      target: 'Target ≥ '+KPI_TARGETS.weight+'%',
      estado: kpiEstado(w.pct, KPI_TARGETS.weight, true, 1),
      foot: kpiDelta(w.pct, wp.pct, true),
      spark: kpiChispa(serie.map(function(d){ return d.peso; }))
    }),
    kpiCasilla({
      name:'Seal compliance', icon:'seal',
      value: s.pct == null ? '—' : s.pct.toFixed(1), unit: s.pct == null ? '' : '%',
      target: 'Target ≥ '+KPI_TARGETS.seal+'%',
      estado: kpiEstado(s.pct, KPI_TARGETS.seal, true, 1),
      foot: kpiDelta(s.pct, sp.pct, true),
      spark: kpiChispa(serie.map(function(d){ return d.sello; }))
    }),
    kpiCasilla({
      name:'Checks completed', icon:'check',
      value: c == null ? '—' : c.toFixed(0), unit: c == null ? '' : '%',
      target: c == null ? 'Nothing scheduled' : 'Target ≥ '+KPI_TARGETS.checks+'%',
      estado: kpiEstado(c, KPI_TARGETS.checks, true, 3),
      foot: kpiDelta(c, cp, true)
    }),
    kpiCasilla({
      name:'Open CAPAs', icon:'alert',
      value: abiertos.length, unit:'',
      target: tarde ? tarde + ' overdue' : 'None overdue',
      estado: tarde > KPI_TARGETS.capaOverdue ? 'bad' : 'ok'
    }),
    t.modo === 'exc'
      ? kpiCasilla({
          name:'Temp. excursions', icon:'thermo', value:t.n, unit:'',
          target:'Of '+t.de+' readings',
          estado: kpiEstado(t.n, KPI_TARGETS.tempExc, false, 1)
        })
      : kpiCasilla({
          name:'Temp. checkpoints', icon:'thermo',
          value: t.de ? (t.de - t.n) + '/' + t.de : '—', unit:'',
          target: t.de ? t.n + ' missing of ' + t.de : 'Nothing scheduled',
          estado: !t.de ? 'none' : (t.n === 0 ? 'ok' : t.n <= 1 ? 'warn' : 'bad')
        })
  ].join('');
  renderIcons(host);
}

// Una fila por dia con lo que hace falta en graficas y chispas.
function kpiSerieDiaria(dias){
  var out = [];
  for(var i = dias - 1; i >= 0; i--){
    var dia = kpiFecha(i), v = {ini:dia, fin:dia};
    var w = kpiCompPeso(kpiPesos(v)), s = kpiCompSello(kpiSellos(v));
    out.push({date:dia, peso:w.pct, pesoN:w.n, pesoFuera:w.n - w.ok, sello:s.pct});
  }
  return out;
}

// ------------------------------------------------------------------
// Grafica de linea: cumplimiento de peso por dia
// ------------------------------------------------------------------
function kpiPintaPeso(){
  var caja = document.getElementById('kd-ch-weight');
  if(!caja) return;
  caja.innerHTML = '';
  var serie = kpiSerieDiaria(Math.max(kpiState.days, 7))
                .filter(function(d){ return d.peso != null; });
  if(!serie.length){ caja.innerHTML = '<div class="kd-none">No weight checks in this period.</div>'; return; }

  var W = caja.clientWidth || 700, H = 240, m = {t:12, r:46, b:26, l:38};
  var svg = kpiEl('svg', {viewBox:'0 0 '+W+' '+H, height:H, role:'img',
                          'aria-label':'Weight compliance per day'}, caja);
  var minV = Math.min.apply(null, serie.map(function(d){ return d.peso; }));
  var lo = Math.min(90, Math.floor(minV/2)*2), hi = 100;
  var x = function(i){ return serie.length === 1 ? m.l + (W-m.l-m.r)/2
                                                 : m.l + i*(W-m.l-m.r)/(serie.length-1); };
  var y = function(v){ return m.t + (hi-v)/(hi-lo)*(H-m.t-m.b); };

  for(var g = lo; g <= hi; g += (hi-lo)/4){
    kpiEl('line', {x1:m.l, x2:W-m.r, y1:y(g), y2:y(g), stroke:'var(--border)', 'stroke-width':1}, svg);
    kpiEl('text', {x:m.l-6, y:y(g)+4, 'text-anchor':'end', class:'kd-ax'}, svg)
      .textContent = Math.round(g)+'%';
  }
  var paso = Math.ceil(serie.length/7);
  serie.forEach(function(d,i){
    if(i % paso === 0 || i === serie.length-1)
      kpiEl('text', {x:x(i), y:H-6, 'text-anchor':'middle', class:'kd-ax'}, svg)
        .textContent = kpiDiaCorto(d.date);
  });
  // el objetivo, de puntos
  var yo = y(KPI_TARGETS.weight);
  kpiEl('line', {x1:m.l, x2:W-m.r, y1:yo, y2:yo, stroke:'var(--dim)',
                 'stroke-width':1, 'stroke-dasharray':'4 3'}, svg);
  kpiEl('text', {x:W-m.r+4, y:yo+4, class:'kd-ax'}, svg).textContent = KPI_TARGETS.weight+'%';

  var pts = serie.map(function(d,i){ return x(i)+','+y(d.peso); }).join(' L');
  kpiEl('path', {d:'M'+x(0)+','+y(lo)+' L'+pts+' L'+x(serie.length-1)+','+y(lo)+'Z',
                 fill:'var(--accent-tint)'}, svg);
  kpiEl('path', {d:'M'+pts, fill:'none', stroke:'var(--accent)', 'stroke-width':2,
                 'stroke-linejoin':'round', 'stroke-linecap':'round'}, svg);
  // los dias por debajo del objetivo se marcan: son los que hay que mirar
  serie.forEach(function(d,i){
    if(d.peso < KPI_TARGETS.weight)
      kpiEl('circle', {cx:x(i), cy:y(d.peso), r:4, fill:'var(--fail)',
                       stroke:'var(--surface)', 'stroke-width':2}, svg);
  });
  var ult = serie[serie.length-1];
  kpiEl('circle', {cx:x(serie.length-1), cy:y(ult.peso), r:4.5, fill:'var(--accent)',
                   stroke:'var(--surface)', 'stroke-width':2}, svg);
  kpiEl('text', {x:x(serie.length-1)+8, y:y(ult.peso)-8, class:'kd-val'}, svg)
    .textContent = ult.peso.toFixed(1)+'%';

  var cruz = kpiEl('line', {y1:m.t, y2:H-m.b, stroke:'var(--border)', 'stroke-width':1, opacity:0}, svg);
  var pt   = kpiEl('circle', {r:5, fill:'var(--accent)', stroke:'var(--surface)',
                              'stroke-width':2, opacity:0}, svg);
  var zona = kpiEl('rect', {x:m.l, y:0, width:W-m.l-m.r, height:H, fill:'transparent'}, svg);
  var tip  = kpiGlobo(caja);
  zona.addEventListener('mousemove', function(e){
    var r = svg.getBoundingClientRect(), px = (e.clientX-r.left)*W/r.width;
    var ancho = (W-m.l-m.r)/Math.max(1, serie.length-1);
    var i = Math.max(0, Math.min(serie.length-1, Math.round((px-m.l)/ancho)));
    var d = serie[i];
    cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('opacity', 1);
    pt.setAttribute('cx', x(i)); pt.setAttribute('cy', y(d.peso)); pt.setAttribute('opacity', 1);
    tip.ver('<b>'+kpiDiaCorto(d.date)+' · '+d.peso.toFixed(1)+'%</b>'+
            (d.pesoN-d.pesoFuera)+' of '+d.pesoN+' samples in range',
            x(i)*r.width/W, y(d.peso)*r.height/H);
  });
  zona.addEventListener('mouseleave', function(){
    tip.ocultar(); cruz.setAttribute('opacity',0); pt.setAttribute('opacity',0);
  });
}

// ------------------------------------------------------------------
// Lista de avance: lo capturado contra lo programado
// ------------------------------------------------------------------
function kpiPintaCapturas(){
  var host = document.getElementById('kd-progress');
  if(!host) return;
  var datos = kpiCapturas(kpiVentana(kpiState.days, 0));
  if(!kpiSuma(datos, function(d){ return d.sched; })){
    host.innerHTML = '<div class="kd-none">Nothing scheduled for this period.<br>'+
      'The plan comes from Production Schedule.</div>';
    return;
  }
  host.innerHTML = datos.map(function(d){
    var p = d.sched ? Math.min(100, (d.done/d.sched)*100) : null;
    var corto = p != null && p < KPI_TARGETS.checks;
    return '<button class="kd-prog" type="button" onclick="kpiIr(\''+d.mod+'\',\''+d.screen+'\')">'+
      '<span class="kd-prog-n">'+esc(d.name)+'</span>'+
      '<span class="kd-track" title="'+d.done+' of '+d.sched+'">'+
        '<span class="kd-fill" style="width:'+(p||0).toFixed(1)+'%"></span></span>'+
      '<span class="kd-prog-v">'+
        (corto ? '<span class="kd-short" aria-label="below target">▼ </span>' : '')+
        (p == null ? '—' : p.toFixed(0)+'%')+
        ' <span class="kd-cap">('+d.done+'/'+d.sched+')</span></span>'+
    '</button>';
  }).join('');
}

// ------------------------------------------------------------------
// Columnas: muestras fuera de rango por linea
// ------------------------------------------------------------------
function kpiPintaLineas(){
  var caja = document.getElementById('kd-ch-line');
  if(!caja) return;
  caja.innerHTML = '';
  var pesos = kpiPesos(kpiVentana(kpiState.days, 0)).filter(function(r){ return r.pass != null; });
  if(!pesos.length){ caja.innerHTML = '<div class="kd-none">No weight checks in this period.</div>'; return; }

  var porLinea = {};
  pesos.forEach(function(r){
    var L = String(r.line||'—');
    if(!porLinea[L]) porLinea[L] = {L:L, fuera:0, n:0};
    porLinea[L].fuera += (r.total - r.pass);
    porLinea[L].n     += r.total;
  });
  var datos = Object.keys(porLinea).sort().map(function(k){ return porLinea[k]; });

  var W = caja.clientWidth || 500, H = 220, m = {t:22, r:8, b:26, l:8};
  var svg = kpiEl('svg', {viewBox:'0 0 '+W+' '+H, height:H, role:'img',
                          'aria-label':'Out-of-range samples by line'}, caja);
  var max = Math.max(1, Math.max.apply(null, datos.map(function(d){ return d.fuera; })));
  var banda = (W-m.l-m.r)/datos.length, bw = Math.min(26, banda*0.5);
  kpiEl('line', {x1:m.l, x2:W-m.r, y1:H-m.b, y2:H-m.b, stroke:'var(--border)', 'stroke-width':1}, svg);
  var tip = kpiGlobo(caja);
  datos.forEach(function(d,i){
    var cx = m.l + banda*i + banda/2;
    var h  = (d.fuera/max)*(H-m.t-m.b), yy = H-m.b-h;
    if(d.fuera) kpiEl('path', {d:kpiBarra(cx-bw/2, yy, bw, h), fill:'var(--accent)'}, svg);
    kpiEl('text', {x:cx, y:(d.fuera?yy:H-m.b)-6, 'text-anchor':'middle', class:'kd-val'}, svg)
      .textContent = d.fuera;
    kpiEl('text', {x:cx, y:H-8, 'text-anchor':'middle', class:'kd-ax'}, svg)
      .textContent = 'Line '+d.L;
    var zona = kpiEl('rect', {x:cx-banda/2, y:0, width:banda, height:H, fill:'transparent'}, svg);
    zona.addEventListener('mousemove', function(){
      var r = svg.getBoundingClientRect();
      tip.ver('<b>Line '+d.L+'</b>'+d.fuera+' out of '+d.n+' samples · '+
              (100-(d.fuera/d.n)*100).toFixed(1)+'% in range',
              cx*r.width/W, yy*r.height/H);
    });
    zona.addEventListener('mouseleave', tip.ocultar);
  });
}

// ------------------------------------------------------------------
// Barras horizontales: CAPA abiertos por severidad
// ------------------------------------------------------------------
function kpiPintaCapa(){
  var caja = document.getElementById('kd-ch-capa');
  if(!caja) return;
  caja.innerHTML = '';
  var abiertos = kpiCapaAbiertos();
  if(!abiertos.length){ caja.innerHTML = '<div class="kd-none">No open CAPA reports.</div>'; return; }
  var datos = ['major','moderate','minimal'].map(function(k){
    var l = abiertos.filter(function(c){ return c.severity === k; });
    return {k:k, label:(CAPA_SEV[k]||{}).label || k, n:l.length, tarde:l.filter(capaOverdue).length};
  });

  var W = caja.clientWidth || 500, altoFila = 52, H = datos.length*altoFila + 8, lw = 84, rw = 100;
  var svg = kpiEl('svg', {viewBox:'0 0 '+W+' '+H, height:H, role:'img',
                          'aria-label':'Open CAPAs by severity'}, caja);
  var max = Math.max(1, Math.max.apply(null, datos.map(function(d){ return d.n; })));
  var tip = kpiGlobo(caja);
  datos.forEach(function(d,i){
    var y = i*altoFila + 14, bh = 20, w = (d.n/max)*(W-lw-rw);
    kpiEl('text', {x:0, y:y+14, class:'kd-ax kd-ax-fuerte'}, svg).textContent = d.label;
    kpiEl('rect', {x:lw, y:y, width:W-lw-rw, height:bh, rx:4, fill:'var(--surface2)'}, svg);
    if(d.n) kpiEl('path', {d:kpiBarra(lw, y, w, bh, true), fill:'var(--accent)'}, svg);
    kpiEl('text', {x:lw+w+8, y:y+15, class:'kd-val'}, svg).textContent = d.n;
    if(d.tarde)
      kpiEl('text', {x:W, y:y+15, 'text-anchor':'end', class:'kd-ax kd-ax-mal'}, svg)
        .textContent = '⚠ '+d.tarde+' overdue';
    var zona = kpiEl('rect', {x:0, y:y-8, width:W, height:altoFila-4, fill:'transparent'}, svg);
    zona.addEventListener('mousemove', function(){
      var r = svg.getBoundingClientRect();
      tip.ver('<b>'+d.label+'</b>'+d.n+' open · '+d.tarde+' overdue',
              (lw+w/2)*r.width/W, y*r.height/H);
    });
    zona.addEventListener('mouseleave', tip.ocultar);
  });
}

// ------------------------------------------------------------------
// La tabla: lo que hay que mirar
// ------------------------------------------------------------------
function kpiPintaPendiente(){
  var cuerpo = document.getElementById('kd-attn');
  var vacio  = document.getElementById('kd-attn-empty');
  if(!cuerpo) return;
  var v = kpiVentana(kpiState.days, 0), filas = [];

  // orden: lo que no puede esperar primero. Dentro de cada clase, lo mas
  // reciente arriba.
  kpiCapaAbiertos().filter(capaOverdue).forEach(function(c){
    filas.push({orden:0, tipo:'CAPA overdue', ref:c.reportNumber||'—',
      donde:c.product||'—', detalle:c.problem||'—', fecha:c.capaDate,
      cls:'bad', estado:'✕ Overdue', mod:'qa', screen:'screen-capa'});
  });
  if(typeof getHolds === 'function'){
    getHolds().filter(function(h){ return h.status === 'hold'; }).forEach(function(h){
      filas.push({orden:1, tipo:'Hold', ref:h.holdNumber||'—', donde:h.product||'—',
        detalle:h.reason||'Product on hold', fecha:kpiDia(h), cls:'warn', estado:'! On hold',
        mod:'qa', screen:'screen-hold'});
    });
  }
  kpiSellos(v).forEach(function(r){
    var fallan = SEAL_CHECKS.filter(function(c){ return (r.checks||{})[c] === 'fail'; });
    if(!fallan.length) return;
    filas.push({orden:2, tipo:'Seal Bags', ref:r.lot||'—', donde:'Line '+(r.line||'—'),
      detalle:'Failed: '+fallan.join(', '), fecha:kpiDia(r), cls:'bad', estado:'✕ Failed',
      mod:'qa', screen:'screen-seal'});
  });
  // Una muestra de cinco fuera de rango es el dia a dia de una linea y llenaba
  // la tabla de ruido. Aqui solo entra la revision que fallo por la mitad o
  // mas: esa si hay que mirarla.
  kpiPesos(v).forEach(function(r){
    if(r.pass == null) return;
    var fuera = r.total - r.pass;
    if(fuera < 2 || fuera * 2 < r.total) return;
    filas.push({orden:3, tipo:'Weights', ref:r.lot||'—', donde:'Line '+(r.line||'—'),
      detalle:fuera+' of '+r.total+' samples out of range',
      fecha:kpiDia(r), cls:'warn', estado:'! Review', mod:'qa', screen:'screen-weight'});
  });

  filas.sort(function(a,b){
    return (a.orden - b.orden) || (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  });
  var lista = filas.slice(0, 12);
  cuerpo.innerHTML = lista.map(function(r){
    return '<tr onclick="kpiIr(\''+r.mod+'\',\''+r.screen+'\')">'+
      '<td>'+esc(r.tipo)+'</td>'+
      '<td class="nt-mono">'+esc(r.ref)+'</td>'+
      '<td>'+esc(r.donde)+'</td>'+
      '<td class="nt-wide">'+esc(r.detalle)+'</td>'+
      '<td>'+esc(r.fecha ? kpiDiaCorto(r.fecha) : '—')+'</td>'+
      '<td><span class="kd-badge '+r.cls+'">'+r.estado+'</span></td></tr>';
  }).join('');
  if(vacio) vacio.hidden = lista.length > 0;
  var n = document.getElementById('kd-attn-n');
  if(n) n.textContent = filas.length > lista.length
    ? 'Showing '+lista.length+' of '+filas.length : '';
}

// ------------------------------------------------------------------
// Controles y pintado
// ------------------------------------------------------------------
function kpiIr(mod, screen){
  if(typeof canSeeScreen === 'function' && !canSeeScreen(screen)) return;
  if(typeof snavGo === 'function') snavGo(mod, screen);
  else if(typeof goTo === 'function') goTo(screen);
}
function kpiPeriodo(dias, btn){
  kpiState.days = dias;
  var caja = document.getElementById('kd-range');
  if(caja) caja.querySelectorAll('.seg').forEach(function(b){ b.classList.toggle('on', b === btn); });
  renderHomeKPI();
}
function kpiFiltro(){
  if(typeof nxMarkKpiDirty==='function') nxMarkKpiDirty(false);
  var l = document.getElementById('kd-line'), s = document.getElementById('kd-shift');
  kpiState.line  = l ? l.value : 'all';
  kpiState.shift = s ? s.value : 'all';
  renderHomeKPI();
}

function renderHomeKPI(){
  var host = document.getElementById('kd-kpis');
  if(!host || !currentUser) return;

  var v = kpiVentana(kpiState.days, 0);
  var r = document.getElementById('kd-range-label');
  if(r){
    r.textContent =
      (kpiState.days === 1 ? 'Today' : kpiDiaCorto(v.ini)+' – today') +
      ' · ' + (kpiState.line  === 'all' ? 'All lines'  : 'Line '+kpiState.line) +
      ' · ' + (kpiState.shift === 'all' ? 'All shifts'
                    : kpiState.shift+(kpiState.shift === '1' ? 'st' : 'nd')+' shift');
  }
  kpiPintaCasillas();
  if(typeof nxRenderTrend==='function') nxRenderTrend(); else kpiPintaPeso();
  kpiPintaCapturas();
  kpiPintaLineas();
  kpiPintaCapa();
  kpiPintaPendiente();
  if(typeof nxRenderInsights==='function') nxRenderInsights();
  if(typeof nxEnhanceCharts==='function') nxEnhanceCharts();
}

// Las graficas se miden en pixeles, asi que al cambiar el ancho hay que
// rehacerlas. Se espera a que el usuario suelte para no dibujar sesenta veces.
var kpiResizeT = null;
window.addEventListener('resize', function(){
  var home = document.getElementById('screen-home');
  if(!home || !home.classList.contains('active')) return;
  clearTimeout(kpiResizeT);
  kpiResizeT = setTimeout(renderHomeKPI, 150);
});
