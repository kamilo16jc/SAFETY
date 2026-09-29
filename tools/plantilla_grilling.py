# -*- coding: utf-8 -*-
# ============================================================
# PLANTILLA DE LA FORMA DE GRILLING CHEESE
#
# Convierte la forma oficial de Word (SQF # 2.4.D.3.A) en la plantilla que
# rellena la aplicacion: assets/grilling_form_template.docx. No se redibuja
# nada, es el mismo archivo —misma cabecera, mismas tablas, mismo Document
# Control—, solo que los datos de ejemplo salen y en su sitio queda un
# {{Marcador}} que js/integrations/grilling-fill.js cambia por el dato real.
#
# Los sitios donde va cada dato se sacan de los marcadores que la propia forma
# ya trae dentro (bm_ph, bm_fat, bm_appearance_yn...).
#
# Cuando QA emita una revision nueva de la forma, esto es lo unico que hay que
# correr: se apunta ORIGEN al .docx nuevo y la aplicacion sigue igual.
#
#   python tools/plantilla_grilling.py
# ============================================================
import zipfile, re, shutil, os, io

ORIGEN  = r"C:\Users\Julic\Downloads\2.4.D.3.A Pre-Grilling Cheese Verification Log 021225.docx"
DESTINO = r"C:\Users\Julic\safety-work\assets\grilling_form_template.docx"

zin = zipfile.ZipFile(ORIGEN)
xml = zin.read('word/document.xml').decode('utf-8')

# ---------- utilidades sobre el XML ----------
def celda_en(pos):
    """(ini, fin) de la <w:tc> que contiene esa posicion.
    Ojo: <w:tcPr> y <w:tcBorders> empiezan igual, por eso se exige que
    despues de <w:tc venga un espacio o el cierre del tag."""
    abre = [m.start() for m in re.finditer(r'<w:tc[ >]', xml)]
    cierra = [m.start() for m in re.finditer(r'</w:tc>', xml)]
    marcas = sorted([(i,1) for i in abre] + [(i,-1) for i in cierra])
    pila = []
    for i, tipo in marcas:
        if tipo == 1:
            pila.append(i)
        else:
            if not pila: continue
            ini = pila.pop()
            fin = i + len('</w:tc>')
            if ini <= pos < fin and not any(p2 <= pos for p2 in pila[len(pila):]):
                return (ini, fin)
    return None

RUN = r'<w:r(?: [^>]*)?>(?:(?!</w:r>).)*?</w:r>'

def rpr_de(trozo):
    """El formato de letra del ultimo run con texto. Se busca dentro del run,
    no suelto por el trozo: si no, se atrapa el <w:rPr> del <w:pPr>."""
    for r in reversed(re.findall(RUN, trozo, re.S)):
        if '<w:t' in r:
            m = re.search(r'<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>', r, re.S)
            if m: return m.group(0)
            return ''
    return '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'

def ppr_de(trozo):
    ps = re.findall(r'<w:p(?: [^>]*)?>(?:(?!</w:p>).)*?</w:p>', trozo, re.S)
    for p2 in reversed(ps):
        if '<w:t' in p2:
            m = re.search(r'<w:pPr>(?:(?!</w:pPr>).)*</w:pPr>', p2, re.S)
            if m: return m.group(0)
    m = re.search(r'<w:pPr>(?:(?!</w:pPr>).)*</w:pPr>', trozo, re.S)
    return m.group(0) if m else ''

def token_en_celda(pos, token):
    """Deja la celda que contiene pos con un solo parrafo: el token."""
    global xml
    c = celda_en(pos)
    assert c, 'sin celda en %d' % pos
    trozo = xml[c[0]:c[1]]
    tcpr = re.search(r'<w:tcPr>.*?</w:tcPr>', trozo, re.S)
    nueva = ('<w:tc>' + (tcpr.group(0) if tcpr else '') + '<w:p>' + ppr_de(trozo) +
             '<w:r>' + rpr_de(trozo) + '<w:t xml:space="preserve">'+token+'</w:t></w:r>'+
             '</w:p></w:tc>')
    xml = xml[:c[0]] + nueva + xml[c[1]:]

def pos_bookmark(nombre):
    m = re.search(r'<w:bookmarkStart w:id="\d+" w:name="%s"/>' % nombre, xml)
    assert m, 'falta el marcador '+nombre
    return m.start()

# ---------- 1. el lote: es la celda siguiente a su rotulo ----------
rot = xml.find('Grilling Cheese Batch ID/Lot #')
assert rot > 0
fin_rotulo = celda_en(rot)[1]
sig = xml.find('<w:tc>', fin_rotulo)
sig2 = xml.find('<w:tc ', fin_rotulo)
if sig2 >= 0 and (sig < 0 or sig2 < sig): sig = sig2
token_en_celda(sig+4, '{{Lote}}')

# ---------- 2. cada marcador de la forma, uno por uno ----------
# Se van de atras hacia adelante no hace falta: se busca el marcador cada vez,
# que para eso el archivo se va reescribiendo entero.
CAMPOS = [
    ('bm_date_received',      '{{FechaRecibido}}'),
    ('bm_received_by',        '{{RecibidoPor}}'),
    ('bm_ph',                 '{{PH}}'),
    ('bm_fat',                '{{Fat}}'),
    ('bm_moisture',           '{{Moisture}}'),
    ('bm_date_tested_chem',   '{{FechaTest}}'),
    ('bm_performed_by_chem',  '{{TestPor}}'),
    ('bm_corrective_actions', '{{Correctivas}}'),
    ('bm_date_tested2',       '{{FechaSensory}}'),
    ('bm_performed_by2',      '{{SensoryPor}}'),
    ('bm_approved_by',        '{{AprobadoPor}}'),
    ('bm_date_approved',      '{{FechaAprobado}}'),
]
for nombre, token in CAMPOS:
    token_en_celda(pos_bookmark(nombre), token)

# ---------- 3. el Yes / or / No de appearance y texture ----------
# En papel se encierra en un circulo la respuesta. Aqui el parrafo entero de la
# eleccion se cambia por un solo token, y la aplicacion mete los dos textos con
# el elegido subrayado.
def token_yes_no(marcador, token):
    global xml
    pos = pos_bookmark(marcador)
    ini = xml.rfind('<w:p ', 0, pos)
    fin = xml.find('</w:p>', pos) + len('</w:p>')
    parrafo = xml[ini:fin]
    # el primer 'Yes' del parrafo marca donde empieza la eleccion
    m = re.search(r'<w:r(?: [^>]*)?>(?:(?!</w:r>).)*?<w:t[^>]*>[^<]*Yes', parrafo, re.S)
    assert m, 'sin Yes en '+marcador
    corte = m.start()
    nuevo = parrafo[:corte] + '<w:r>'+rpr_de(parrafo)+'<w:t xml:space="preserve">'+token+'</w:t></w:r></w:p>'
    xml = xml[:ini] + nuevo + xml[fin:]

token_yes_no('bm_appearance_yn', '{{AppYN}}')
token_yes_no('bm_texture_yn',    '{{TexYN}}')

# ---------- 4. los dos renglones de Comments ----------
comentarios = ['{{AppComments}}', '{{TexComments}}']
def poner_comentario(m, _i=[0]):
    t = m.group(1)
    if t.strip().startswith('Comments') and _i[0] < 2:
        tok = comentarios[_i[0]]; _i[0] += 1
        return m.group(0).replace(t, t+'  '+tok)
    return m.group(0)
xml = re.sub(r'<w:t[^>]*>([^<]*)</w:t>', poner_comentario, xml)

# ---------- guardar ----------
os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
zout = zipfile.ZipFile(DESTINO, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    datos = zin.read(it.filename)
    if it.filename == 'word/document.xml':
        datos = xml.encode('utf-8')
    zout.writestr(it, datos)
zout.close()

# ---------- comprobacion ----------
zz = zipfile.ZipFile(DESTINO)
x2 = zz.read('word/document.xml').decode('utf-8')
tokens = sorted(set(re.findall(r'\{\{[A-Za-z]+\}\}', x2)))
print('plantilla:', DESTINO)
print('tokens:', tokens, '->', len(tokens))
sobra = [s for s in ['JULIAN','MARTINA','AGUDELO','50.18','37.96','6.34','E09'] if s in x2]
print('datos de ejemplo que quedaron:', sobra or 'ninguno')
texto = ' '.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', x2, re.S))
print('---- texto de la plantilla ----')
print(re.sub(r'\s+', ' ', texto)[:1500])
