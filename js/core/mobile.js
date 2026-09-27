// ===== ADAPTACIÓN A TELÉFONO =====
// Las hojas del escritorio tienen hasta 25 columnas: en una pantalla de 375px
// eso son 2100px de scroll lateral. En el teléfono cada fila se lee como una
// tarjeta, con el título de su columna al lado del dato.
//
// Para no repetir ese título en los ocho renderizadores, se copia del <thead>
// a cada celda en cuanto la hoja aparece en pantalla. Aquí solo se ponen
// atributos: el aspecto lo decide el CSS, y en escritorio no cambia nada.
(function(){
  // Las dos tablas anchas del sistema: las hojas nuevas y las del catalogo /
  // resultados de busqueda, que tienen el mismo problema en el telefono.
  var SHEETS = 'table.sheet,table.cat-table';
  var EMPTY = {'':1, '—':1, '–':1, '-':1};

  function stampSheet(table){
    var ths = table.querySelectorAll('thead th');
    if(!ths.length) return;
    var labels = [];
    for(var i=0;i<ths.length;i++){
      var txt = '';
      var kids = ths[i].childNodes;
      for(var k=0;k<kids.length;k++){
        var n = kids[k];
        if(n.nodeType===1 && n.classList && n.classList.contains('arrow')) continue;
        txt += n.textContent || '';
      }
      labels.push(txt.trim());
    }

    var rows = table.querySelectorAll('tbody tr');
    for(var r=0;r<rows.length;r++){
      var tds = rows[r].children;
      var col = 0;                                    // una celda con colspan corre las siguientes
      for(var c=0;c<tds.length;c++){
        var td = tds[c];
        var span = parseInt(td.getAttribute('colspan'),10) || 1;
        var label = (span>1) ? '' : (labels[col] || '');
        col += span;
        if(span>1){ td.setAttribute('data-nolabel',''); td.removeAttribute('data-empty'); continue; }
        td.setAttribute('data-label', label);
        if(!label) td.setAttribute('data-nolabel','');

        // Una celda sin dato y sin nada que tocar no aporta en la tarjeta
        var editable = td.querySelector('input,select,textarea,button');
        var txt = (td.textContent||'').trim();
        if(!editable && EMPTY[txt]) td.setAttribute('data-empty','');
        else td.removeAttribute('data-empty');

        // Un dato largo (los cinco pesos, una lista de tests) no cabe al lado
        // de su titulo: en esas celdas el titulo va encima
        var many = td.querySelectorAll('.samp,.tag,.pill').length > 2;
        if(many || txt.length > 26) td.setAttribute('data-stack','');
        else td.removeAttribute('data-stack');
      }
    }
  }

  // Las etiquetas en blanco de la barra de herramientas (las que solo alinean
  // un botón en escritorio) sobran en el teléfono
  function stampBar(bar){
    var labels = bar.querySelectorAll('.sb-field > label');
    for(var i=0;i<labels.length;i++){
      var t = (labels[i].textContent||'').replace(/ /g,'').trim();
      if(!t) labels[i].setAttribute('data-blank','');
    }
  }

  function scan(root){
    if(!root || root.nodeType!==1) return;
    if(root.matches){
      if(root.matches(SHEETS)) stampSheet(root);
      if(root.matches('.sheet-bar')) stampBar(root);
    }
    // Los renderizadores cambian el <tbody> o las <tr>, no la tabla entera
    if(root.closest){
      var up = root.closest(SHEETS);
      if(up) stampSheet(up);
    }
    var tables = root.querySelectorAll ? root.querySelectorAll(SHEETS) : [];
    for(var i=0;i<tables.length;i++) stampSheet(tables[i]);
    var bars = root.querySelectorAll ? root.querySelectorAll('.sheet-bar') : [];
    for(var j=0;j<bars.length;j++) stampBar(bars[j]);
  }

  function start(){
    scan(document.body);
    if(!window.MutationObserver) return;
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var added = muts[i].addedNodes;
        for(var j=0;j<added.length;j++) scan(added[j]);
      }
    }).observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
