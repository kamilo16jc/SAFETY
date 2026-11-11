# SAFETY — Revisión de seguridad

Fecha: 2026-09-04 · Alcance: revisión de código + pruebas de concepto no destructivas
sobre la copia local. No se alteró, borró ni exfiltró ningún dato de producción.

---

## Noviembre 2026 — login por servidor y reglas cerradas

**Confirmado el 10 nov 2026** (lectura de las reglas publicadas): Firestore
dejaba leer y escribir TODO a cualquier sesión, y la app abría una sesión
anónima para cualquiera. Con la dirección pública de la app se podía bajar o
borrar la base completa (clientes incluidos).

**Cómo quedó:**
- La contraseña la revisa el servidor: función `safetyLogin`
  (`functions/index.js`, proyecto envirotrack-5173f, codebase `safety`). Usa los
  mismos esquemas de siempre (PBKDF2, SHA-256 viejo —que re-guarda con PBKDF2—
  y PIN), frena la fuerza bruta (8 intentos por usuario / 15 min, 30 por
  dirección / 10 min) y entrega un pase de Firebase (custom token) de
  caputo-cheese con el número de operador. Escribe `access/{operador}`.
- Las reglas (`firestore-safety/firestore.rules`): solo entra quien trae el
  pase y tiene `access/{operador}` activo. `config/operators` (los hashes) solo
  la lee y escribe un administrador; `config/roles` solo la escribe él;
  `access` solo lo crea la función; `reader/{operador}` es de cada uno.
- Al cambiar el rol, las funciones o la contraseña de alguien (o borrarlo), el
  panel de Admin borra su `access`: tiene que volver a entrar y entra con lo
  nuevo. El teléfono lo nota al momento y le pide entrar otra vez.
- Sin señal se entra con la credencial que ESE teléfono guardó la última vez
  que esa persona entró con internet (solo la suya). La primera vez en un
  teléfono hace falta internet.
- Las funciones de fotos piden el pase (con `SAFETY_STRICT=1`).
- Ya no existe el admin de fábrica `admin / admin123`.
- La llave de caputo-cheese vive en Secret Manager (`CAPUTO_SA`), nunca en git.

**Estreno sin riesgo (`NX_TRANSICION = true` en `js/core/auth.js`):** mientras
las reglas sigan abiertas, si el servidor de login no responde se entra como
antes. Así, si algo falla el primer día, nadie se queda afuera.

**Pasos (en orden):**
1. *(Dueño del proyecto)* Firebase → caputo-cheese → Project settings →
   Service accounts → Generate new private key; luego
   `firebase functions:secrets:set CAPUTO_SA --data-file <llave.json> --project envirotrack-5173f`
   y borrar el archivo.
2. Publicar las funciones: `firebase deploy --only functions:safety --project envirotrack-5173f`.
3. Publicar la app (subir `CACHE` en sw.js) y probar en un teléfono.
4. Esperar a que todos los teléfonos tengan la versión nueva (menú → App version).
5. **Cerrar la puerta:** `NX_TRANSICION = false` + publicar la app;
   `cd firestore-safety && firebase deploy --only firestore:rules --project caputo-cheese`;
   `SAFETY_STRICT=1` en `functions/.env` y volver a publicar las funciones.

**Pruebas** (emuladores de Firebase, datos sintéticos): `firestore-safety/tests/`.

---

## Resumen

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| 1 | XSS almacenado en campos de texto libre (producto, comentarios, LOT, razón de hold…) | **Alta** | ✅ Corregido en código |
| 2 | Hash de contraseñas débil (SHA-256 simple, sin iteraciones) | Media | ✅ Corregido (PBKDF2) |
| 3 | Firestore sin autenticación: config pública + posibles reglas abiertas | **Crítica** | 🔧 Corregido en código (nov 2026) — falta cerrar las reglas, ver abajo |
| 4 | Autorización sólo del lado del cliente (roles en JS) | Media | 🔧 Usuarios/roles los hace cumplir Firestore (nov 2026) |
| 5 | Admin por defecto `admin` / `admin123` en dispositivo nuevo | Baja | ✅ Eliminado (nov 2026) |

---

## 1. XSS almacenado — CORREGIDO

**Qué era:** los campos que teclea un operador (descripción de producto,
comentarios, LOT, razón de un hold, acción correctiva, iniciales…) se
insertaban en la página con `innerHTML` sin escapar. Un operador podía guardar
un "nombre de producto" como `<img src=x onerror="...">` y el código corría en
la sesión de **cualquiera** que abriera esa pantalla — incluido un admin. Como
esos campos se sincronizan por Firebase, el ataque llegaba a todos los
dispositivos (XSS almacenado, tipo "gusano").

**Demostrado:** en local, un producto con ese nombre ejecutó código JS al
renderizar la tabla de productos.

**Arreglo:** se añadió `esc()` en `js/core/utils.js` y se escapan todos los
campos de texto libre antes de `innerHTML` en search, catálogo, reportes,
holds, activity, admin, dashboard y el PDF del dashboard. Verificado: el mismo
payload ahora se muestra como texto literal y no ejecuta nada.

---

## 2. Hash de contraseñas — CORREGIDO

**Qué era:** las contraseñas se guardaban como un solo SHA-256. Es demasiado
rápido de calcular: si los hashes se filtran (ver #3), se prueban miles de
millones de combinaciones por segundo.

**Arreglo:** ahora se usa **PBKDF2-SHA256 con 150 000 iteraciones y sal
aleatoria por usuario** (`js/core/auth.js`). Los hashes viejos se siguen
aceptando y se re-hashean automáticamente la próxima vez que el usuario entra,
así que nadie queda fuera. Los usuarios y contraseñas actuales siguen
funcionando igual.

---

## 3. Firestore sin autenticación — CRÍTICO, requiere tu acción

**El problema de fondo:** la app habla con Firestore de forma **anónima**. La
configuración de Firebase es pública (está en el JavaScript del sitio, como en
toda app web — eso es normal). La única barrera real para los datos son las
**reglas de seguridad de Firestore**. Como la app verifica las contraseñas del
lado del cliente, la colección de operadores (con los hashes) tiene que ser
legible por el cliente para poder iniciar sesión — lo que significa que, con
esta arquitectura, **el login no es una barrera de seguridad real**, sólo una
comodidad. Cualquiera con la URL puede, si las reglas están abiertas, leer y
escribir toda la base de datos sin pasar por el login.

**No lo probé en producción a propósito** (sería tráfico contra el Firebase de
Caputo). Compruébalo tú con este comando — si responde `200`, Firestore está
**abierto a lectura sin autenticación**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://firestore.googleapis.com/v1/projects/caputo-cheese/databases/(default)/documents/weights?pageSize=1"
```

### Qué hacer

La solución correcta y definitiva es **añadir Firebase Authentication** y dejar
de verificar contraseñas en el cliente. Es un cambio de fondo; si quieres lo
hacemos por separado.

Como **mitigación inmediata** (no es una cura, pero cierra la puerta a los bots
que rastrean Firebases abiertos), en la consola de Firebase → Firestore →
Reglas, revisa que **no** estén así:

```
// PELIGRO: cualquiera lee y escribe todo
allow read, write: if true;
```

Una regla intermedia razonable mientras se migra a Firebase Auth (exige al
menos sesión anónima y limita el tamaño de los documentos):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Exige que la app haya iniciado sesión anónima (hay que activarla en
    // Authentication → Sign-in method → Anonymous, y llamar signInAnonymously)
    match /{col}/{doc} {
      allow read:  if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.data.size() < 60;
    }
  }
}
```

> Nota honesta: con sesión anónima cualquiera sigue "entrando", así que esto
> frena a los rastreadores automáticos pero no a un atacante decidido. La
> seguridad real de los datos llega sólo con Firebase Auth por usuario. Trátalo
> como el siguiente paso importante.

---

## 4. Autorización del lado del cliente

Los roles (`admin`, `supervisor`, `operator`) se comprueban en JavaScript. Con
la consola del navegador, cualquiera puede hacer `currentUser.role='admin'` y
abrir el panel de Admin. **Demostrado en local.** Esto es inevitable en una app
que corre entera en el navegador: la única forma de hacerlo cumplir de verdad
es que el servidor (las reglas de Firestore + Firebase Auth del punto #3)
rechace lo que un rol no debería poder hacer. Se resuelve junto con #3.

---

## 5. Admin por defecto en dispositivo nuevo

En un navegador nuevo, antes de que sincronice con Firebase, la app crea un
admin local `admin` / `admin123`. Es sólo local (no se sube), y en cuanto
sincroniza, los operadores reales lo reemplazan. Aun así es una credencial
conocida: cuando se migre a Firebase Auth conviene eliminarla. Si algún equipo
ya usó ese admin, cámbiale la contraseña desde el panel de Admin.

---

## Qué quedó cerrado en esta ronda

- XSS almacenado (todas las pantallas y el PDF): **cerrado**.
- Hashes de contraseña: **reforzados** con PBKDF2, sin romper logins existentes.

## Qué queda pendiente (tu decisión)

- Reglas de Firestore (verificar y endurecer): **acción tuya en la consola**.
- Migrar a Firebase Authentication para que el login y los roles sean una
  barrera real: **proyecto aparte**, cuando quieras lo abordamos.
