# Login nuevo de punta a punta: app (servidor de diseño ?emu) + emuladores.
import sys, json
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
URL = 'http://localhost:8146/?emu'
fallas = []; errs = []
def chk(n, real, esp):
    ok = real == esp
    if not ok: fallas.append(n)
    print(('OK ' if ok else 'MAL'), n, '->', real, '' if ok else '(esperaba %r)' % (esp,))

def abrir(b, nombre):
    ctx = b.new_context(); pg = ctx.new_page(); pg.set_viewport_size({'width': 1400, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(nombre + ': ' + str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    return ctx, pg
def login(pg, u, p, espera=True):
    pg.evaluate("() => { if(currentUser){ currentUser = null; goTo('screen-login'); initLogin(); } }")
    pg.fill('#login-user', u); pg.fill('#login-pass', p)
    pg.evaluate("() => doLogin()")
    if espera:
        pg.wait_for_function("() => !window.nxLoginBusy", timeout=40000)
    pg.wait_for_timeout(600)
def err(pg): return pg.evaluate("() => { const e = document.getElementById('login-error'); return e && e.style.display !== 'none' ? e.textContent : ''; }")
def usuario(pg): return pg.evaluate("() => currentUser ? currentUser.username : null")

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    # ---------- Ana (operadora) ----------
    ctxA, A = abrir(b, 'ANA')
    chk('arranca en el login, sin admin de fabrica', A.evaluate("() => !currentUser && !getOperators().some(o => o.username === 'admin')"), True)
    login(A, 'ana', 'malmal')
    chk('contraseña mala -> mensaje', err(A), 'Incorrect username or password')
    login(A, 'ana', 'clave123')
    chk('Ana entra', usuario(A), 'ana')
    chk('su pase dice operador 1001, no admin', A.evaluate("() => window._nxClaims && [String(window._nxClaims.op), !!window._nxClaims.admin]"), ['1001', False])
    A.wait_for_function("() => (getDB().weights||[]).some(w => w.product === 'EMU-1')", timeout=20000)
    chk('ve los datos (sincroniza con su pase)', A.evaluate("() => (getDB().weights||[]).some(w => w.product === 'EMU-1')"), True)
    chk('la lista de usuarios de su telefono NO trae contraseñas', A.evaluate("() => getOperators().length > 0 && getOperators().every(o => !o.passHash && !o.pin)"), True)
    chk('NO recibe la lista completa', A.evaluate("() => window._opsFull === true"), False)
    A.evaluate("() => { const r = {id: newRecordId(), date: localDateStr()+'T09:00:00', line: 2, shift: 1, product: 'EMU-2', lot:'26314', total:5, pass:5}; window._r = r; getDB().weights.push(r); saveDB(getDB(), 'weights'); window.saveToFirebase('weights', r); }")
    A.wait_for_function("() => !!window._r._fbId || (getDB().weights.find(w => w.id === window._r.id)||{})._fbId", timeout=15000)
    chk('guarda un registro en Firestore', True, True)
    chk('su canal del lector: si', A.evaluate("async () => { try { await window.readerWrite(String(currentUser.id), {phone:{at:Date.now(), on:true}}); return true; } catch(e){ return e.code; } }"), True)
    chk('el canal de otro: no', A.evaluate("async () => { try { await window.readerWrite('1002', {phone:{at:1}}); return true; } catch(e){ return e.code; } }"), 'permission-denied')
    chk('NO puede guardar usuarios (no es admin)', A.evaluate("() => saveOperators(getOperators())"), False)
    # fotos: con pase pasa la revision (503 = falta el flujo en el emulador), con pase falso 401
    fot = A.evaluate("""async () => { const u = 'http://127.0.0.1:5001/caputo-cheese/us-central1/safetyPhotoGet';
       const t = await window.nxIdToken(); const body = JSON.stringify({fileName:'W-20261110-abcdefgh1234.jpg'});
       const r1 = await fetch(u, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t}, body});
       const r2 = await fetch(u, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer falso'}, body});
       return [r1.status, r2.status]; }""")
    chk('fotos: con su pase pasa (503 = sin flujo en el emulador); pase falso 401', fot, [503, 401])
    # sin internet: entra con lo de este telefono
    A.evaluate("() => { currentUser = null; goTo('screen-login'); initLogin(); }")
    ctxA.set_offline(True)
    login(A, 'ana', 'clave123')
    chk('sin internet: Ana entra con lo de su telefono', usuario(A), 'ana')
    login(A, 'ana', 'otra')
    chk('sin internet: contraseña mala no entra', (usuario(A), err(A)), (None, 'Incorrect username or password'))
    login(A, 'jefe', 'admin456')
    chk('sin internet: quien nunca entro en este telefono no entra', (usuario(A), err(A)), (None, 'No connection. The first time you sign in on this device you need internet.'))
    ctxA.set_offline(False)
    login(A, 'ana', 'clave123')
    chk('de vuelta con internet entra por el servidor', usuario(A), 'ana')

    # ---------- Jefe (administrador) ----------
    ctxB, B = abrir(b, 'JEFE')
    login(B, 'jefe', 'admin456')
    chk('el admin entra', usuario(B), 'jefe')
    B.wait_for_function("() => window._opsFull === true", timeout=20000)
    chk('el admin recibe la lista completa (con hash)', B.evaluate("() => getOperators().filter(o => o.passHash).length >= 2"), True)
    B.wait_for_function("() => typeof roleByKey === 'function' && !!roleByKey('operator') && !!roleByKey('admin')", timeout=20000)
    # le cambia el rol a Ana: a Ana se le cierra la entrada al momento
    B.evaluate("() => setUserRole(1001, 'admin')"); B.wait_for_timeout(800)
    A.wait_for_function("() => { const m = document.getElementById('dup-modal'); return m && getComputedStyle(m).display !== 'none' && /Sign in again/.test(document.getElementById('dup-modal-title').textContent); }", timeout=20000)
    chk('a Ana le sale "Sign in again" al cambiarle el rol', True, True)
    A.evaluate("() => closeDupModal()")
    login(A, 'ana', 'clave123')
    chk('Ana vuelve a entrar y ya trae el rol nuevo', A.evaluate("() => [currentUser && currentUser.role, !!(window._nxClaims && window._nxClaims.admin)]"), ['admin', True])

    # ---------- hash viejo y PIN ----------
    ctxC, C = abrir(b, 'VIEJO')
    login(C, 'viejo', 'antigua1')
    chk('usuario con hash viejo entra', usuario(C), 'viejo')
    B.wait_for_timeout(1500)
    chk('su hash se re-guardo con PBKDF2 en el servidor', B.evaluate("() => (getOperators().find(o => o.id === 1003)||{}).passHash.indexOf('pbkdf2$') === 0"), True)
    login(C, 'pinero', '4321')
    chk('usuario de PIN entra', usuario(C), 'pinero')
    # fuerza bruta: a los 8 intentos malos, espera
    for i in range(8): login(C, 'pinero', 'x%d' % i)
    login(C, 'pinero', '4321')
    chk('tras 8 intentos malos se bloquea un rato', err(C), 'Too many attempts. Wait 15 minutes and try again.')
    b.close()
print('errores de pagina:', errs[:5]); print('FALLAS:', fallas)
