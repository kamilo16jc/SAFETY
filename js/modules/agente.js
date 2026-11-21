// ===== EL ASISTENTE: LA VENTANA Y LAS RESPUESTAS =====
// Se abre con el boton ✦ de arriba (o menu del usuario > Assistant). La persona
// escribe como habla; agEntender (agente-entender.js) lo convierte en la orden
// fija y agEjecutar (agente-fuentes.js) la busca en los datos del equipo. Todo
// se arma aqui: nada sale de la app (fase 1). Arriba de cada respuesta se dice
// lo que se entendio, para que se vea si se interpreto bien.
//
// La conversacion vive en la sesion (sessionStorage) y cada respuesta se vuelve
// a calcular al abrir: siempre con los datos de ahora. Las preguntas que no se
// entendieron se apuntan en este equipo (localStorage): son las que hay que
// enseñarle (y, en la fase 2, las que pasaran por la IA traductora).

var AG_CHAT = 'nx-ag-chat', AG_DUDAS = 'nx-ag-dudas';
var agRefs = [];

function agChat(){ try{ return JSON.parse(sessionStorage.getItem(AG_CHAT) || '[]'); }catch(e){ return []; } }
function agGuardarChat(l){ try{ sessionStorage.setItem(AG_CHAT, JSON.stringify(l.slice(-30))); }catch(e){} }
function agDudas(){ try{ return JSON.parse(localStorage.getItem(AG_DUDAS) || '[]'); }catch(e){ return []; } }
function agApuntarDuda(texto){
  var l = agDudas();
  l.push({q:String(texto).slice(0, 200), at:localISOStr()});
  try{ localStorage.setItem(AG_DUDAS, JSON.stringify(l.slice(-100))); }catch(e){}
}
function agIdiomaBase(){ return String(navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en'; }

// ------------------------------------------------------------------
// La ventana
// ------------------------------------------------------------------
function agConstruir(){
  if(document.getElementById('ag')) return;
  var a = document.createElement('aside');
  a.className = 'ag'; a.id = 'ag'; a.hidden = true;
  a.setAttribute('role', 'dialog'); a.setAttribute('aria-label', 'Assistant');
  a.innerHTML =
    '<header class="ag-head"><span class="ag-ico" data-icon="spark"></span>'+
      '<div class="ag-tit"><b>Assistant</b><small>From this device · nothing leaves the app</small></div>'+
      '<button type="button" class="ag-hb" onclick="agAyudaPanel()" aria-label="Help" data-tip="What can I ask?">?</button>'+
      '<button type="button" class="ag-hb" onclick="agLimpiar()" aria-label="Clear the conversation" data-tip="Clear"><span data-icon="trash"></span></button>'+
      '<button type="button" class="ag-hb" onclick="agCerrar()" aria-label="Close"><span data-icon="close"></span></button></header>'+
    '<div class="ag-body" id="ag-body" aria-live="polite"></div>'+
    '<form class="ag-foot" onsubmit="agEnviar(event)">'+
      '<input id="ag-in" autocomplete="off" maxlength="200" placeholder="Ask… e.g. last metal detector check on line 3" aria-label="Ask the assistant">'+
      '<button type="submit" aria-label="Ask"><span data-icon="send"></span></button></form>';
  document.body.appendChild(a);
  if(typeof renderIcons === 'function') renderIcons(a);
  document.addEventListener('keydown', function(e){
    var p = document.getElementById('ag');
    if(e.key === 'Escape' && p && !p.hidden && !document.querySelector('#record-modal[style*="flex"]')) agCerrar();
  });
}
function agAbrir(){
  agConstruir();
  var m = document.getElementById('user-menu'); if(m) m.classList.remove('open');
  var p = document.getElementById('ag');
  p.hidden = false;
  document.body.classList.add('ag-abierto');
  agPintar();
  setTimeout(function(){ var i = document.getElementById('ag-in'); if(i) i.focus(); }, 60);
}
function agCerrar(){
  var p = document.getElementById('ag');
  if(p) p.hidden = true;
  document.body.classList.remove('ag-abierto');
}
function agLimpiar(){ agGuardarChat([]); agPintar(); }
function agEnviar(e){
  if(e) e.preventDefault();
  var i = document.getElementById('ag-in');
  var v = i ? i.value.trim() : '';
  if(!v) return;
  i.value = '';
  agPreguntar(v);
}
function agPreguntar(texto){
  agConstruir();
  var p = document.getElementById('ag');
  if(p && p.hidden) agAbrir();
  var l = agChat();
  l.push({q:texto, at:localISOStr()});
  agGuardarChat(l);
  var q = agEntender(texto);
  if(!q.entendido) agApuntarDuda(texto);
  // "abre temperaturas": se va de una vez
  if(q.entendido && q.tipo === 'abrir'){ agPintar(); agIrPantalla(q.pantalla); return; }
  agPintar();
}

// Repinta toda la conversacion con los datos de AHORA
function agPintar(){
  var b = document.getElementById('ag-body');
  if(!b) return;
  agRefs = [];
  var l = agChat();
  if(!l.length){ b.innerHTML = agBienvenida(); if(typeof renderIcons === 'function') renderIcons(b); return; }
  b.innerHTML = l.map(function(m){
    var q = agEntender(m.q);
    agLang = q.lang;
    return '<div class="ag-msg ag-yo">'+agEsc(m.q)+'</div><div class="ag-msg ag-el">'+agRespuesta(q)+'</div>';
  }).join('');
  if(typeof renderIcons === 'function') renderIcons(b);
  b.scrollTop = b.scrollHeight;
}

function agSugerencias(lang){
  return lang === 'es'
    ? ['¿Qué me falta en el turno?', 'Última verificación del metal detector de la línea 3', 'Pesos fuera de rango hoy', '¿Cuál es el LOT de hoy?', 'CAPAs abiertos', '¿Cuánto produjo cada línea hoy?']
    : ['What is pending this shift?', 'Last metal detector check on line 3', 'Weights out of range today', 'Today’s LOT', 'Open CAPAs', 'How much did each line make today?'];
}
function agChips(lista){
  return '<div class="ag-sug">'+lista.map(function(s){
    return '<button type="button" onclick="agPreguntar(this.textContent)">'+agEsc(s)+'</button>';
  }).join('')+'</div>';
}
function agBienvenida(){
  var es = agIdiomaBase() === 'es';
  return '<div class="ag-hola"><span class="ag-ico grande" data-icon="spark"></span>'+
    '<b>'+(es ? '¿Qué quieres saber?' : 'What do you want to know?')+'</b>'+
    '<p>'+(es ? 'Pregunta como hablas, en español o inglés. Busco en los datos de este equipo; nada sale de la app.'
              : 'Ask the way you talk, in English or Spanish. I search the data on this device; nothing leaves the app.')+'</p></div>'+
    agChips(agSugerencias(es ? 'es' : 'en'));
}

// ------------------------------------------------------------------
// Las respuestas
// ------------------------------------------------------------------
var AG_ACCION = {ultimo:['el último', 'the last one'], lista:['lista', 'list'], contar:['cuántos', 'how many'],
  porcentaje:['% que pasa', '% passing'], promedio:['promedio', 'average'], sumar:['total', 'total'],
  peor:['la peor línea', 'worst line'], mejor:['la mejor línea', 'best line'], maximo:['el más alto', 'the highest'],
  minimo:['el más bajo', 'the lowest'], agrupar:['agrupado', 'grouped']};
var AG_CLAVE = {linea:['por línea', 'by line'], dia:['por día', 'by day'], producto:['por producto', 'by product'], causa:['por causa', 'by cause'],
  cliente:['por cliente', 'by customer'], area:['por área', 'by area'], turno:['por turno', 'by shift'], estado:['por estado', 'by status']};
function agEntendi(q){
  var f = agFuente(q.fuente), x = q.filtros || {}, c = [];
  if(f) c.push(agT(f.es, f.en));
  var ac = AG_ACCION[q.accion];
  if(ac && !(q.accion === 'lista' && !q.limite) && q.accion !== 'agrupar') c.push(q.accion === 'lista' && q.limite ? agT('los últimos ' + q.limite, 'last ' + q.limite) : agT(ac[0], ac[1]));
  if(q.agrupar && AG_CLAVE[q.agrupar]) c.push(agT(AG_CLAVE[q.agrupar][0], AG_CLAVE[q.agrupar][1]));
  if(q.campo) c.push(agCampoTxt(q.campo));
  if(x.linea) c.push(agLineaTxt(x.linea));
  if(x.turno) c.push(agTurnoTxt(x.turno));
  if(x.desde){
    var hoy = localDateStr();
    c.push(x.desde === x.hasta ? (x.desde === hoy ? agT('hoy', 'today') : agFecha(x.desde)) : agFecha(x.desde) + ' – ' + agFecha(x.hasta));
  }
  if(x.producto) c.push(agT('Producto ', 'Product ') + x.producto);
  if(x.lot) c.push('LOT ' + x.lot);
  if(x.orden) c.push('Order ' + x.orden);
  if(x.po) c.push('PO ' + x.po);
  if(q.clienteTxt) c.push(q.clienteTxt);
  if(x.estado) c.push(agEstadoTxt(x.estado));
  return '<div class="ag-ent">'+agT('Entendí: ', 'Understood: ')+c.map(function(s){ return '<span>'+agEsc(s)+'</span>'; }).join('')+agCorregidoTxt(q)+'</div>';
}
// "analisyis -> analisis": se dice que se corrigio, por si se corrigio mal
function agCorregidoTxt(q){
  if(!q.corregido || !q.corregido.length) return '';
  return '<em class="ag-cor">('+q.corregido.map(function(c){ return agEsc(c[0])+' → '+agEsc(c[1]); }).join(', ')+')</em>';
}
function agBadge(e){
  if(!e) return '';
  var cls = (e === 'pass' || e === 'done' || e === 'closed' || e === 'released' || e === 'present' || e === 'coa') ? 'ok'
          : (e === 'fail' || e === 'absent' || e === 'down' || e === 'overdue') ? 'bad' : 'warn';
  return '<span class="ag-b '+cls+'">'+agEsc(agEstadoTxt(e))+'</span>';
}
function agRef(f, r){ agRefs.push({f:f, r:r}); return agRefs.length - 1; }
function agAbrirBtn(f, r){
  return '<button type="button" class="ag-open" onclick="agVer('+agRef(f, r)+')">'+agT('Abrir', 'Open')+' <span aria-hidden="true">↗</span></button>';
}
function agPantallaBtn(f){
  return '<button type="button" class="ag-link" onclick="agIrPantalla(\''+f.pantalla+'\',\''+f.mod+'\')">'+agT('Ir a ', 'Go to ')+agEsc(agT(f.es, f.en))+' ↗</button>';
}
function agVer(i){
  var x = agRefs[i];
  if(!x) return;
  agCerrar();
  if(x.f.ver) x.f.ver(x.r); else agIrPantalla(x.f.pantalla, x.f.mod);
}
function agIrPantalla(screen, mod){
  if(typeof canSeeScreen === 'function' && !canSeeScreen(screen, undefined, mod || undefined)){
    toast(agT('Tu rol no puede abrir esa pantalla', 'Your role cannot open that screen')); return;
  }
  agCerrar();
  if(!mod && typeof MODULES !== 'undefined'){
    var m = MODULES.filter(function(mm){ return mm.items.some(function(i){ return i.screen === screen && (typeof canSeeScreen !== 'function' || canSeeScreen(screen, undefined, mm.id)); }); })[0];
    mod = m ? m.id : '';
  }
  if(typeof snavGo === 'function' && mod) snavGo(mod, screen); else goTo(screen);
}
function agCuando(f, r){
  var d = f.fecha ? f.fecha(r) : '', h = f.hora ? f.hora(r) : '';
  if(!d) return '';
  return agFecha(d) + (h ? ' · ' + agHora12(h) : '') + ' · ' + agHace(d);
}
function agTarjeta(f, r){
  var campos = (f.campos ? f.campos.call(f, r) : []).filter(function(c){ return c[1] != null && String(c[1]).trim() !== '' && String(c[1]) !== '—'; });
  return '<div class="ag-card">'+
    '<div class="ag-card-h"><b>'+agEsc(f.titulo(r))+'</b>'+agBadge(f.estado ? f.estado(r) : '')+'</div>'+
    (agCuando(f, r) ? '<div class="ag-when">'+agEsc(agCuando(f, r))+'</div>' : '')+
    (campos.length ? '<dl class="ag-dl">'+campos.map(function(c){ return '<dt>'+agEsc(c[0])+'</dt><dd>'+agEsc(c[1])+'</dd>'; }).join('')+'</dl>' : '')+
    '<div class="ag-acts">'+agAbrirBtn(f, r)+'</div></div>';
}
function agTabla(f, filas, total){
  var cols = (f.columnas || []).slice(0, 3);
  var conFecha = !!f.fecha;
  return '<div class="ag-tab"><table><thead><tr>'+(conFecha ? '<th>'+agT('Cuándo', 'When')+'</th>' : '')+
    cols.map(function(c){ return '<th>'+agEsc(c[0])+'</th>'; }).join('')+'<th></th></tr></thead><tbody>'+
    filas.map(function(r){
      var i = agRef(f, r), d = f.fecha ? f.fecha(r) : '', h = f.hora ? f.hora(r) : '';
      return '<tr onclick="agVer('+i+')">'+(conFecha ? '<td class="ag-td-f">'+agEsc(agFecha(d))+(h ? '<small>'+agEsc(agHora12(h))+'</small>' : '')+'</td>' : '')+
        cols.map(function(c){ var v = c[1](r); return '<td>'+agEsc(v == null || v === '' ? '—' : v)+'</td>'; }).join('')+
        '<td class="ag-td-e">'+agBadge(f.estado ? f.estado(r) : '')+'</td></tr>';
    }).join('')+'</tbody></table></div>'+
    '<div class="ag-pie">'+(total > filas.length ? agT('Mostrando ' + filas.length + ' de ' + total, 'Showing ' + filas.length + ' of ' + total) + ' · ' : '')+agPantallaBtn(f)+'</div>';
}
function agNada(res, q){
  var f = res.f;
  var txt = res.sinNumeros ? agT('No hay números para sacar el ' + (q.accion === 'sumar' ? 'total' : 'promedio') + '.', 'There are no numbers to ' + (q.accion === 'sumar' ? 'add up' : 'average') + '.')
          : agT('No encontré ' + agT(f.es, f.en).toLowerCase() + ' con eso.', 'I found no ' + agT(f.es, f.en).toLowerCase() + ' matching that.');
  var desde = res.desde ? agT(' En este equipo hay registros desde el ' + agFecha(res.desde) + '.', ' This device has records from ' + agFecha(res.desde) + '.') : '';
  return '<p class="ag-p">'+agEsc(txt + desde)+'</p><div class="ag-pie">'+agPantallaBtn(f)+'</div>';
}
function agNumero(res, q){
  var f = res.f, u = res.unidad || '', v = res.valor, sub = '';
  if(q.accion === 'contar'){
    var ps = Object.keys(res.partes || {}).filter(function(k){ return k !== '—'; });
    sub = ps.map(function(k){ return agBadge(k).replace('</span>', ' · ' + res.partes[k] + '</span>'); }).join(' ');
  } else if(q.accion === 'porcentaje'){
    sub = agEsc(agT(res.ok + ' de ' + res.n + ' pasaron', res.ok + ' of ' + res.n + ' passed') + (f.k === 'weights' ? agT(' (muestras)', ' (samples)') : ''));
  } else if(res.suma){
    sub = Object.keys(res.porLinea || {}).sort().map(function(k){ return '<span class="ag-b">'+agEsc(agLineaTxt(k))+' · '+agFmt(res.porLinea[k], 0)+'</span>'; }).join(' ');
  } else {
    sub = agEsc(agT('de ' + res.n + ' · mín ' + agFmt(res.min) + ' · máx ' + agFmt(res.max), 'of ' + res.n + ' · min ' + agFmt(res.min) + ' · max ' + agFmt(res.max)));
  }
  var dec = q.accion === 'contar' ? 0 : (q.accion === 'porcentaje' ? 1 : (res.campo === 'cases' || res.campo === 'minutes' || res.campo === 'lbs' ? 0 : 2));
  var unidad = q.accion === 'porcentaje' ? '%' : (res.campo && q.accion !== 'contar' ? ' ' + agCampoTxt(res.campo).toLowerCase() : '');
  return '<div class="ag-num"><b>'+(v == null ? '—' : agFmt(v, dec))+'<small>'+agEsc(unidad || u)+'</small></b><div>'+sub+'</div></div>'+
    (q.accion === 'contar' && res.lista && res.lista.length ? agTabla(f, res.lista, res.total) : '<div class="ag-pie">'+agPantallaBtn(f)+'</div>');
}
function agRanking(res, q){
  if(!res.filas.length) return agNada(res, q);
  return '<div class="ag-rank">'+res.filas.map(function(x, i){
    return '<div class="ag-rk'+(i === 0 ? ' top' : '')+'"><span>'+agEsc(agLineaTxt(x.linea))+'</span>'+
      '<i style="width:'+Math.max(4, x.valor).toFixed(0)+'%"></i><b>'+agFmt(x.valor, 1)+'%</b></div>';
  }).join('')+'</div><div class="ag-pie">'+agPantallaBtn(res.f)+'</div>';
}

function agRespuesta(q){
  if(!q.entendido){
    var es = q.lang === 'es';
    return '<p class="ag-p">'+(es ? 'No te entendí. Prueba diciéndolo de otra forma, por ejemplo:' : 'I did not understand that. Try saying it another way, for example:')+'</p>'+
      agChips(agSugerencias(es ? 'es' : 'en').slice(0, 4));
  }
  if(q.tipo === 'ayuda') return agAyudaHTML();
  if(q.tipo === 'pendientes') return agPendientesHTML();
  if(q.tipo === 'lot') return agLotHTML(q);
  if(q.tipo === 'traza') return agTrazaHTML(q);
  if(q.tipo === 'producto') return agProductoHTML(q);
  if(q.tipo === 'abrir') return '<p class="ag-p">'+agT('Abriendo…', 'Opening…')+'</p>';
  var res = agEjecutar(q);
  var cab = agEntendi(q);
  if(res.tipo === 'sinPermiso') return cab + '<p class="ag-p">'+agEsc(agT('Tu rol no puede ver ' + res.f.es + '.', 'Your role cannot see ' + res.f.en + '.'))+'</p>';
  if(res.tipo === 'nada') return cab + agNada(res, q);
  if(res.tipo === 'tarjeta'){
    var ext = res.extremo ? '<div class="ag-num"><b>'+agFmt(res.extremo.valor)+'<small>'+agEsc(agCampoTxt(res.extremo.campo).toLowerCase())+'</small></b>'+
      '<div>'+agEsc(agT((res.extremo.max ? 'el más alto de ' : 'el más bajo de ') + res.extremo.de, (res.extremo.max ? 'highest of ' : 'lowest of ') + res.extremo.de))+'</div></div>' : '';
    return cab + ext + agTarjeta(res.f, res.r) + (res.total > 1 && !res.extremo ? '<div class="ag-pie">'+agEsc(agT(res.total + ' en total', res.total + ' in all'))+' · '+agPantallaBtn(res.f)+'</div>' : '');
  }
  if(res.tipo === 'grupos') return cab + agGruposHTML(res, q);
  if(res.tipo === 'numero') return cab + agNumero(res, q);
  if(res.tipo === 'ranking') return cab + agRanking(res, q);
  return cab + agTabla(res.f, res.filas, res.total);
}

// Una tabla por grupo: cuantos y su % (o su total / promedio)
function agGruposHTML(res, q){
  var conPct = res.filas.some(function(x){ return x.pct != null; });
  var conVal = res.filas.some(function(x){ return x.valor != null; });
  var max = 0;
  res.filas.forEach(function(x){ max = Math.max(max, conVal ? (x.valor || 0) : x.n); });
  return '<div class="ag-tab"><table><thead><tr><th>'+agEsc(AG_CLAVE[res.clave] ? agT(AG_CLAVE[res.clave][0], AG_CLAVE[res.clave][1]).replace(/^(por|by) /, '') : '')+'</th>'+
    '<th>'+agT('Cuántos', 'Count')+'</th>'+(conVal ? '<th>'+agEsc(agT(res.suma ? 'Total ' : 'Promedio ', res.suma ? 'Total ' : 'Average ')+agCampoTxt(res.campo).toLowerCase())+'</th>' : '')+
    (conPct ? '<th>'+agT('% pasa', '% pass')+'</th>' : '')+'<th></th></tr></thead><tbody>'+
    res.filas.slice(0, 25).map(function(x){
      var w = max ? ((conVal ? (x.valor || 0) : x.n) / max * 100) : 0;
      return '<tr class="ag-sin-click"><td>'+agEsc(agClaveTxt(res.clave, x.clave))+'</td><td>'+x.n+'</td>'+
        (conVal ? '<td>'+agFmt(x.valor, res.campo === 'cases' || res.campo === 'minutes' ? 0 : 2)+'</td>' : '')+
        (conPct ? '<td>'+(x.pct == null ? '—' : agFmt(x.pct, 1) + '%')+'</td>' : '')+
        '<td class="ag-bar"><i style="width:'+Math.max(3, w).toFixed(0)+'%"></i></td></tr>';
    }).join('')+'</tbody></table></div><div class="ag-pie">'+agEsc(agT(res.total + ' registros', res.total + ' records'))+' · '+agPantallaBtn(res.f)+'</div>';
}
// Todo de un producto: su ficha y lo ultimo de cada modulo
function agProductoHTML(q){
  var num = q.filtros.producto, t = agProductoTodo(num);
  var cab = '<div class="ag-ent">'+agT('Entendí: ', 'Understood: ')+'<span>'+agT('todo del producto ', 'everything for product ')+agEsc(num)+'</span>'+agCorregidoTxt(q)+'</div>';
  var fp = agFuente('products');
  var ficha = (t.p && fp && agPuedeVer(fp)) ? agTarjeta(fp, t.p) : (t.p ? '<p class="ag-p"><b>'+agEsc(t.p.number+' · '+(t.p.name || ''))+'</b></p>' : '');
  if(!t.p && !t.ultimos.length) return cab + '<p class="ag-p">'+agEsc(agT('No encontré el producto ' + num + '.', 'I could not find product ' + num + '.'))+'</p>';
  return cab + ficha + (t.ultimos.length ? '<div class="ag-grp"><div class="ag-grp-h"><b>'+agT('Lo último', 'Latest')+'</b></div><div class="ag-list">'+
    t.ultimos.map(function(x){
      var i = agRef(x.f, x.r);
      return '<button type="button" class="ag-li" onclick="agVer('+i+')"><b>'+agEsc(agT(x.f.es, x.f.en))+' · '+agEsc(agCuando(x.f, x.r))+' '+agBadge(x.f.estado ? x.f.estado(x.r) : '')+'</b>'+
        '<span>'+agEsc(agResumen(x.f, x.r))+(x.total > 1 ? ' · '+agEsc(agT(x.total + ' en total', x.total + ' in all')) : '')+'</span></button>';
    }).join('')+'</div></div>' : '');
}
// Una linea con lo importante de un registro (para listas cortas)
function agResumen(f, r){
  var cs = (f.campos ? f.campos.call(f, r) : []).filter(function(c){ return c[1] != null && String(c[1]).trim() !== '' && String(c[1]) !== '—'; });
  return cs.slice(0, 4).map(function(c){ return c[0] + ': ' + c[1]; }).join(' · ');
}
// Lo que falta en el turno (el mismo motor de las notificaciones)
function agPendientesHTML(){
  var p = agPendientes();
  if(!p) return '<p class="ag-p">—</p>';
  if(!p.ctx) return '<p class="ag-p">'+agT('Ahora mismo no hay turno según las horas de los turnos.', 'There is no shift right now, according to the shift hours.')+'</p>';
  var cab = '<div class="ag-ent">'+agT('Entendí: ', 'Understood: ')+'<span>'+agT('lo que falta', 'what is pending')+'</span><span>'+agEsc(agTurnoTxt(p.ctx.shift))+'</span></div>';
  if(!p.items.length) return cab + '<p class="ag-p">'+agT('✓ Nada pendiente por ahora.', '✓ Nothing pending right now.')+'</p>';
  return cab + '<div class="ag-list">'+p.items.map(function(a){
    return '<button type="button" class="ag-li" onclick="agIrPantalla(\''+a.screen+'\',\''+(a.mod || '')+'\')"><b>'+agEsc(a.title)+'</b><span>'+agEsc(a.body)+'</span></button>';
  }).join('')+'</div>';
}
// El LOT de un dia, en los dos formatos
function agLotHTML(q){
  var d = q.fecha || localDateStr();
  if(d === localDateStr() && typeof lotDiaProduccion === 'function') d = lotDiaProduccion(d);
  if(typeof lotCodigo !== 'function') return '<p class="ag-p">—</p>';
  var dd = typeof lotNombreDddyy === 'function' ? lotNombreDddyy() : 'DDDYY';
  return '<div class="ag-ent">'+agT('Entendí: ', 'Understood: ')+'<span>LOT</span><span>'+agEsc(agFecha(d))+'</span></div>'+
    '<div class="ag-lots"><div><small>Caputo · YYDDD</small><b>'+lotCodigo(d, 'yyddd')+'</b></div>'+
    '<div><small>'+agEsc(dd)+' · DDDYY</small><b>'+lotCodigo(d, 'dddyy')+'</b></div></div>';
}
// Todo lo de un LOT
function agTrazaHTML(q){
  var lot = q.filtros.lot, t = agTraza(lot);
  var cab = '<div class="ag-ent">'+agT('Entendí: ', 'Understood: ')+'<span>'+agT('todo del ', 'everything for ')+'LOT '+agEsc(lot)+'</span></div>';
  if(!t.length) return cab + '<p class="ag-p">'+agEsc(agT('No encontré nada con el LOT ' + lot + ' en este equipo.', 'I found nothing with LOT ' + lot + ' on this device.'))+'</p>';
  return cab + t.map(function(x){
    return '<div class="ag-grp"><div class="ag-grp-h"><b>'+agEsc(agT(x.f.es, x.f.en))+'</b><span>'+x.l.length+'</span></div>'+agTabla(x.f, x.l.slice(0, 3), x.l.length)+'</div>';
  }).join('');
}
function agAyudaHTML(){
  var es = agLang === 'es';
  var ej = es ? [
    ['Último / cuándo', 'última verificación del metal detector de la línea 3'], ['Listas con filtros', 'pesos fuera de rango de la línea 4 ayer'],
    ['Cuántos', '¿cuántos CAPAs abiertos hay?'], ['Porcentaje', 'cumplimiento de pesos esta semana'], ['Promedio', 'promedio de humedad del producto 01824 este mes'],
    ['Peor línea', '¿qué línea tiene el peor cumplimiento hoy?'], ['Total', '¿cuánto produjo cada línea hoy?'], ['Un LOT', 'LOT 26321'],
    ['Un producto (todo)', 'producto 01824'], ['Resultado del lab', 'resultado del último análisis del 01824'],
    ['Por grupo', 'downtime por causa esta semana'], ['Más alto / más bajo', 'temperatura más alta esta semana'],
    ['Placas', '¿qué placas toca leer hoy?'], ['Pendientes del lab', 'muestras sin resultados'], ['Anoche', 'pesos fuera de rango anoche'],
    ['Lo pendiente', '¿qué me falta en el turno?'], ['LOT del día', '¿cuál es el LOT de hoy?'], ['Abrir', 'abre temperaturas']]
  : [
    ['Last / when', 'last metal detector check on line 3'], ['Lists with filters', 'weights out of range on line 4 yesterday'],
    ['How many', 'how many open CAPAs?'], ['Percent', 'weight compliance this week'], ['Average', 'average moisture of product 01824 this month'],
    ['Worst line', 'which line has the worst compliance today?'], ['Total', 'how much did each line make today?'], ['A LOT', 'LOT 26321'],
    ['A product (everything)', 'product 01824'], ['Lab result', 'result of the last analysis of 01824'],
    ['Grouped', 'downtime by cause this week'], ['Highest / lowest', 'highest temperature this week'],
    ['Plates', 'which plates are ready to read today?'], ['Lab pending', 'samples without results'], ['Last night', 'weights out of range last night'],
    ['What is pending', 'what is pending this shift?'], ['LOT of the day', 'today’s LOT'], ['Open', 'open temperatures']];
  return '<div class="ag-help"><p class="ag-p">'+(es ? 'Sé de pesos, sellado, temperaturas, GMP, metal detector, Pre-Op, CAPA, holds, shift reports, schedule, sample analysis, raw, COA orders, asistencia, output, downtime, empleados y productos. Solo leo: no cambio nada.'
      : 'I know weights, seals, temperatures, GMP, metal detector, Pre-Op, CAPA, holds, shift reports, schedule, sample analysis, raw, COA orders, attendance, output, downtime, employees and products. I only read: I never change anything.')+'</p>'+
    ej.map(function(x){ return '<button type="button" class="ag-li" onclick="agPreguntar(this.querySelector(\'span\').textContent)"><b>'+agEsc(x[0])+'</b><span>'+agEsc(x[1])+'</span></button>'; }).join('')+'</div>';
}
// El "?" de arriba: lo que se puede preguntar y, al administrador, lo que no se entendio
function agAyudaPanel(){
  var b = document.getElementById('ag-body');
  if(!b) return;
  agLang = agIdiomaBase();
  var dudas = agDudas();
  var adm = typeof canSeeModule === 'function' && canSeeModule('admin');
  b.innerHTML = '<div class="ag-msg ag-el">'+agAyudaHTML()+
    (adm && dudas.length ? '<div class="ag-grp"><div class="ag-grp-h"><b>'+agT('No entendí (en este equipo)', 'Not understood (on this device)')+'</b><span>'+dudas.length+'</span></div>'+
      '<div class="ag-dudas">'+dudas.slice(-12).reverse().map(function(d){ return '<div>'+agEsc(d.q)+'<small>'+agEsc(agFecha(d.at))+'</small></div>'; }).join('')+'</div></div>' : '')+
    '</div>';
  if(typeof renderIcons === 'function') renderIcons(b);
  b.scrollTop = 0;
}
