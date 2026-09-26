// ===== GENERADOR DE LA FORMA DEL LABORATORIO (ARF) =====
// Agrupa las muestras del mismo cliente del mismo día en UNA sola submission,
// con renglones y rangos de sample consecutivos, y rellena la plantilla .xlsx
// que vive en Firestore. La plantilla se edita a nivel XML conservando el
// estilo de cada celda: así el formato oficial queda intacto.

// Escribe un valor en una celda conservando su estilo (atributo s)
function xlsxSetCell(xml, ref, value){
  var re = new RegExp('<c r="'+ref+'"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)');
  if(!re.test(xml)) return xml;
  return xml.replace(re, function(m, attrs){
    var s = /\ss="(\d+)"/.exec(attrs);
    var sa = s ? ' s="'+s[1]+'"' : '';
    if(value===null || value===undefined || value==='') return '<c r="'+ref+'"'+sa+'/>';
    var v = String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<c r="'+ref+'"'+sa+' t="inlineStr"><is><t xml:space="preserve">'+v+'</t></is></c>';
  });
}

// MM/DD/YYYY, que es como las llena el laboratorio
function labFormDate(d){
  var s = String(d||'').slice(0,10).split('-');
  return s.length===3 ? s[1]+'/'+s[2]+'/'+s[0] : String(d||'');
}

// Grupos listos para enviar: mismo cliente + mismo día
function labFormGroups(){
  var groups = {};
  getRuns().forEach(function(r){
    if(!r.labSample || !r.collected) return;
    var c = runCustomer(r);
    if(!c) return;
    var day = String(r.date).slice(0,10);
    var key = c.customerId+'|'+day;
    if(!groups[key]) groups[key] = {customer:c, date:day, runs:[], sent:0};
    groups[key].runs.push(r);
    if(r.labSent) groups[key].sent++;
  });
  return Object.keys(groups).map(function(k){ return groups[k]; })
    .sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
}

// Construye las filas que van en la forma
function labFormRows(group){
  return group.runs.slice().sort(function(a,b){
    return (a.sampleFrom||0)-(b.sampleFrom||0) || String(a.time||'').localeCompare(String(b.time||''));
  }).map(function(r){
    var p = (typeof findProduct==='function') ? findProduct(r.product) : null;
    var name = r.productName || (p && p.name) || '';
    return {
      code:   (group.customer.prefix || group.customer.customerId || '') + String(r.product||'').trim().toUpperCase(),
      sample: name + (r.sampleFrom ? ' ('+r.sampleFrom+'-'+r.sampleTo+')' : ''),
      date:   labFormDate(r.date),
      lot:    r.lot || '',
      run:    r
    };
  });
}

function labFormWarnings(group){
  var w = [];
  group.runs.forEach(function(r){
    if(!r.lot) w.push('Line '+r.line+' · '+(r.product||'—')+': no LOT');
    if(!r.sampleFrom) w.push('Line '+r.line+' · '+(r.product||'—')+': no sample numbers');
  });
  return w;
}

// ---- Generación ----
function generateLabForm(customerId, date){
  var group = labFormGroups().filter(function(g){
    return g.customer.customerId===customerId && g.date===date; })[0];
  if(!group){ toast('No collected samples for that customer and date'); return; }

  var warn = labFormWarnings(group);
  if(warn.length && !confirm('Some rows are incomplete:\n\n'+warn.join('\n')+'\n\nGenerate anyway?')) return;

  var formName = group.customer.form || 'general';
  var map = (getDB().labTestMap||{}).map || {};
  var compositeCols = (getDB().labTestMap||{}).compositeCol || {};
  var testMap = map[formName] || {};

  if(typeof JSZip==='undefined'){ toast('JSZip did not load'); return; }
  if(!window.loadLabTemplate){ toast('No connection to load the template'); return; }

  toast('Building form…');
  window.loadLabTemplate(formName, function(tpl){
    if(!tpl || !tpl.b64){ toast('Template "'+formName+'" not found'); return; }
    JSZip.loadAsync(tpl.b64, {base64:true}).then(function(zip){
      var rows  = labFormRows(group);
      var cols  = tpl.cols || {code:'C', sample:'D', date:'E', lot:'F'};
      var first = tpl.firstRow || 10;
      var sheets = {};                       // ruta -> xml (se editan en memoria)

      function sheetFor(kind){
        var path = (kind==='chem') ? tpl.sheetChem : (tpl.sheetMicro || tpl.sheet);
        return path || null;
      }
      function load(path){
        if(sheets[path]!==undefined) return Promise.resolve();
        return zip.file(path).async('string').then(function(x){ sheets[path]=x; });
      }

      // Hojas que se van a tocar: la micro siempre; la chem sólo si hace falta
      var needed = [sheetFor('micro')];
      var tests  = group.customer.tests || [];
      if(tests.some(function(t){ return testMap[t] && testMap[t].sheet==='chem'; })) needed.push(sheetFor('chem'));
      needed = needed.filter(Boolean);

      Promise.all(needed.map(load)).then(function(){
        rows.forEach(function(row, i){
          var rn = first + i;
          var micro = sheetFor('micro');
          sheets[micro] = xlsxSetCell(sheets[micro], cols.code+rn,   row.code);
          sheets[micro] = xlsxSetCell(sheets[micro], cols.sample+rn, row.sample);
          sheets[micro] = xlsxSetCell(sheets[micro], cols.date+rn,   row.date);
          sheets[micro] = xlsxSetCell(sheets[micro], cols.lot+rn,    row.lot);

          // Las pruebas de química van en su propia hoja: se repite la cabecera
          var chem = sheetFor('chem');
          var usesChem = tests.some(function(t){ return testMap[t] && testMap[t].sheet==='chem'; });
          if(usesChem && chem && sheets[chem]!==undefined){
            sheets[chem] = xlsxSetCell(sheets[chem], cols.code+rn,   row.code);
            sheets[chem] = xlsxSetCell(sheets[chem], cols.sample+rn, row.sample);
            sheets[chem] = xlsxSetCell(sheets[chem], cols.date+rn,   row.date);
            sheets[chem] = xlsxSetCell(sheets[chem], cols.lot+rn,    row.lot);
          }

          // Marca X en cada test que exige el cliente
          tests.forEach(function(t){
            var m = testMap[t]; if(!m) return;
            var path = sheetFor(m.sheet==='chem' ? 'chem' : 'micro');
            if(path && sheets[path]!==undefined) sheets[path] = xlsxSetCell(sheets[path], m.col+rn, 'X');
          });

          // Composite: 2-5 samples, si la forma del cliente lo usa
          var cc = compositeCols[formName];
          if(cc && group.customer.composite){
            var mp = sheetFor('micro');
            sheets[mp] = xlsxSetCell(sheets[mp], cc+rn, 'X');
          }
        });

        Object.keys(sheets).forEach(function(p){ zip.file(p, sheets[p]); });
        return zip.generateAsync({type:'blob', compression:'DEFLATE'});
      }).then(function(blob){
        var fname = group.customer.company.replace(/[^\w]+/g,'_')+'_'+group.date+'.xlsx';
        labFormDeliver(blob, fname);
        logActivity('lab','Lab form generated',
          group.customer.company+' · '+group.date+' · '+rows.length+' product(s)',
          currentUser?currentUser.name:'—');
        toast('Form ready ✓');
      }).catch(function(e){
        console.error('generateLabForm:', e);
        toast('Could not build the form: '+e.message);
      });
    });
  });
}

// Entrega el archivo (iPhone/PWA no admite <a download>: se usa compartir)
function labFormDeliver(blob, filename){
  var MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var file;
  try { file = new File([blob], filename, {type:MIME}); } catch(e){ file = null; }
  if(file && navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:filename}).catch(function(err){
      if(!err || err.name!=='AbortError') labFormDownload(blob, filename);
    });
    return;
  }
  labFormDownload(blob, filename);
}
function labFormDownload(blob, filename){
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}

// ---- Panel de submissions listas, dentro de Lab Samples ----
function renderLabForms(){
  var el = document.getElementById('lab-forms');
  if(!el) return;
  var groups = labFormGroups();
  if(!groups.length){ el.innerHTML=''; return; }
  el.innerHTML = '<div class="sec-label">Ready to submit</div>' + groups.map(function(g){
    var warn = labFormWarnings(g);
    return '<div class="run-card'+(g.sent===g.runs.length?' done':'')+'">'+
      '<div class="run-head"><div>'+
        '<div class="run-title">'+esc(g.customer.company)+
          (g.sent===g.runs.length?' <span class="tag ok">All sent</span>':'')+'</div>'+
        '<div class="run-meta">'+fmtDate(g.date)+' · '+g.runs.length+' product(s) · form: '+
          esc(g.customer.form||'general')+'</div>'+
      '</div></div>'+
      (warn.length ? '<div class="lab-warn">'+esc(warn.join(' · '))+'</div>' : '')+
      '<button class="btn-solid" style="width:100%;justify-content:center" '+
        'onclick="generateLabForm(\''+esc(g.customer.customerId)+'\',\''+esc(g.date)+'\')">'+
        'Generate submission form</button>'+
    '</div>';
  }).join('');
}
