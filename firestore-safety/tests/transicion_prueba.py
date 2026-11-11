# Estreno: reglas de hoy (abiertas a cualquier sesion) y el servidor de login caido.
import sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
fallas = []
def chk(n, real, esp):
    ok = real == esp
    if not ok: fallas.append(n)
    print(('OK ' if ok else 'MAL'), n, '->', real, '' if ok else '(esperaba %r)' % (esp,))
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto('http://localhost:8146/?emu', wait_until='load'); pg.wait_for_timeout(2500)
    # un telefono de hoy: ya tiene la lista de usuarios con hash (la sincronizaba la app vieja)
    pg.evaluate("""async () => { const h = await hashPasswordSecure('clave123');
       const db = getDB(); db.operators = [{id:1001, name:'Ana Ruiz', username:'ana', role:'operator', passHash:h}]; saveDB(db);
       NX_LOGIN_URL = 'http://127.0.0.1:5999/caido'; }""")
    pg.fill('#login-user', 'ana'); pg.fill('#login-pass', 'clave123'); pg.evaluate("() => doLogin()")
    pg.wait_for_function("() => !window.nxLoginBusy", timeout=30000); pg.wait_for_timeout(1500)
    chk('servidor caido: entra como antes', pg.evaluate("() => currentUser && currentUser.username"), 'ana')
    try:
        pg.wait_for_function("() => (getDB().weights||[]).some(w => w.product === 'EMU-1')", timeout=20000); ok = True
    except Exception: ok = False
    chk('y sincroniza con sesion anonima (reglas de hoy)', ok, True)
    pg.evaluate("() => { currentUser = null; goTo('screen-login'); initLogin(); }")
    pg.fill('#login-user', 'ana'); pg.fill('#login-pass', 'mala'); pg.evaluate("() => doLogin()")
    pg.wait_for_function("() => !window.nxLoginBusy", timeout=30000); pg.wait_for_timeout(500)
    chk('servidor caido: contraseña mala no entra', pg.evaluate("() => currentUser"), None)
    b.close()
print('FALLAS:', fallas)
