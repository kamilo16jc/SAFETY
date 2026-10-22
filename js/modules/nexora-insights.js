// Analítica de presentación: sólo usa agregados existentes, sin IA ni predicciones.
var nxTrendMode='weight';
var nxTrendRows=[];
function nxSetTrend(mode){
  nxTrendMode=mode==='seal'?'seal':'weight';
  ['weight','seal'].forEach(function(k){var b=document.getElementById('nx-trend-'+k);if(b){b.classList.toggle('on',k===nxTrendMode);b.setAttribute('aria-pressed',String(k===nxTrendMode));}});
  nxRenderTrend();
}
function nxToggleTrendTable(){
  var t=document.getElementById('nx-trend-table'),b=document.getElementById('nx-trend-table-btn');if(!t)return;
  t.hidden=!t.hidden;if(b)b.setAttribute('aria-expanded',String(!t.hidden));
  nxRenderTrendTable();
}
function nxRenderTrendTable(){
  var t=document.getElementById('nx-trend-table');if(!t||t.hidden)return;
  t.innerHTML='<table><caption class="nx-data-caption">'+(nxTrendMode==='weight'?'Weight':'Seal')+' compliance · selected period</caption><thead><tr><th scope="col">Date</th><th scope="col">Compliance</th><th scope="col">Target</th><th scope="col">Status</th></tr></thead><tbody>'+nxTrendRows.map(function(r){
    var target=KPI_TARGETS[nxTrendMode];
    return '<tr><td>'+esc(r.date)+'</td><td>'+(r.value==null?'No data':r.value.toFixed(1)+'%')+'</td><td>'+target+'%</td><td>'+(r.value==null?'Not recorded':r.value>=target?'On target':'Below target')+'</td></tr>';
  }).join('')+'</tbody></table>';
}
function nxRenderTrend(){
  var host=document.getElementById('kd-ch-weight');if(!host)return;
  var seal=nxTrendMode==='seal',target=KPI_TARGETS[nxTrendMode];
  var title=document.getElementById('nx-trend-title');if(title)title.textContent=seal?'Seal compliance':'Weight compliance';
  nxTrendRows=kpiSerieDiaria(kpiState.days).map(function(d){return {date:d.date,value:seal?d.sello:d.peso,n:seal?null:d.pesoN};});
  nxRenderTrendTable();
  host.innerHTML='';
  if(!nxTrendRows.some(function(p){return p.value!=null;})){
    host.innerHTML='<div class="nx-chart-empty"><span data-icon="chart"></span><b>No '+(seal?'seal':'weight')+' results yet</b><p>Results will appear here when checks are recorded for this period.</p></div>';
    renderIcons(host);return;
  }
  var W=Math.max(260,host.clientWidth||700),H=235,m={l:39,r:40,t:23,b:30};
  var rows=nxTrendRows,n=rows.length,usable=W-m.l-m.r;
  var x=function(i){return n===1?m.l+usable/2:m.l+usable*i/(n-1);};
  var y=function(v){return m.t+(100-v)/100*(H-m.t-m.b);};
  var svg=kpiEl('svg',{viewBox:'0 0 '+W+' '+H,height:H,role:'group','aria-label':(seal?'Seal':'Weight')+' compliance chart. Use left and right arrows to inspect dates.'},host);
  [0,25,50,75,100].forEach(function(v){
    kpiEl('line',{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:'var(--border)','stroke-width':1,'stroke-dasharray':'3 5'},svg);
    kpiEl('text',{x:m.l-9,y:y(v)+4,'text-anchor':'end',class:'kd-ax'},svg).textContent=v+'%';
  });
  var step=Math.max(1,Math.ceil((n-1)/(W<440?2:5)));
  rows.forEach(function(r,i){if(i===0||i===n-1||i%step===0){
    if(i!==n-1 && n-1-i<step/2)return;
    kpiEl('text',{x:x(i),y:H-7,'text-anchor':i===0?'start':i===n-1?'end':'middle',class:'kd-ax'},svg).textContent=kpiDiaCorto(r.date);
  }});
  // Cada día sin resultados interrumpe el trazo. No se interpola como éxito.
  var segments=[],segment=[];
  rows.forEach(function(r,i){if(r.value==null){if(segment.length)segments.push(segment);segment=[];}else segment.push({x:x(i),y:y(r.value)});});
  if(segment.length)segments.push(segment);
  segments.forEach(function(pts){
    var line=pts.map(function(p,i){return(i?'L':'M')+p.x+','+p.y;}).join(' ');
    if(pts.length>1)kpiEl('path',{d:line+' L'+pts[pts.length-1].x+','+y(0)+' L'+pts[0].x+','+y(0)+' Z',fill:'var(--mint)',opacity:.7},svg);
    kpiEl('path',{d:line,fill:'none',stroke:'var(--accent)','stroke-width':2.3,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  });
  kpiEl('line',{x1:m.l,x2:W-m.r,y1:y(target),y2:y(target),stroke:'var(--dim)','stroke-width':1,'stroke-dasharray':'5 5'},svg);
  kpiEl('text',{x:W-m.r+6,y:y(target)+4,class:'kd-ax'},svg).textContent=target+'%';
  rows.forEach(function(r,i){if(r.value!=null){kpiEl('circle',{cx:x(i),cy:y(r.value),r:r.value<target?3.5:2.5,fill:r.value<target?'var(--fail)':'var(--accent)',stroke:'var(--surface)','stroke-width':1.5},svg);}});
  var cross=kpiEl('line',{y1:m.t,y2:H-m.b,stroke:'var(--accent)',opacity:0,'stroke-width':1},svg);
  var mark=kpiEl('circle',{r:5,fill:'var(--accent)',stroke:'var(--surface)','stroke-width':2,opacity:0},svg);
  var area=kpiEl('rect',{x:m.l,y:0,width:usable,height:H,fill:'transparent',tabindex:0,class:'nx-chart-hit','aria-label':'Explore daily compliance. Use arrow keys.'},svg);
  var tip=kpiGlobo(host),index=rows.length-1;
  function show(i){
    index=Math.max(0,Math.min(rows.length-1,i));var d=rows[index],r=svg.getBoundingClientRect();
    cross.setAttribute('x1',x(index));cross.setAttribute('x2',x(index));cross.setAttribute('opacity',1);
    mark.setAttribute('opacity',d.value==null?0:1);
    mark.setAttribute('cx',x(index));mark.setAttribute('cy',y(d.value||0));
    var text=d.value==null?'No checks recorded':d.value.toFixed(1)+'% · '+(d.value>=target?'On target':'Below target');
    tip.ver('<b>'+esc(kpiDiaCorto(d.date))+'</b>'+esc(text)+(d.n!=null?' · '+d.n+' samples':''),x(index)*(r.width||W)/W,58);
    area.setAttribute('aria-label',kpiDiaCorto(d.date)+'. '+text+'. Left and right arrows change date.');
  }
  function hide(){tip.ocultar();cross.setAttribute('opacity',0);mark.setAttribute('opacity',0);}
  area.addEventListener('pointermove',function(e){var r=svg.getBoundingClientRect();if(!r.width)return;var px=(e.clientX-r.left)*W/r.width;show(n===1?0:Math.round((px-m.l)/usable*(n-1)));});
  area.addEventListener('pointerdown',function(e){var r=svg.getBoundingClientRect();if(r.width)show(n===1?0:Math.round(((e.clientX-r.left)*W/r.width-m.l)/usable*(n-1)));});
  area.addEventListener('pointerleave',hide);
  area.addEventListener('focus',function(){show(index);});area.addEventListener('blur',hide);
  area.addEventListener('keydown',function(e){
    if(['ArrowLeft','ArrowRight','Home','End','Escape'].indexOf(e.key)<0)return;e.preventDefault();
    if(e.key==='Escape'){hide();return;}
    show(e.key==='Home'?0:e.key==='End'?rows.length-1:index+(e.key==='ArrowLeft'?-1:1));
  });
  var caption=document.createElement('div');caption.className='nx-chart-caption';caption.innerHTML='<span><i></i>Compliance</span><span>Dashed line: '+target+'% target</span><span>Hover, tap or use arrow keys</span>';host.appendChild(caption);
}
function nxComputeInsights(){
  var v=kpiVentana(kpiState.days,0),prev=kpiVentana(kpiState.days,1);
  var records=kpiPesos(v),w=kpiCompPeso(records),p=kpiCompPeso(kpiPesos(prev));
  var overdue=kpiCapaAbiertos().filter(capaOverdue).length;
  var a=[];
  if(overdue)a.push({title:overdue+' overdue CAPA'+(overdue===1?'':'s'),text:'Review investigations and assigned due dates. CAPA status covers all dates.',mod:'qa',screen:'screen-capa',action:'Review CAPAs'});
  if(w.pct!=null && w.pct<KPI_TARGETS.weight){
    var groups={};records.forEach(function(r){if(r.pass==null||!r.total)return;var key=String(r.line||'Unassigned');if(!groups[key])groups[key]={ok:0,n:0};groups[key].ok+=Number(r.pass);groups[key].n+=Number(r.total);});
    var weakest=Object.keys(groups).sort(function(a,b){return groups[a].ok/groups[a].n-groups[b].ok/groups[b].n;})[0];
    a.push({title:'Weight compliance is below target',text:w.pct.toFixed(1)+'% of '+w.n+' samples passed. '+(weakest?'Line '+weakest+' has the lowest recorded compliance. ':'' )+'Review the measurements before taking action.',mod:'qa',screen:'screen-lotsearch',action:'Review records'});
  }
  if(w.pct!=null && p.pct!=null && Math.abs(w.pct-p.pct)>=.1)a.push({title:'Weight compliance '+(w.pct>=p.pct?'improved':'decreased'),text:Math.abs(w.pct-p.pct).toFixed(1)+' percentage points '+(w.pct>=p.pct?'higher':'lower')+' than the prior '+kpiState.days+'-day period. Current sample count: '+w.n+'; prior sample count: '+p.n+'.',mod:'qa',screen:'screen-lotsearch',action:'Explore results'});
  if(!a.length){
    var seals=kpiCompSello(kpiSellos(v));
    if(w.pct==null&&seals.pct==null)a.push({title:'Your next insight starts with a check',text:'There are no scored weight or seal results in this selection. Record a check or choose another period.',mod:'qa',screen:'screen-weight',action:'Open weight log'});
    else a.push({title:'Review the complete picture',text:'This selection includes '+w.n+' scored weight samples and '+seals.n+' seal checks. Check completion and exceptions alongside compliance.',mod:'qa',screen:'screen-lotsearch',action:'Review records'});
  }
  return a;
}
function nxRenderInsights(){
  var host=document.getElementById('nx-insight');if(!host)return;
  var a=nxComputeInsights(),lead=a[0];
  var extra=a.length>1?' '+a[1].title+'.':'';
  var link=canSeeScreen(lead.screen,currentUser,lead.mod);
  host.innerHTML='<div class="nx-insight-icon"><span data-icon="pulse"></span></div><div class="nx-insight-copy"><b>'+esc(lead.title)+'</b><p>'+esc(lead.text+extra)+'</p><small>Calculated from recorded data · selected period unless stated otherwise</small></div>'+(link?'<button class="cbtn" type="button" onclick="kpiIr(\''+lead.mod+'\',\''+lead.screen+'\')">'+esc(lead.action)+' <span aria-hidden="true">↗</span></button>':'');
  renderIcons(host);
}
function nxEnhanceCharts(){
  // Datos de las columnas: accesibles también con teclado y pantalla táctil.
  ['kd-ch-line','kd-ch-capa'].forEach(function(id){
    var h=document.getElementById(id);if(!h)return;
    var hits=h.querySelectorAll('rect[fill="transparent"]');
    hits.forEach(function(z,i){
      z.setAttribute('tabindex','0');z.setAttribute('role','button');
      var label;
      if(id==='kd-ch-line'){
        var labels=h.querySelectorAll('text.kd-ax');label=labels[i]?labels[i].textContent:'Line';
        z.setAttribute('aria-label',label+'. Show details; press Enter to filter this line.');
        z.addEventListener('click',function(){
          var value=label.replace('Line ','');
          var sel=document.getElementById('kd-line');
          if(sel && Array.from(sel.options).some(function(o){return o.value===value;})){sel.value=value;kpiFiltro();}
        });
      }else{
        label=['Major','Moderate','Minimal'][i]||'CAPA';
        z.setAttribute('aria-label',label+' CAPA. Show details; press Enter to review CAPAs.');
        z.addEventListener('click',function(){kpiIr('qa','screen-capa');});
      }
      z.addEventListener('focus',function(){z.dispatchEvent(new MouseEvent('mousemove'));});
      z.addEventListener('blur',function(){z.dispatchEvent(new MouseEvent('mouseleave'));});
      z.addEventListener('pointerdown',function(){z.dispatchEvent(new MouseEvent('mousemove'));});
      z.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();z.dispatchEvent(new MouseEvent('click'));}});
    });
  });
  // Los indicadores abren la función correspondiente, siempre respetando el rol.
  var routes=[['qa','screen-weight'],['qa','screen-seal'],['production','screen-production'],['qa','screen-capa'],['qa','screen-temp']];
  document.querySelectorAll('#kd-kpis .kd-kpi').forEach(function(card,i){
    var r=routes[i];if(!r||!canSeeScreen(r[1],currentUser,r[0]))return;
    card.setAttribute('role','button');card.setAttribute('tabindex','0');card.classList.add('nx-kpi-action');
    card.setAttribute('aria-label',card.textContent.trim()+'. Open workspace.');
    card.addEventListener('click',function(){kpiIr(r[0],r[1]);});
    card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();kpiIr(r[0],r[1]);}});
  });
}
