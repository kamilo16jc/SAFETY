// ===== COA: SE RELLENA LA FORMA DEL CLIENTE =====
// La misma idea que las formas de GMP, metal y pesos: no se dibuja una copia
// parecida, se rellena el archivo de verdad. La plantilla es el propio Excel
// del cliente con cada dato cambiado por una marca {{...}}; aqui se cambian
// las marcas por los valores y se devuelve el .xlsx, con su logo, sus bordes
// y su area de impresion intactos.
//
// Convertirlo a PDF aqui dentro no se puede: el navegador no sabe abrir un
// libro de Excel. El PDF sale de la vista de impresion (el mismo diseno en
// HTML) o del propio Excel al guardar como PDF.

// La misma resolucion que la vista de impresion, para que las dos salidas
// digan lo mismo: analisis -> nombre -> producto.
function _coaCliente(a){
  if(typeof coaCustomerOf === 'function') return coaCustomerOf(a) || {};
  if(typeof customerById === 'function' && a.customerId){
    var c = customerById(a.customerId);
    if(c) return c;
  }
  var lista = (typeof getCustomers === 'function') ? getCustomers() : [];
  return lista.filter(function(c){ return c.company === a.customer; })[0] || {};
}

// Fecha como la escribe la forma: 3/3/2026
function _coaFecha(iso){
  var d = new Date(String(iso||'').slice(0,10)+'T12:00:00');
  return isNaN(d) ? String(iso||'') : (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
}

// El valor del laboratorio externo manda; si no hay, el de la casa; si no hay
// ninguno, la forma dice "Pending", que es lo que el cliente entiende.
function _coaVal(a, propio, externo){
  var m = a[externo], o = a[propio];
  if(m != null && String(m).trim() !== '') return String(m);
  return (o != null && String(o).trim() !== '') ? String(o) : 'Pending';
}

function buildCoaTokens(a){
  var c = _coaCliente(a);
  var t = c.targets || {};
  var prod = (typeof findProduct === 'function') ? findProduct(a.product) : null;
  return {
    DESC:     a.cheese || (prod && prod.name) || c.productName || '',
    CUSTNAME: a.customer || c.company || '',
    CUSTID:   c.customerId || a.customerId || '',
    CUSTCODE: c.code || '',
    PHONE:    c.phone || '',
    FAX:      c.fax || '',
    CONTACT:  c.contact || '',
    EMAIL:    c.email || '',
    PART:     a.product || '',
    PO:       a.po || '',
    ORDER:    a.order || '',
    LOT:      (typeof analysisLot === 'function' ? analysisLot(a) : a.lot) || '',
    MFGDATE:  _coaFecha(a.prodDate || a.date),
    PACK:     c.packaging || (prod ? (prod.pkgLabel || prod.size || '') : ''),
    MOIST:    _coaVal(a,'moisture','mxMoisture'),
    FAT:      _coaVal(a,'fat','mxFat'),
    PH:       _coaVal(a,'ph','mxPh'),
    PH2:      '',
    YEAST:    _coaVal(a,'yeast','mxYeast'),
    MOLD:     _coaVal(a,'mold','mxMold'),
    TMOIST:   t.moisture || '',
    TFAT:     t.fat || '',
    TPH:      t.ph || '',
    TYEAST:   t.yeast || '',
    TMOLD:    t.mold || ''
  };
}

function _coaXmlEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function _coaFilename(a){
  var c = _coaCliente(a);
  var partes = [c.customerId || 'COA', a.product || '', a.coaNo || ''].filter(Boolean);
  return partes.join('_').replace(/[\\/:*?"<>|]/g,'-') + '.xlsx';
}

function fillCoaXlsx(a){
  if(typeof JSZip === 'undefined') return Promise.reject(new Error('JSZip no cargó'));
  return fetch('assets/coa_form_template.xlsx')
    .then(function(r){ if(!r.ok) throw new Error('No se encontró la plantilla del COA'); return r.arrayBuffer(); })
    .then(function(buf){ return JSZip.loadAsync(buf); })
    .then(function(zip){
      var hoja = 'xl/worksheets/sheet1.xml';
      return zip.file(hoja).async('string').then(function(xml){
        var map = buildCoaTokens(a);
        Object.keys(map).forEach(function(k){
          xml = xml.split('{{'+k+'}}').join(_coaXmlEsc(map[k]));
        });
        xml = xml.replace(/\{\{[A-Z0-9]+\}\}/g, '');     // marca sin dato -> vacia
        zip.file(hoja, xml);
        return zip.generateAsync({type:'blob', compression:'DEFLATE'});
      });
    });
}

// Rellena y entrega (compartir en iOS, descargar en PC)
function downloadCoaXlsx(a){
  return fillCoaXlsx(a).then(function(blob){
    var nombre = _coaFilename(a);
    return _deliverFile(blob, nombre).then(function(){ return nombre; });
  });
}

// Lo que pulsa el usuario: una forma por registro elegido
function downloadCoaForms(){
  var db = getDB();
  var lista = (db.analysis||[]).filter(function(a){ return coaPicks[a.id]; });
  if(!lista.length){ toast('Select at least one record'); return; }
  var i = 0;
  var siguiente = function(){
    if(i >= lista.length){ toast(lista.length+' form(s) downloaded'); return; }
    var a = lista[i++];
    downloadCoaXlsx(a).then(function(){ setTimeout(siguiente, 400); })
      .catch(function(e){ toast('Could not fill the form: '+(e.message||e)); });
  };
  siguiente();
}
