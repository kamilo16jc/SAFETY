# -*- coding: utf-8 -*-
# ============================================================
# INVENTARIO DEL SISTEMA
#
# Recorre los archivos del repositorio y saca los numeros que sostienen
# docs/SAFETY-mapa-del-sistema.pdf: cuantas funciones hay, quien llama a quien,
# que coleccion toca cada modulo y que pantalla arranca con que funcion.
#
# Cuando el codigo cambie lo suficiente, se vuelve a correr, se actualizan las
# tablas de docs/mapa-del-sistema.html y se imprime otra vez a PDF:
#
#   python tools/inventario.py
#   chrome --headless=new --no-pdf-header-footer #          --print-to-pdf=docs/SAFETY-mapa-del-sistema.pdf docs/mapa-del-sistema.html
# ============================================================
import io, os, re, json, collections

ROOT = r'C:\Users\Julic\safety-work'
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventario.json')

def archivos():
    out = []
    for base, dirs, files in os.walk(ROOT):
        if '.git' in base or 'node_modules' in base: continue
        for f in files:
            if f.endswith('.js') and 'vendor' not in base:
                p = os.path.join(base, f)
                out.append(os.path.relpath(p, ROOT).replace('\\','/'))
    return sorted(out)

FUNC = re.compile(r'^\s*function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)', re.M)
ASSIGN = re.compile(r'^\s*(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(([^)]*)\)', re.M)
VAR = re.compile(r'^\s*var\s+([A-Za-z_$][\w$]*)\s*=', re.M)

datos = {'files': {}, 'funcs': {}, 'calls': {}, 'cols': {}, 'screens': {}}

texto = {}
for rel in archivos():
    s = io.open(os.path.join(ROOT, rel), encoding='utf-8').read()
    texto[rel] = s
    fns = [m.group(1) for m in FUNC.finditer(s)] + [m.group(1) for m in ASSIGN.finditer(s)]
    fns = sorted(set(fns))
    datos['files'][rel] = {
        'lineas': s.count('\n')+1,
        'bytes': len(s),
        'funciones': fns,
        'vars': sorted(set(m.group(1) for m in VAR.finditer(s))),
        'comentario': '\n'.join([l for l in s.split('\n')[:12] if l.strip().startswith('//')])[:600]
    }
    for f in fns:
        datos['funcs'].setdefault(f, []).append(rel)

# --- quien llama a quien (entre archivos) ---
todas = set(datos['funcs'].keys())
for rel, s in texto.items():
    # se quitan las definiciones para no contarlas como llamadas
    cuerpo = FUNC.sub('', s)
    usadas = set(re.findall(r'\b([A-Za-z_$][\w$]*)\s*\(', cuerpo))
    fuera = collections.Counter()
    for f in usadas & todas:
        for origen in datos['funcs'][f]:
            if origen != rel:
                fuera[origen] += 1
    datos['calls'][rel] = dict(fuera)

# --- colecciones que toca cada archivo ---
COL = re.compile(r"(?:saveDB\(\s*db\s*,\s*'([a-zA-Z]+)'|db\.([a-zA-Z]+)\s*=|getDB\(\)\.([a-zA-Z]+)|d\.([a-zA-Z]+))")
for rel, s in texto.items():
    c = collections.Counter()
    for m in COL.finditer(s):
        nombre = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        if nombre and nombre not in ('length','map','filter','forEach','push'):
            c[nombre] += 1
    datos['cols'][rel] = dict(c.most_common(14))

# --- pantallas: id -> quien la arranca ---
nav = texto.get('js/core/nav.js','')
for m in re.finditer(r"id==='(screen-[a-z]+)'\)\s*([A-Za-z_$][\w$]*)\(", nav):
    datos['screens'][m.group(1)] = m.group(2)

# modulos declarados
mod = texto.get('js/core/modules.js','')
datos['modules'] = re.findall(r"\{\s*id:'(\w+)',\s*color:'([^']+)',\s*ink:'([^']+)',\s*name:'([^']+)'", mod)
datos['items'] = re.findall(r"\{screen:'([\w-]+)',\s*name:'([^']+)'", mod)

# html
html = io.open(os.path.join(ROOT,'index.html'), encoding='utf-8').read()
datos['index'] = {
  'lineas': html.count('\n')+1,
  'scripts': re.findall(r'<script src="([^"]+)"', html),
  'pantallas': re.findall(r'<div class="screen" id="([\w-]+)"', html)
}
sw = io.open(os.path.join(ROOT,'sw.js'), encoding='utf-8').read()
datos['sw'] = {'cache': re.search(r"CACHE = '([^']+)'", sw).group(1),
               'archivos': len(re.findall(r"'\./", sw))}
css = io.open(os.path.join(ROOT,'css','styles.css'), encoding='utf-8').read()
datos['css'] = {'lineas': css.count('\n')+1, 'reglas': css.count('{')}

fb = texto.get('js/core/firebase.js','')
datos['firebase'] = {
  'big': re.search(r"BIG_COLS\s*=\s*\[([^\]]+)\]", fb).group(1),
  'small': re.search(r"SMALL_COLS\s*=\s*\[([^\]]+)\]", fb).group(1),
  'docs': sorted(set(re.findall(r"doc\(db,'config','(\w+)'\)", fb))),
  'listeners': len(re.findall(r'onSnapshot\(', fb)),
  'ventana': re.search(r"WINDOW_DAYS\s*=\s*(\d+)", fb).group(1)
}

io.open(SALIDA,'w',encoding='utf-8').write(json.dumps(datos, indent=1, ensure_ascii=False))

# --- resumen en pantalla ---
print('ARCHIVOS JS:', len(datos['files']))
print('FUNCIONES  :', len(datos['funcs']))
print('LINEAS JS  :', sum(f['lineas'] for f in datos['files'].values()))
print('index.html :', datos['index']['lineas'], 'lineas,', len(datos['index']['pantallas']), 'pantallas')
print('css        :', datos['css']['lineas'], 'lineas,', datos['css']['reglas'], 'reglas')
print('sw         :', datos['sw'])
print('firebase   :', datos['firebase'])
print()
print('%-38s %6s %5s' % ('archivo','lineas','func'))
for rel, f in sorted(datos['files'].items(), key=lambda x:-x[1]['lineas']):
    print('%-38s %6d %5d' % (rel, f['lineas'], len(f['funciones'])))
