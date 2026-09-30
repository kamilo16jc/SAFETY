// ===== LAS GRAFICAS DEL TABLERO =====
// Dibujadas a mano en SVG, no con una libreria: asi el trazo es fino, la
// cuadricula se aparta y el color dice una sola cosa. Reglas que se siguen:
//
//   · Una serie por grafica. Si hay dos medidas, son dos graficas, nunca dos
//     ejes en la misma — es la forma mas comun de mentir con un grafico.
//   · El largo de la barra ya dice la magnitud, asi que el color no la repite:
//     una sola tinta, y la cifra escrita al lado.
//   · El verde, el ambar y el rojo son ESTADO, y nunca van solos: siempre con
//     su numero o su palabra al lado. En modo oscuro un daltonico protan no
//     separa el verde del ambar de nuestros tokens (medido con el validador:
//     dE 5.1), asi que la cifra es la que manda y el color solo acompaña.
//   · Todo lo que se dibuja se puede leer tambien como tabla.
//
// El lienzo se mide en pixeles reales (no en porcentaje) para que el trazo no
// se deforme al estirarse; un ResizeObserver lo vuelve a dibujar si cambia.

var DASH_TABLE = {};       // datos de cada grafica, para el boton de tabla

function dcEsc(s){
  return String(s==null?'':s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
}
function dcPlain(s){      // para el atributo title: sin etiquetas ni comillas
  return dcEsc(String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/"/g,''));
}
function dcN(v){ return Math.round(v*100)/100; }

// ---- Tendencia: una serie, area suave, cruz y globo al pasar el raton ----
function dcTrend(hostId, puntos, opts){
  var host = document.getElementById(hostId);
  if(!host) return;
  opts = opts || {};
  puntos = puntos || [];
  var suf = opts.suffix || '';

  DASH_TABLE[hostId] = {cols:[opts.xName||'Day', opts.yName||'Value'],
    rows:puntos.map(function(p){ return [p.label, p.value+suf]; })};

  // Se recuerda lo dibujado: al cambiar el ancho se repinta con los mismos datos
  host._dcData = {p:puntos, o:opts};
  if(window.ResizeObserver && !host._dcRO){
    host._dcRO = new ResizeObserver(function(){
      var w = host.clientWidth;
      if(!w || w === host._dcW) return;              // sin cambio de ancho, nada
      clearTimeout(host._dcT);
      host._dcT = setTimeout(function(){
        if(host._dcData) dcTrend(hostId, host._dcData.p, host._dcData.o);
      }, 120);
    });
    host._dcRO.observe(host);
  }

  if(!puntos.length){
    host.innerHTML = '<div class="dc-empty">'+(opts.empty||'No data in this range')+'</div>';
    return;
  }

  var W = Math.max(280, Math.round(host.clientWidth || 520));
  var H = opts.height || 176;
  host._dcW = host.clientWidth;
  var pad = {l:36, r:14, t:14, b:24};   // a la izquierda cabe el 100%
  var min = opts.min!=null ? opts.min : 0;
  var max = opts.max!=null ? opts.max : 100;
  var n = puntos.length;
  var x = function(i){ return n===1 ? (pad.l + (W-pad.l-pad.r)/2)
                                    : pad.l + (i/(n-1))*(W-pad.l-pad.r); };
  var y = function(v){
    var t = (Math.max(min, Math.min(max, v)) - min) / ((max - min) || 1);
    return H - pad.b - t*(H - pad.t - pad.b);
  };

  var linea = puntos.map(function(p,i){
    return (i?'L':'M')+dcN(x(i))+','+dcN(y(p.value));
  }).join(' ');
  var area = linea + ' L'+dcN(x(n-1))+','+(H-pad.b)+' L'+dcN(x(0))+','+(H-pad.b)+' Z';

  // Rejilla que se aparta: tres lineas, sin marco, con su cifra a la izquierda
  var guias = (opts.guides || [min, (min+max)/2, max]).map(function(v){
    return '<line class="dc-grid" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+dcN(y(v))+'" y2="'+dcN(y(v))+'"/>'+
      '<text class="dc-tick" x="'+(pad.l-7)+'" y="'+dcN(y(v))+'" text-anchor="end" dominant-baseline="middle">'+
      v+suf+'</text>';
  }).join('');

  // Banda de objetivo: dice donde hay que estar, sin gritar. Su cifra va en el
  // eje, con el color del estado, para no cruzarse con la linea.
  var banda = '';
  if(opts.target != null){
    banda = '<rect class="dc-band" x="'+pad.l+'" y="'+dcN(y(max))+'" width="'+(W-pad.l-pad.r)+
              '" height="'+dcN(y(opts.target)-y(max))+'"/>'+
            '<line class="dc-target" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+dcN(y(opts.target))+
              '" y2="'+dcN(y(opts.target))+'"/>'+
            '<text class="dc-tick dc-tick-tg" x="'+(pad.l-7)+'" y="'+dcN(y(opts.target))+
              '" text-anchor="end" dominant-baseline="middle">'+opts.target+suf+'</text>';
  }

  var dots = n<=31 ? puntos.map(function(p,i){
    return '<circle class="dc-dot" cx="'+dcN(x(i))+'" cy="'+dcN(y(p.value))+'" r="2.4"/>';
  }).join('') : '';

  // Fechas: la primera, la del medio y la ultima. Mas que eso se amontona.
  var marcas = n===1 ? [0] : n<5 ? [0, n-1] : [0, Math.floor((n-1)/2), n-1];
  var ejeX = marcas.map(function(i){
    var anc = i===0 ? 'start' : i===n-1 ? 'end' : 'middle';
    return '<text class="dc-tick" x="'+dcN(x(i))+'" y="'+(H-6)+'" text-anchor="'+anc+'">'+
      dcEsc(puntos[i].label)+'</text>';
  }).join('');

  // Zonas de contacto anchas: el raton no tiene que acertarle al punto
  var paso = n===1 ? (W-pad.l-pad.r) : (W-pad.l-pad.r)/(n-1);
  var zonas = puntos.map(function(p,i){
    var x0 = Math.max(0, x(i)-paso/2), an = Math.min(paso, W-x0);
    return '<rect class="dc-hit" x="'+dcN(x0)+'" y="'+pad.t+'" width="'+dcN(an)+
      '" height="'+(H-pad.t-pad.b)+'" data-x="'+dcN(x(i))+'" data-y="'+dcN(y(p.value))+
      '" data-label="'+dcEsc(p.label)+'" data-value="'+dcEsc(p.value+suf)+
      '" data-note="'+dcEsc(p.note||'')+'"/>';
  }).join('');

  host.innerHTML =
    '<div class="dc-wrap">'+
      '<svg class="dc-svg" width="100%" height="'+H+'" viewBox="0 0 '+W+' '+H+'" '+
        'preserveAspectRatio="none" role="img" aria-label="'+dcEsc(opts.aria||'Trend')+'">'+
        guias + banda +
        (min===0 && opts.area!==false ? '<path class="dc-area" d="'+area+'"/>' : '')+
        '<path class="dc-line" d="'+linea+'"/>'+
        dots + ejeX +
        '<line class="dc-cross" x1="0" x2="0" y1="'+pad.t+'" y2="'+(H-pad.b)+'" style="opacity:0"/>'+
        '<circle class="dc-mark" r="4" style="opacity:0"/>'+
        zonas +
      '</svg>'+
      '<div class="dc-tip" hidden></div>'+
    '</div>';

  var svg   = host.querySelector('.dc-svg'),   tip  = host.querySelector('.dc-tip');
  var cross = host.querySelector('.dc-cross'), mark = host.querySelector('.dc-mark');
  var mostrar = function(z){
    var px = parseFloat(z.getAttribute('data-x')), py = parseFloat(z.getAttribute('data-y'));
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.opacity = 1;
    mark.setAttribute('cx', px);  mark.setAttribute('cy', py);  mark.style.opacity = 1;
    tip.innerHTML = '<b>'+z.getAttribute('data-value')+'</b><span>'+z.getAttribute('data-label')+
      (z.getAttribute('data-note') ? ' · '+z.getAttribute('data-note') : '')+'</span>';
    tip.hidden = false;
    tip.style.left = (px / W * 100).toFixed(2) + '%';       // el svg se estira: en %
  };
  Array.prototype.forEach.call(host.querySelectorAll('.dc-hit'), function(z){
    z.addEventListener('mouseenter', function(){ mostrar(z); });
    z.addEventListener('touchstart', function(){ mostrar(z); }, {passive:true});
  });
  svg.addEventListener('mouseleave', function(){
    cross.style.opacity = 0; mark.style.opacity = 0; tip.hidden = true;
  });
}

// ---- Barras horizontales: una sola tinta, el numero siempre escrito ----
// items: [{label, value, sub, pct, cls}]   cls: ok | warn | bad | (nada)
function dcBarsHTML(items, opts){
  opts = opts || {};
  items = items || [];
  if(!items.length) return '<div class="dc-empty">'+(opts.empty||'No data')+'</div>';
  var mx = opts.max || 100;
  return '<div class="dc-bars">'+ items.map(function(i){
    var t = (i.cls==='bad'||i.cls==='warn'||i.cls==='ok') ? i.cls : 'ink';
    var pct = Math.max(0, Math.min(100, (i.pct||0)/mx*100));
    return '<div class="dc-bar" title="'+dcPlain(i.label)+' · '+dcPlain(i.value)+
        (i.sub?' · '+dcPlain(i.sub):'')+'">'+
      '<span class="dc-bar-lbl">'+i.label+'</span>'+
      '<span class="dc-bar-track">'+
        (opts.target!=null ? '<i class="dc-bar-tg" style="left:'+(opts.target/mx*100)+'%"></i>' : '')+
        '<i class="dc-bar-fill dc-f-'+t+'" style="width:'+pct.toFixed(1)+'%"></i></span>'+
      '<span class="dc-bar-val dc-'+t+'">'+i.value+'</span>'+
      '<span class="dc-bar-n">'+(i.sub||'')+'</span>'+
    '</div>';
  }).join('') + '</div>';
}
// ---- Reparto: una barra apilada, con hueco entre tramos y etiqueta directa ----
function dcSplit(hostId, partes, opts){
  var host = document.getElementById(hostId);
  if(!host) return;
  opts = opts || {};
  var total = partes.reduce(function(a,p){ return a + p.value; }, 0);
  DASH_TABLE[hostId] = {cols:['Part','Bags','%'],
    rows:partes.map(function(p){ return [p.label, p.value, total?Math.round(p.value/total*100)+'%':'—']; })};
  if(!total){
    host.innerHTML = '<div class="dc-empty">'+(opts.empty||'No bags weighed in this range')+'</div>';
    return;
  }

  host.innerHTML =
    '<div class="dc-split">'+ partes.map(function(p){
      var pc = p.value/total*100;
      return '<i class="dc-seg dc-f-'+p.tone+'" style="width:'+pc.toFixed(2)+'%" '+
        'title="'+dcPlain(p.label)+': '+p.value+' ('+Math.round(pc)+'%)"></i>';
    }).join('') + '</div>'+
    '<div class="dc-keys">'+ partes.map(function(p){
      return '<span class="dc-key"><i class="dc-f-'+p.tone+'"></i>'+
        '<b>'+p.value.toLocaleString()+'</b> '+dcEsc(p.label)+
        ' <span class="dc-key-pc">'+Math.round(p.value/total*100)+'%</span></span>';
    }).join('') + '</div>';
}

// ---- La misma informacion, en tabla ----
function dcToggleTable(hostId, btn){
  var host = document.getElementById(hostId);
  var datos = DASH_TABLE[hostId];
  if(!host || !datos) return;
  var abierta = host.parentNode.querySelector('.dc-table');
  if(abierta){ abierta.remove(); if(btn) btn.setAttribute('aria-expanded','false'); return; }
  var t = document.createElement('div');
  t.className = 'dc-table';
  t.innerHTML = '<table><thead><tr>'+datos.cols.map(function(c){ return '<th>'+dcEsc(c)+'</th>'; }).join('')+
    '</tr></thead><tbody>'+datos.rows.map(function(r){
      return '<tr>'+r.map(function(c){ return '<td>'+dcEsc(c)+'</td>'; }).join('')+'</tr>'; }).join('')+
    '</tbody></table>';
  host.parentNode.appendChild(t);
  if(btn) btn.setAttribute('aria-expanded','true');
}
