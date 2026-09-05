// ===== PDF DEL DASHBOARD =====
// Documento analítico sin marcas ni logos: sólo datos y gráficas.
// Usa los mismos filtros y agregados que la pantalla del dashboard.

function dpNum(v, dec){ return v==null || isNaN(v) ? '—' : Number(v).toFixed(dec==null?2:dec); }
function dpPct(v){ return v==null ? '—' : v+'%'; }
function dpDate(iso){
  if(!iso) return '—';
  var d = new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

// Paleta neutra que imprime bien
var DP = {
  ink:'#141a17', body:'#3c4742', soft:'#6b756f', line:'#d8ddd8', zebra:'#f6f7f5',
  ok:'#1a7f4f', warn:'#b07d1a', bad:'#b3261e', head:'#eceee9'
};

// Barra horizontal dibujada con divs (imprime sin depender de JS)
function dpBar(pct, color){
  var w = Math.max(0, Math.min(100, pct||0));
  return '<div style="background:#e8ebe7;border-radius:2px;height:6px;overflow:hidden">'+
    '<div style="width:'+w+'%;height:6px;background:'+(color||DP.ok)+'"></div></div>';
}

function dpTable(headers, rows, widths){
  if(!rows.length) return '<div style="color:'+DP.soft+';font-size:9px;padding:10px 0">No records in this period.</div>';
  var th = headers.map(function(h,i){
    return '<th style="text-align:'+(h.num?'right':'left')+';padding:6px 8px;background:'+DP.head+
      ';font-size:8px;letter-spacing:0.07em;text-transform:uppercase;color:'+DP.body+
      ';border-bottom:1px solid '+DP.line+(widths&&widths[i]?';width:'+widths[i]:'')+'">'+h.t+'</th>';
  }).join('');
  var tr = rows.map(function(r,i){
    return '<tr style="background:'+(i%2?DP.zebra:'#fff')+'">'+
      r.map(function(c,j){
        var num = headers[j] && headers[j].num;
        return '<td style="padding:5px 8px;font-size:9px;border-bottom:1px solid '+DP.line+
          ';text-align:'+(num?'right':'left')+(num?';font-variant-numeric:tabular-nums':'')+'">'+c+'</td>';
      }).join('')+'</tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr>'+th+'</tr></thead><tbody>'+tr+'</tbody></table>';
}

function dpSection(title, sub, body, avoidBreak){
  return '<section style="margin-bottom:20px'+(avoidBreak===false?'':';page-break-inside:avoid')+'">'+
    '<div style="border-bottom:2px solid '+DP.ink+';padding-bottom:5px;margin-bottom:9px">'+
      '<div style="font-size:12px;font-weight:800;letter-spacing:-0.01em;color:'+DP.ink+'">'+title+'</div>'+
      (sub?'<div style="font-size:9px;color:'+DP.soft+';margin-top:2px">'+sub+'</div>':'')+
    '</div>'+body+'</section>';
}

function dpStat(label, value, note, color){
  return '<div style="border:1px solid '+DP.line+';padding:10px 12px">'+
    '<div style="font-size:8px;letter-spacing:0.09em;text-transform:uppercase;color:'+DP.soft+'">'+label+'</div>'+
    '<div style="font-size:21px;font-weight:800;margin-top:5px;color:'+(color||DP.ink)+';font-variant-numeric:tabular-nums">'+value+'</div>'+
    '<div style="font-size:8.5px;color:'+DP.soft+';margin-top:2px">'+note+'</div></div>';
}

function compColor(p){ return p>=90?DP.ok:p>=80?DP.warn:DP.bad; }

// Imagen de un canvas de Chart.js, si existe y tiene datos
function dpCanvas(id){
  var cv = document.getElementById(id);
  if(!cv || !cv.width || !cv.height) return '';
  try { return cv.toDataURL('image/png', 1.0); } catch(e){ return ''; }
}

function exportDashPDF(){
  readDashFilters();
  var db = getDB();

  var w     = (db.weights||[]).filter(dashKeep);
  var seals = (db.seals||[]).filter(dashKeep);
  var gmps  = (db.gmps||[]).filter(function(r){ return dashInRange(r.date) &&
                (dashF.shift==='all' || String(r.shift||'')===dashF.shift); });
  var temps = (db.temps||[]).filter(function(r){ return dashInRange(r.date) &&
                (dashF.shift==='all' || String(r.shift||'')===dashF.shift); });
  var metal = (db.metal||[]).filter(function(r){ return dashInRange(r.date); });
  var holds = (db.holds||[]).filter(function(h){ return dashInRange(h.createdAt); });

  var scored = w.filter(function(r){ return r.compliance!=null; });
  if(!w.length && !seals.length && !temps.length && !metal.length && !gmps.length){
    toast('No records for these filters'); return;
  }

  var f = dashFill(scored);

  // ---- Producto perdido: exceso por encima del máximo del rango ----
  // Se expresa en libras y en cajas equivalentes usando el peso nominal y las
  // bolsas por caja del catálogo de cada producto.
  var byProd = dashBreakdown(scored, function(r){ return r.product||''; });
  var casesLost = 0, lbsWithCase = 0;
  byProd.forEach(function(g){
    var p = findProduct(g.key);
    var t = null, bags = null;
    if(p){ t = p.target; bags = p.bagsPerCase; }
    if(t && t.min!=null && bags){
      var nominal = (t.min+t.max)/2 * bags;      // libras por caja
      if(nominal>0){ casesLost += g.overSum/nominal; lbsWithCase += g.overSum; }
    }
  });

  var period = (dashF.from||dashF.to)
    ? (dashF.from?dpDate(dashF.from):'start')+' — '+(dashF.to?dpDate(dashF.to):'today')
    : 'All records';
  var scopeBits = [];
  if(dashF.product!=='all'){
    var pp = findProduct(dashF.product);
    scopeBits.push('Product '+dashF.product+(pp&&pp.name?' ('+pp.name+')':''));
  }
  if(dashF.line!=='all')  scopeBits.push('Line '+dashF.line);
  if(dashF.shift!=='all') scopeBits.push((dashF.shift==='1'?'1st':'2nd')+' shift');
  var scope = scopeBits.length ? scopeBits.join(' · ') : 'All lines, shifts and products';

  // ================= SECCIONES =================

  // 1. Resumen
  var summary =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">'+
      dpStat('Compliance', f.bags?f.comp+'%':'—', f.pass+' of '+f.bags+' bags in target', compColor(f.comp))+
      dpStat('Weight checks', w.length, scored.length+' scored · '+(w.length-scored.length)+' without target')+
      dpStat('Bags in target', f.pass, dpPct(f.comp)+' of all bags', DP.ok)+
      dpStat('Bags out of target', f.fail, f.under+' under · '+f.over+' over', f.fail?DP.bad:DP.ink)+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'+
      dpStat('Average deviation', f.avgDev==null?'—':(f.avgDev>0?'+':'')+dpNum(f.avgDev,3), 'lbs from the target centre',
             f.avgDev!=null && Math.abs(f.avgDev)>0.1 ? DP.warn : DP.ink)+
      dpStat('Product given away', dpNum(f.overSum,1), 'lbs above the maximum limit', f.overSum?DP.bad:DP.ink)+
      dpStat('Short-filled', dpNum(f.underSum,1), 'lbs below the minimum limit', f.underSum?DP.warn:DP.ink)+
      dpStat('Hold cases', holds.length, holds.filter(function(h){return h.status!=='released'&&h.status!=='destroyed'}).length+' still open')+
    '</div>';

  // 2. Producto perdido
  var lossRows = byProd.filter(function(g){ return g.overSum>0; })
    .sort(function(a,b){ return b.overSum-a.overSum; })
    .map(function(g){
      var p = findProduct(g.key);
      return [ g.key, p&&p.name?p.name:'—', g.over, dpNum(g.overSum,1),
               dpNum(g.over?g.overSum/g.over:0,3), dpNum(g.bags?g.overSum/g.bags:0,3) ];
    });
  var lossBody =
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">'+
      dpStat('Total over the limit', dpNum(f.overSum,1)+' lbs', f.over+' bag(s) above the maximum', DP.bad)+
      dpStat('Equivalent cases', casesLost?dpNum(casesLost,1):'—',
             casesLost?'based on nominal weight and bags per case':'needs target and bags/case in the catalog')+
      dpStat('Average excess', f.over?dpNum(f.overSum/f.over,3)+' lbs':'—', 'per bag that went over')+
    '</div>'+
    dpTable([{t:'Product'},{t:'Description'},{t:'Bags over',num:true},{t:'Excess (lbs)',num:true},
             {t:'Avg excess/bag',num:true},{t:'Excess per bag checked',num:true}], lossRows);

  // 3. Gráficas
  var trendImg = dpCanvas('chart-trend');
  var donutImg = dpCanvas('chart-donut');
  var charts = (trendImg||donutImg)
    ? '<div style="display:grid;grid-template-columns:'+(trendImg&&donutImg?'2fr 1fr':'1fr')+';gap:14px;align-items:start">'+
        (trendImg?'<div><div style="font-size:9px;color:'+DP.soft+';margin-bottom:4px">Daily compliance (%)</div>'+
          '<img src="'+trendImg+'" style="width:100%;border:1px solid '+DP.line+'"></div>':'')+
        (donutImg?'<div><div style="font-size:9px;color:'+DP.soft+';margin-bottom:4px">Bag distribution</div>'+
          '<img src="'+donutImg+'" style="width:100%;border:1px solid '+DP.line+'"></div>':'')+
      '</div>'
    : '<div style="color:'+DP.soft+';font-size:9px">Open the dashboard first so the charts are drawn.</div>';

  // 4. Por producto (tabla completa + barras)
  var prodSorted = byProd.slice().sort(function(a,b){ return b.bags-a.bags; });
  var prodRows = prodSorted.map(function(g){
    var p = findProduct(g.key);
    return [ g.key, p&&p.name?p.name:'—', g.n, g.bags, g.pass, g.fail,
             '<span style="color:'+compColor(g.comp)+';font-weight:700">'+g.comp+'%</span>',
             (g.avgDev==null?'—':(g.avgDev>0?'+':'')+dpNum(g.avgDev,3)),
             dpNum(g.overSum,1) ];
  });
  var prodBody = dpTable(
    [{t:'Product'},{t:'Description'},{t:'Checks',num:true},{t:'Bags',num:true},{t:'In target',num:true},
     {t:'Out',num:true},{t:'Compliance',num:true},{t:'Avg dev (lbs)',num:true},{t:'Given away (lbs)',num:true}],
    prodRows);

  // 5. Mayor desviación / mejor cumplimiento
  var withDev = byProd.filter(function(g){ return g.avgDev!=null && g.bags>=5; });
  var worstDev = withDev.slice().sort(function(a,b){ return Math.abs(b.avgDev)-Math.abs(a.avgDev); }).slice(0,8);
  var bestComp = byProd.filter(function(g){ return g.bags>=5; })
                       .sort(function(a,b){ return b.comp-a.comp; }).slice(0,8);
  var rank = function(items, valueFn, subFn, colorFn){
    if(!items.length) return '<div style="color:'+DP.soft+';font-size:9px">Not enough data.</div>';
    var max = Math.max.apply(null, items.map(function(g){ return Math.abs(valueFn(g)); })) || 1;
    return items.map(function(g){
      var p = findProduct(g.key);
      return '<div style="margin-bottom:8px">'+
        '<div style="display:flex;justify-content:space-between;gap:10px;font-size:9px;margin-bottom:3px">'+
          '<span style="font-weight:700">'+g.key+(p&&p.name?' · '+p.name:'')+'</span>'+
          '<span style="font-variant-numeric:tabular-nums;font-weight:700;color:'+colorFn(g)+'">'+subFn(g)+'</span>'+
        '</div>'+ dpBar(Math.abs(valueFn(g))/max*100, colorFn(g))+'</div>';
    }).join('');
  };
  var devBody =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">'+
      '<div><div style="font-size:9px;font-weight:800;margin-bottom:7px;color:'+DP.ink+'">Largest deviation from target centre</div>'+
        rank(worstDev, function(g){return g.avgDev;},
             function(g){ return (g.avgDev>0?'+':'')+dpNum(g.avgDev,3)+' lbs'; },
             function(g){ return Math.abs(g.avgDev)>0.1?DP.bad:DP.warn; })+'</div>'+
      '<div><div style="font-size:9px;font-weight:800;margin-bottom:7px;color:'+DP.ink+'">Best compliance</div>'+
        rank(bestComp, function(g){return g.comp;}, function(g){ return g.comp+'%'; },
             function(g){ return compColor(g.comp); })+'</div>'+
    '</div>';

  // 6. Línea, turno y formato
  var cut = function(list, keyFn, labelFn){
    return dashBreakdown(list, keyFn).sort(function(a,b){ return a.comp-b.comp; }).map(function(g){
      return [ labelFn(g.key), g.n, g.bags, g.pass, g.fail,
               '<span style="color:'+compColor(g.comp)+';font-weight:700">'+g.comp+'%</span>',
               (g.avgDev==null?'—':(g.avgDev>0?'+':'')+dpNum(g.avgDev,3)), dpNum(g.overSum,1) ];
    });
  };
  var cutHeaders = [{t:'Segment'},{t:'Checks',num:true},{t:'Bags',num:true},{t:'In target',num:true},
                    {t:'Out',num:true},{t:'Compliance',num:true},{t:'Avg dev',num:true},{t:'Given away',num:true}];
  var cutsBody =
    '<div style="font-size:9px;font-weight:800;margin:2px 0 2px">By production line</div>'+
    dpTable(cutHeaders, cut(scored, function(r){return r.line;}, function(k){return 'Line '+k;}))+
    '<div style="font-size:9px;font-weight:800;margin:12px 0 2px">By shift</div>'+
    dpTable(cutHeaders, cut(scored, function(r){return r.shift;}, function(k){return (k==='1'?'1st':'2nd')+' shift';}))+
    '<div style="font-size:9px;font-weight:800;margin:12px 0 2px">By package size</div>'+
    dpTable(cutHeaders, cut(scored, function(r){return r.pkgLabel||'';}, function(k){return k;}));

  // 7. Bag seal
  var sealRows = SEAL_CHECKS.map(function(chk){
    var done = seals.filter(function(s){ return (s.checks||{})[chk]; });
    var ok   = done.filter(function(s){ return s.checks[chk]==='pass'; }).length;
    var p    = pctOf(ok, done.length);
    return [ chk, done.length, ok, done.length-ok,
             '<span style="color:'+compColor(p)+';font-weight:700">'+(done.length?p+'%':'—')+'</span>' ];
  });
  var sealFailRecords = seals.filter(function(s){
    return Object.keys(s.checks||{}).some(function(k){ return s.checks[k]==='fail'; });
  });
  var sealBody =
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">'+
      dpStat('Seal checks', seals.length, 'in this period')+
      dpStat('With a failure', sealFailRecords.length, pctOf(sealFailRecords.length, seals.length)+'% of the checks',
             sealFailRecords.length?DP.bad:DP.ok)+
      dpStat('Lines covered', Object.keys(seals.reduce(function(a,s){ a[s.line]=1; return a; },{})).length, 'with at least one check')+
    '</div>'+
    dpTable([{t:'Check'},{t:'Performed',num:true},{t:'Passed',num:true},{t:'Failed',num:true},{t:'Pass rate',num:true}], sealRows);

  // 8. Temperatura y humedad
  var pick = function(cp, field){
    return temps.filter(function(t){ return cp?t.checkpoint===cp:true; })
                .map(function(t){ return parseFloat(t[field]); })
                .filter(function(n){ return !isNaN(n); });
  };
  var avg = function(a){ return a.length ? a.reduce(function(x,y){return x+y},0)/a.length : null; };
  var mn  = function(a){ return a.length ? Math.min.apply(null,a) : null; };
  var mx  = function(a){ return a.length ? Math.max.apply(null,a) : null; };
  var tRows = [['begin','Beginning'],['mid','Middle'],['end','End']].map(function(cp){
    var t = pick(cp[0],'temp');
    return [ cp[1], t.length, dpNum(avg(t),1), dpNum(mn(t),1), dpNum(mx(t),1),
             dpNum(avg(pick(cp[0],'chop')),1), dpNum(avg(pick(cp[0],'plat')),1), dpNum(avg(pick(cp[0],'line6')),1) ];
  });
  var slots = {}; temps.forEach(function(t){ slots[t.date+'|'+t.shift]=1; });
  var shiftCount = Object.keys(slots).length;
  var tempBody =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">'+
      dpStat('Readings', temps.length, 'across '+shiftCount+' shift(s)')+
      dpStat('Average temp', dpNum(avg(pick(null,'temp')),1)+'°F', 'all checkpoints')+
      dpStat('Range', temps.length?dpNum(mn(pick(null,'temp')),1)+'° – '+dpNum(mx(pick(null,'temp')),1)+'°':'—', 'lowest to highest')+
      dpStat('Checkpoint coverage', shiftCount?pctOf(temps.length, shiftCount*3)+'%':'—',
             temps.length+' of '+(shiftCount*3)+' expected')+
    '</div>'+
    dpTable([{t:'Checkpoint'},{t:'Readings',num:true},{t:'Avg °F',num:true},{t:'Min °F',num:true},{t:'Max °F',num:true},
             {t:'Chopping %',num:true},{t:'Platform %',num:true},{t:'Line 6 %',num:true}], tRows);

  // 9. Metal detector
  var mdFails = {}, mdClean = 0;
  metal.forEach(function(r){
    var bad = 0;
    MD_QUESTIONS.forEach(function(q,i){ if((r.answers||{})[i]==='no'){ bad++; mdFails[i]=(mdFails[i]||0)+1; } });
    if(!bad) mdClean++;
  });
  var mdRows = MD_QUESTIONS.map(function(q,i){
    var no = mdFails[i]||0;
    return [ (i+1)+'. '+q, metal.length-no, no,
             '<span style="color:'+(no?DP.bad:DP.ok)+';font-weight:700">'+(metal.length?pctOf(metal.length-no,metal.length)+'%':'—')+'</span>' ];
  });
  var metalBody = metal.length
    ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">'+
        dpStat('Checks', metal.length, 'in this period')+
        dpStat('Fully compliant', pctOf(mdClean, metal.length)+'%', mdClean+' with every answer YES',
               mdClean===metal.length?DP.ok:DP.warn)+
        dpStat('With a finding', metal.length-mdClean, 'at least one NO', (metal.length-mdClean)?DP.bad:DP.ink)+
      '</div>'+
      dpTable([{t:'Verification question'},{t:'Yes',num:true},{t:'No',num:true},{t:'Compliance',num:true}], mdRows)
    : '<div style="color:'+DP.soft+';font-size:9px">No metal detector checks in this period.</div>';

  // 10. GMP
  var gmpYes=0, gmpNo=0, itemFails={};
  gmps.forEach(function(r){
    GMP_ITEMS.forEach(function(item,i){
      var v=(r.answers||{})[i];
      if(v==='yes') gmpYes++;
      else if(v==='no'){ gmpNo++; itemFails[item]=(itemFails[item]||0)+1; }
    });
  });
  var gmpRows = Object.keys(itemFails).sort(function(a,b){ return itemFails[b]-itemFails[a]; })
    .map(function(item){ return [ item, itemFails[item], pctOf(itemFails[item], gmps.length||1)+'%' ]; });
  var gmpBody =
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">'+
      dpStat('Audits', gmps.length, 'in this period')+
      dpStat('Items acceptable', (gmpYes+gmpNo)?pctOf(gmpYes,gmpYes+gmpNo)+'%':'—', gmpYes+' yes · '+gmpNo+' no',
             compColor(pctOf(gmpYes,gmpYes+gmpNo)))+
      dpStat('Items with findings', Object.keys(itemFails).length, 'of '+GMP_ITEMS.length+' checked', gmpNo?DP.warn:DP.ok)+
    '</div>'+
    (gmpRows.length
      ? dpTable([{t:'Item marked NO'},{t:'Times',num:true},{t:'Of all audits',num:true}], gmpRows)
      : '<div style="color:'+DP.soft+';font-size:9px">No GMP item was marked NO in this period.</div>');

  // 11. Holds
  var holdRows = holds.slice().sort(function(a,b){ return String(b.createdAt).localeCompare(String(a.createdAt)); })
    .map(function(h){
      var open = h.status!=='released' && h.status!=='destroyed';
      return [ h.caseNumber, h.product||'—', h.lot||'—', h.quantity||'—',
               '<span style="color:'+(open?DP.bad:DP.ok)+';font-weight:700">'+String(h.status||'').toUpperCase()+'</span>',
               dpDate(h.createdAt), h.initiatedBy||'—' ];
    });
  var holdBody = holds.length
    ? dpTable([{t:'Case'},{t:'Product'},{t:'LOT'},{t:'Qty',num:true},{t:'Status'},{t:'Opened'},{t:'By'}], holdRows)
    : '<div style="color:'+DP.soft+';font-size:9px">No hold cases in this period.</div>';

  // ================= DOCUMENTO =================
  var generated = new Date().toLocaleString('en-US',{dateStyle:'medium', timeStyle:'short'});
  var doc =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quality Performance Report</title><style>'+
    '*{box-sizing:border-box}'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:'+DP.body+
      ';font-size:10px;margin:0;padding:22px 26px;background:#fff}'+
    '@page{size:portrait;margin:12mm}'+
    'h1{font-size:19px;color:'+DP.ink+';margin:0;font-weight:800;letter-spacing:-0.02em}'+
    'img{max-width:100%}'+
    '.savebtn{position:fixed;top:14px;right:16px;z-index:9;background:'+DP.ink+';color:#fff;border:0;'+
      'border-radius:6px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;'+
      'font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.18)}'+
    '@media print{body{padding:0}.savebtn{display:none}}'+
  '</style></head><body>'+
  '<button class="savebtn" onclick="window.print()">Save as PDF</button>'+

  // Cabecera sin marca
  '<header style="border-bottom:2px solid '+DP.ink+';padding-bottom:10px;margin-bottom:18px;'+
    'display:flex;justify-content:space-between;align-items:flex-end;gap:20px">'+
    '<div><h1>Quality Performance Report</h1>'+
      '<div style="font-size:9.5px;color:'+DP.soft+';margin-top:4px">'+scope+'</div></div>'+
    '<div style="text-align:right;font-size:9px;color:'+DP.soft+';line-height:1.7">'+
      '<div><b style="color:'+DP.ink+'">Period:</b> '+period+'</div>'+
      '<div>Generated '+generated+'</div>'+
    '</div>'+
  '</header>'+

  dpSection('Executive summary', 'Weight control across the selected period', summary)+
  dpSection('Product given away', 'Weight above the maximum limit — cheese that left the plant for free', lossBody)+
  dpSection('Trend and distribution', 'Daily compliance and overall split of bags', charts)+
  dpSection('Performance by product', 'Every product with records in this period, ordered by volume', prodBody, false)+
  dpSection('Deviation and compliance ranking', 'Products with at least five bags checked', devBody)+
  dpSection('Line, shift and package size', 'Same metrics cut by production segment', cutsBody, false)+
  dpSection('Bag seal monitoring', 'Visual, dunk tank and printing verification', sealBody)+
  dpSection('Temperature and humidity', 'Building 1945 · beginning, middle and end of shift', tempBody)+
  dpSection('Metal detector verification', 'Routine checks and findings per question', metalBody)+
  dpSection('GMP facility audit', 'SQF 2.5.D.A · acceptance and recurring findings', gmpBody)+
  dpSection('Hold cases', 'Product placed on hold in this period', holdBody)+

  '<footer style="border-top:1px solid '+DP.line+';padding-top:8px;margin-top:6px;'+
    'display:flex;justify-content:space-between;font-size:8px;color:'+DP.soft+'">'+
    '<span>Quality Performance Report · '+period+'</span><span>'+generated+'</span></footer>'+
  '</body></html>';

  var blob = new Blob([doc], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.target = '_blank'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast('Report opened — use Print to save as PDF');
}
