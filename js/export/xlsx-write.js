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
var XL_NUMERIC = /^(moisture|fat|ph|aw|salt|yeast|mold|temp|temperature|humidity|weight|avg|average|total|count|compliance|pass|samples?|products?|people|qty|quantity|%.*|.*\s%|.*\(%\))$/i;

function xlNumericHeader(h){
  return XL_NUMERIC.test(String(h==null?'':h).trim());
}

function xlSheetXml(rows){
  var ancho = [];
  var cabecera = rows[0] || [];
  var numerica = cabecera.map(xlNumericHeader);
  var filas = rows.map(function(fila, i){
    var celdas = (fila||[]).map(function(v, j){
      var ref = xlCol(j) + (i + 1);
      var txt = String(v==null ? '' : v);
      ancho[j] = Math.max(ancho[j] || 10, Math.min(52, txt.length + 2));
      if(txt === '') return '<c r="'+ref+'"'+(i===0?' s="1"':'')+'/>';
      if(i > 0 && numerica[j] && xlIsNumber(txt)) return '<c r="'+ref+'"><v>'+Number(txt)+'</v></c>';
      return '<c r="'+ref+'" t="inlineStr"'+(i===0?' s="1"':'')+
             '><is><t xml:space="preserve">'+xlEsc(txt)+'</t></is></c>';
    }).join('');
    return '<row r="'+(i+1)+'">'+celdas+'</row>';
  }).join('');

  var cols = ancho.map(function(w, j){
    return '<col min="'+(j+1)+'" max="'+(j+1)+'" width="'+w+'" customWidth="1"/>';
  }).join('');
  var ultima = xlCol(Math.max(0, (rows[0]||[]).length - 1)) + Math.max(1, rows.length);

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0" showGridLines="1">'+
      // la cabecera se queda a la vista al bajar
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'+
    '</sheetView></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="15"/>'+
    (cols ? '<cols>'+cols+'</cols>' : '')+
    '<sheetData>'+filas+'</sheetData>'+
    '<autoFilter ref="A1:'+ultima+'"/>'+
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
    '<cellXfs count="2">'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" '+
        'applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>'+
    '</cellXfs>'+
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'+
    '</styleSheet>';
}

// Nombre de hoja valido: Excel no admite : \ / ? * [ ] ni mas de 31 letras
function xlSheetName(n){
  return (String(n||'Data').replace(/[:\\\/?*\[\]]/g,' ').trim().slice(0,31)) || 'Data';
}

// Arma el .xlsx y devuelve el Blob
function buildXLSX(rows, hoja){
  if(typeof JSZip === 'undefined') return null;
  var zip = new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
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
    '<sheets><sheet name="'+xlEsc(xlSheetName(hoja))+'" sheetId="1" r:id="rId1"/></sheets>'+
    '</workbook>');
  xl.folder('_rels').file('workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>');
  xl.file('styles.xml', xlStylesXml());
  xl.folder('worksheets').file('sheet1.xml', xlSheetXml(rows));
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

// Baja la lista como Excel. El nombre puede venir con .csv de antes: se cambia.
function downloadSheet(name, rows, hoja){
  var archivo = String(name||'export').replace(/\.(csv|xlsx)$/i, '') + '.xlsx';
  var p = buildXLSX(rows, hoja || xlNameFromFile(archivo));
  if(!p){                                   // sin JSZip, al menos que baje algo
    downloadCSVRaw(archivo.replace(/\.xlsx$/,'.csv'), rows);
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
    console.error('downloadSheet:', e);
    if(typeof toast === 'function') toast('Could not build the Excel file');
  });
}
