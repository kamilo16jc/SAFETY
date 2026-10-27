// ===== ESCRIBIR UN EXCEL DE VERDAD =====
// Las listas se bajaban como CSV separado por comas. En un Windows en español
// Excel separa por punto y coma, asi que abria el archivo y metia la fila
// entera en la primera celda: todo corrido, ilegible, imposible de filtrar.
//
// Aqui se arma un .xlsx de verdad —un zip con el XML de la hoja—, y entonces
// cada dato cae en su celda sin depender de la configuracion del equipo.
// Ademas: la cabecera queda fija y en negrita, con filtro, y las columnas
// salen con el ancho de lo que llevan dentro.
//
// Lo que parece numero se guarda como numero, para poder sumar y ordenar. Lo
// que trae ceros delante —un lote 00180, un producto 00711— se queda como
// texto: si Excel lo tomara como numero, se comeria los ceros.
//
// Los DECIMALES van como texto, tal como se capturaron: un 40.85 guardado como
// numero Excel lo pinta con el separador del equipo, y en un Windows en
// español sale 40,85. Como texto sale 40.85 en cualquier equipo. Van
// alineados a la derecha, como numero, y sin el triangulito verde de "numero
// guardado como texto".

function xlEsc(s){
  return String(s==null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');   // Excel no admite estos
}

// A, B, ... Z, AA, AB...
function xlCol(n){
  var s = '';
  n = n + 1;
  while(n > 0){
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xlIsNumber(v){
  if(typeof v === 'number') return isFinite(v);
  var s = String(v==null?'':v).trim();
  if(!s || !/^-?\d+(\.\d+)?$/.test(s)) return false;
  return String(Number(s)) === s;     // "00180" no pasa: perderia los ceros
}

// Solo las MEDIDAS entran como numero, para poder sumarlas y ordenarlas. Un
// numero de orden, un PO o un lote son identificadores: si Excel los toma como
// numero los alinea a la derecha, se come los ceros de adelante y a los largos
// les pone notacion cientifica. Esos van como texto.
var XL_NUMERIC = /^(moisture|fat|ph|aw|salt|yeast|mold|coliform|e\.? ?coli|pseudomonas|matrix .+|temp|temperature|humidity|weight|avg|average|total|count|compliance|pass|in target|out of target|.+ failed|failures|samples?|sample \d+|products?|people|qty|quantity|%.*|.*\s%|.*\(%\))$/i;

function xlNumericHeader(h){
  return XL_NUMERIC.test(String(h==null?'':h).trim());
}

// 40.85, .5, -0.3: lleva punto decimal
function xlIsDecimal(v){
  return /^-?\d*\.\d+$/.test(String(v==null?'':v).trim());
}

// Una hoja. Con cabecera (lo normal) la primera fila va en negrita, fija y
// con filtro, y la cabecera dice que columnas son medidas. Sin cabecera (un
// resumen con titulos sueltos) solo entran como numero los que vienen como
// numero de verdad.
function xlSheetXml(rows, op){
  op = op || {};
  var conCab = op.cabecera !== false;
  var ancho = [];
  var cabecera = conCab ? (rows[0] || []) : [];
  var numerica = cabecera.map(xlNumericHeader);
  // Una columna de medidas con algun decimal va entera como texto, para que
  // 40 y 40.85 se ordenen juntos y no los numeros por un lado y el texto por otro
  var conDecimal = numerica.map(function(es, j){
    return es && rows.some(function(f, i){ return i > 0 && f && xlIsDecimal(f[j]); });
  });
  var texto = function(ref, txt, s){
    return '<c r="'+ref+'" t="inlineStr"'+(s?' s="'+s+'"':'')+
           '><is><t xml:space="preserve">'+xlEsc(txt)+'</t></is></c>';
  };
  var filas = rows.map(function(fila, i){
    var celdas = (fila||[]).map(function(v, j){
      var ref = xlCol(j) + (i + 1);
      var txt = String(v==null ? '' : v);
      ancho[j] = Math.max(ancho[j] || 10, Math.min(52, txt.length + 2));
      var esCab = conCab && i === 0;
      if(txt === '') return '<c r="'+ref+'"'+(esCab?' s="1"':'')+'/>';
      if(esCab) return texto(ref, txt, 1);
      if(conCab ? numerica[j] : typeof v === 'number'){
        if(xlIsNumber(v) && !xlIsDecimal(txt) && !(conCab && conDecimal[j]))
          return '<c r="'+ref+'"><v>'+Number(txt)+'</v></c>';
        return texto(ref, txt, 2);       // a la derecha, como numero
      }
      return texto(ref, txt);
    }).join('');
    return '<row r="'+(i+1)+'">'+celdas+'</row>';
  }).join('');

  var cols = ancho.map(function(w, j){
    return '<col min="'+(j+1)+'" max="'+(j+1)+'" width="'+w+'" customWidth="1"/>';
  }).join('');
  var nCols = rows.reduce(function(m, f){ return Math.max(m, (f||[]).length); }, 1);
  var ultima = xlCol(Math.max(0, (conCab ? (rows[0]||[]).length : nCols) - 1)) + Math.max(1, rows.length);
  var todo = 'A1:' + xlCol(nCols - 1) + Math.max(1, rows.length);

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0" showGridLines="1">'+
      // la cabecera se queda a la vista al bajar
      (conCab ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '')+
    '</sheetView></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="15"/>'+
    (cols ? '<cols>'+cols+'</cols>' : '')+
    '<sheetData>'+filas+'</sheetData>'+
    (conCab ? '<autoFilter ref="A1:'+ultima+'"/>' : '')+
    // los numeros que van como texto (decimales, lotes, PO) sin triangulito verde
    '<ignoredErrors><ignoredError sqref="'+todo+'" numberStoredAsText="1"/></ignoredErrors>'+
    '</worksheet>';
}

function xlStylesXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="2">'+
      '<font><sz val="11"/><name val="Calibri"/></font>'+
      '<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>'+
    '</fonts>'+
    '<fills count="3">'+
      '<fill><patternFill patternType="none"/></fill>'+
      '<fill><patternFill patternType="gray125"/></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEFEC"/>'+
        '<bgColor indexed="64"/></patternFill></fill>'+
    '</fills>'+
    '<borders count="2">'+
      '<border><left/><right/><top/><bottom/><diagonal/></border>'+
      '<border><left/><right/><top/><bottom style="thin">'+
        '<color rgb="FF9CA3AF"/></bottom><diagonal/></border>'+
    '</borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="3">'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" '+
        'applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>'+
      // s="2": una medida que va como texto, a la derecha como los numeros
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'+
        '<alignment horizontal="right"/></xf>'+
    '</cellXfs>'+
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'+
    '</styleSheet>';
}

// Nombre de hoja valido: Excel no admite : \ / ? * [ ] ni mas de 31 letras
function xlSheetName(n){
  return (String(n||'Data').replace(/[:\\\/?*\[\]]/g,' ').trim().slice(0,31)) || 'Data';
}

// Arma el .xlsx y devuelve la promesa del Blob. Una o varias hojas:
// [{nombre, filas, cabecera}] (cabecera:false para un resumen que no es tabla).
function buildXLSXBook(hojas){
  if(typeof JSZip === 'undefined') return null;
  var zip = new JSZip();
  var n = hojas.length;
  var cada = function(fn){ return hojas.map(function(h, i){ return fn(h, i + 1); }).join(''); };
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    cada(function(h, k){
      return '<Override PartName="/xl/worksheets/sheet'+k+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    })+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    '</Types>');
  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>');
  var xl = zip.folder('xl');
  xl.file('workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>'+cada(function(h, k){
      return '<sheet name="'+xlEsc(xlSheetName(h.nombre))+'" sheetId="'+k+'" r:id="rId'+k+'"/>';
    })+'</sheets>'+
    '</workbook>');
  xl.folder('_rels').file('workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    cada(function(h, k){
      return '<Relationship Id="rId'+k+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+k+'.xml"/>';
    })+
    '<Relationship Id="rId'+(n+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>');
  xl.file('styles.xml', xlStylesXml());
  var ws = xl.folder('worksheets');
  hojas.forEach(function(h, i){ ws.file('sheet'+(i+1)+'.xml', xlSheetXml(h.filas || [], h)); });
  return zip.generateAsync({type:'blob', compression:'DEFLATE',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

// El nombre de la hoja sale del archivo: "sample-analysis-2026-09-28" queda
// como "Sample Analysis", que es lo que se lee en la pestaña de Excel.
function xlNameFromFile(archivo){
  return String(archivo||'')
    .replace(/\.(csv|xlsx)$/i,'')
    .replace(/[-_]?\d{4}-\d{2}-\d{2}.*$/,'')      // fuera la fecha del final
    .replace(/[-_]+/g,' ').trim()
    .replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); })
    .replace(/\b(Coa|Qa|Gmp|Capa|Po|Lot|Rd)\b/g, function(w){ return w.toUpperCase(); })
    || 'Data';
}

// ---- El orden de las filas ----
// Todo lo que se baja a Excel sale en el orden en que se capturo: lo primero
// arriba y lo ultimo abajo (si se iba en la G y despues la H, la G va arriba).
// No es el orden de la pantalla, que pone lo mas nuevo primero.
//
// El id de cada registro es el momento en que se creo (newRecordId: ms*4096;
// los de antes, ms a secas). Sin id numerico, createdAt y despues la fecha.
// Lo que no trae nada de eso es de antes de que se guardara: va primero, en
// el orden en que esta.
function xlEntryTime(r){
  var id = r && r.id;
  if(typeof id === 'number' && id > 1e11) return id > 1e14 ? id / 4096 : id;
  var t = Date.parse((r && (r.createdAt || r.date)) || '');
  return isNaN(t) ? -Infinity : t;
}
function xlEntryOrder(list){
  return (list || []).map(function(x, i){ return {x:x, i:i, t:xlEntryTime(x)}; })
    .sort(function(a, b){ return (a.t - b.t) || (a.i - b.i); })
    .map(function(o){ return o.x; });
}

// Baja la lista como Excel. El nombre puede venir con .csv de antes: se cambia.
function downloadSheet(name, rows, hoja){
  var archivo = String(name||'export').replace(/\.(csv|xlsx)$/i, '') + '.xlsx';
  downloadBook(archivo, [{nombre: hoja || xlNameFromFile(archivo), filas: rows}]);
}

// Baja un libro de varias hojas (el Dashboard, el Hold log)
function downloadBook(name, hojas){
  var archivo = String(name||'export').replace(/\.(csv|xlsx)$/i, '') + '.xlsx';
  var p = buildXLSXBook(hojas);
  if(!p){                                   // sin JSZip, al menos que baje algo
    downloadCSVRaw(archivo.replace(/\.xlsx$/,'.csv'), hojas[0].filas);
    return;
  }
  p.then(function(blob){
    if(typeof _deliverFile === 'function'){ _deliverFile(blob, archivo); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = archivo;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }).catch(function(e){
    console.error('downloadBook:', e);
    if(typeof toast === 'function') toast('Could not build the Excel file');
  });
}
