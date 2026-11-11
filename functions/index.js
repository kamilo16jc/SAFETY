// ===== NEXORA (SAFETY) — FOTOS DE LA VERIFICACION DE PESO =====
// Grupo de funciones "safety". Viven en el proyecto Firebase de EnviroTrack
// (envirotrack-5173f) porque ese ya tiene el plan Blaze; el de SAFETY
// (caputo-cheese) no lo tiene. Se despliegan solas, sin tocar las de
// EnviroTrack:
//
//   firebase deploy --only functions:safety --project envirotrack-5173f
//
// Por que hacen falta: el navegador no puede leer la respuesta de un flujo de
// Power Automate (no manda cabeceras CORS) y la URL del flujo no puede quedar
// en el codigo publico de GitHub. Estas dos funciones la esconden y revisan lo
// que entra antes de pasarlo a SharePoint:
//
//   safetyPhotoUpload  POST {fileName, contentBase64, meta}  -> flujo que guarda
//   safetyPhotoGet     POST {fileName}                       -> flujo que devuelve
//
// Las URLs de los flujos van en functions/.env (no esta en git):
//   FLOW_SAFETY_PHOTO_UPLOAD=...
//   FLOW_SAFETY_PHOTO_GET=...
// Sin ellas las funciones responden 503 y la app guarda la foto en el telefono
// hasta que haya donde subirla.

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
// La llave de caputo-cheese (Secret Manager): ver "ENTRAR A NEXORA" abajo
const CAPUTO_SA = defineSecret("CAPUTO_SA");

const REGION = "us-central1";

// Solo la app publicada y el servidor de desarrollo local. El navegador hace
// cumplir el CORS; la revision de Origin de abajo frena tambien al que llama
// sin navegador y no se molesta en falsificarlo.
const ORIGINS = [
  "https://kamilo16jc.github.io",
  "http://localhost:8145",
  "http://127.0.0.1:8145",
  "http://localhost:8146",      // copia de diseno (pruebas con los emuladores)
];

const OPTS = {
  region: REGION,
  cors: ORIGINS,
  memory: "256MiB",
  timeoutSeconds: 60,
  maxInstances: 3,          // tope de costo: esto no necesita mas
};
// Las que revisan la sesion necesitan la llave de caputo-cheese
const OPTS_SEG = Object.assign({}, OPTS, { secrets: [CAPUTO_SA] });

// El nombre lo arma la app (W-AAAAMMDD-xxxx.jpg) porque el registro de peso lo
// guarda antes de que haya señal. Aqui solo se acepta si tiene esa forma: nada
// de rutas, extensiones raras ni nombres que pisen otra cosa.
const NOMBRE = /^W-\d{8}-[a-z0-9]{8,24}\.jpg$/;

// Una foto comprimida pesa 100-200 KB. 2 MB de base64 ya es una que no paso
// por la compresion, o algo que no es una foto.
const MAX_B64 = 2 * 1024 * 1024;

// Freno basico por instancia: si alguien encuentra la direccion, no puede
// llenar SharePoint de golpe.
const RITMO = { ventanaMs: 10 * 60 * 1000, max: 60 };
const vistos = new Map();
function demasiadas(ip) {
  const ahora = Date.now();
  const v = vistos.get(ip);
  if (!v || ahora - v.desde > RITMO.ventanaMs) { vistos.set(ip, { desde: ahora, n: 1 }); return false; }
  v.n++;
  return v.n > RITMO.max;
}

function origenValido(req) {
  return ORIGINS.indexOf(String(req.get("origin") || "")) >= 0;
}

async function llamarFlujo(url, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// ---- Subir ----
exports.safetyPhotoUpload = onRequest(OPTS_SEG, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }
  if (!origenValido(req)) { res.status(403).json({ ok: false, error: "origin not allowed" }); return; }
  if (!(await sesionValida(req))) { res.status(401).json({ ok: false, error: "sign in first" }); return; }
  if (demasiadas(req.ip || "?")) { res.status(429).json({ ok: false, error: "too many uploads, try later" }); return; }

  const b = req.body || {};
  const fileName = String(b.fileName || "");
  if (!NOMBRE.test(fileName)) { res.status(400).json({ ok: false, error: "bad file name" }); return; }

  // Solo JPEG de verdad: la app siempre manda JPEG, y en base64 empieza asi
  const b64 = String(b.contentBase64 || "");
  if (!/^\/9j\//.test(b64)) { res.status(400).json({ ok: false, error: "only JPEG photos are accepted" }); return; }
  if (b64.length > MAX_B64) { res.status(413).json({ ok: false, error: "photo too large" }); return; }

  const url = process.env.FLOW_SAFETY_PHOTO_UPLOAD;
  if (!url) { res.status(503).json({ ok: false, error: "not configured" }); return; }

  // Lo que acompaña a la foto va recortado y en texto: el flujo lo puede
  // usar de metadatos, pero nunca decide la ruta ni el nombre.
  const m = b.meta || {};
  const corto = (x, n) => String(x == null ? "" : x).slice(0, n);
  // Por ahora las fotos van a la carpeta y la lista de fotos de EnviroTrack
  // (decision del usuario, 2026-10-16). La etiqueta dice de donde vienen, y
  // NO se manda retestId: EnviroTrack descarta al leer las que no lo traen,
  // asi no le aparecen en sus retests.
  const etiqueta = ["SAFETY weight check",
    m.kind === "bag" ? "Bag LOT" : m.kind === "label" ? "Label" : "",
    m.line ? "Line " + corto(m.line, 10) : "",
    m.lot ? "LOT " + corto(m.lot, 40) : "",
    m.by ? corto(m.by, 60) : ""].filter(Boolean).join(" · ");
  try {
    const r = await llamarFlujo(url, {
      fileName: fileName,
      contentBase64: b64,
      label: etiqueta.slice(0, 200),
      date: corto(m.date, 30),
      line: corto(m.line, 10),
      product: corto(m.product, 40),
      lot: corto(m.lot, 40),
      by: corto(m.by, 60),
      uploadedAt: new Date().toISOString(),
    });
    if (r.ok) { res.status(200).json({ ok: true, fileName: fileName }); return; }
    res.status(502).json({ ok: false, error: "flow returned HTTP " + r.status });
  } catch (e) {
    res.status(502).json({ ok: false, error: "could not reach the flow" });
  }
});

// ---- Ver ----
// La foto se trae por el flujo (con la conexion del dueño), asi se ve para
// todos aunque no tengan sesion de SharePoint en ese equipo.
exports.safetyPhotoGet = onRequest(OPTS_SEG, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }
  if (!origenValido(req)) { res.status(403).json({ ok: false, error: "origin not allowed" }); return; }
  if (!(await sesionValida(req))) { res.status(401).json({ ok: false, error: "sign in first" }); return; }

  const fileName = String((req.body || {}).fileName || "");
  if (!NOMBRE.test(fileName)) { res.status(400).json({ ok: false, error: "bad file name" }); return; }

  const url = process.env.FLOW_SAFETY_PHOTO_GET;
  if (!url) { res.status(503).json({ ok: false, error: "not configured" }); return; }

  try {
    const r = await llamarFlujo(url, { fileName: fileName });
    const text = await r.text();
    // Si el archivo no esta, el flujo falla antes de responder (Power Automate
    // devuelve 502): lo mas probable es que la foto no haya subido todavia.
    if (!r.ok) { res.status(404).json({ ok: false, error: "not found" }); return; }
    // El flujo puede devolver el base64 suelto, entre comillas (JSON) o el
    // contenido del archivo tal cual ({"$content-type":..., "$content":...})
    let c = (text || "").trim();
    if (c[0] === '"' || c[0] === "{") { try { c = JSON.parse(c); } catch (e) { /* se queda como vino */ } }
    if (c && typeof c === "object") c = c.$content || c.content || (c.body && c.body.$content) || "";
    if (!/^\/9j\//.test(String(c))) { res.status(404).json({ ok: false, error: "not found" }); return; }
    res.set("Cache-Control", "private, max-age=86400");
    res.status(200).json({ ok: true, content: c });
  } catch (e) {
    res.status(502).json({ ok: false, error: "could not reach the flow" });
  }
});

// ===== ENTRAR A NEXORA (seguridad, 10 nov 2026) =====
// Antes la app revisaba la contraseña en el telefono y hablaba con Firestore
// de forma anonima: con la direccion de la app cualquiera podia leer y borrar
// toda la base. Ahora la contraseña se revisa AQUI, y si es buena se entrega
// un pase firmado de Firebase (custom token) del proyecto caputo-cheese con el
// numero de operador. Las reglas de Firestore (firestore-safety/firestore.rules)
// solo dejan pasar a quien trae ese pase y tiene su acceso activo en
// access/{operador}, que escribe esta funcion y que el panel de Admin revoca.
//
// La llave de caputo-cheese vive en Secret Manager (CAPUTO_SA), nunca en git:
//   firebase functions:secrets:set CAPUTO_SA --data-file <llave.json> --project envirotrack-5173f
//
//   safetyLogin  POST {username, password} -> {ok, token, me, staff, admin}

const crypto = require("crypto");

let _caputo = null;
function caputo() {
  if (_caputo) return _caputo;
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  const ya = getApps().find((a) => a.name === "caputo");
  if (ya) return (_caputo = ya);
  const opts = { projectId: "caputo-cheese" };
  // En los emuladores no hace falta la llave (y no existe)
  if (!process.env.FUNCTIONS_EMULATOR) opts.credential = cert(JSON.parse(CAPUTO_SA.value()));
  return (_caputo = initializeApp(opts, "caputo"));
}
const fsCaputo = () => require("firebase-admin/firestore").getFirestore(caputo());
const authCaputo = () => require("firebase-admin/auth").getAuth(caputo());

// Hasta cerrar la puerta (SAFETY_STRICT=1 en functions/.env) las fotos siguen
// aceptando a la app vieja, que aun no manda sesion.
async function sesionValida(req) {
  const h = String(req.get("authorization") || "");
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok) return process.env.SAFETY_STRICT !== "1";
  try {
    const d = await authCaputo().verifyIdToken(tok);
    if (!d.op) return false;
    const a = await fsCaputo().doc("access/" + d.op).get();
    return a.exists && a.get("active") === true;
  } catch (e) {
    return false;
  }
}

// ---- La contraseña: los mismos tres esquemas que la app ----
function igual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function pbkdf2Hex(pass, saltHex, iter) {
  return crypto.pbkdf2Sync(Buffer.from(String(pass), "utf8"), Buffer.from(saltHex, "hex"), iter, 32, "sha256").toString("hex");
}
// 'ok' (PBKDF2), 'upgrade' (SHA-256 viejo: se re-guarda), 'pin' (de la era del PIN) o false
function verificar(op, pass) {
  const s = String(op.passHash || "");
  if (s.indexOf("pbkdf2$") === 0) {
    const p = s.split("$");
    const iter = parseInt(p[1], 10);
    if (!(iter >= 1000 && iter <= 2000000) || !/^[0-9a-f]+$/i.test(p[2] || "")) return false;
    return igual(pbkdf2Hex(pass, p[2], iter), p[3]) ? "ok" : false;
  }
  if (s) {
    const h = crypto.createHash("sha256")
      .update(String(op.username || op.name).toLowerCase() + ":" + pass + ":safetyQC", "utf8").digest("hex");
    return igual(h, s) ? "upgrade" : false;
  }
  if (op.pin) return igual(String(pass), String(op.pin)) ? "pin" : false;
  return false;
}
function hashNuevo(pass) {
  const sal = crypto.randomBytes(16).toString("hex"), iter = 150000;
  return "pbkdf2$" + iter + "$" + sal + "$" + pbkdf2Hex(pass, sal, iter);
}

// ¿Administrador? El rol protegido, o quien tiene marcado el panel de Admin
function esAdmin(op, roles) {
  if (op.role === "admin") return true;
  const r = (roles || []).find((x) => x && x.key === op.role) || {};
  const pantallas = (op.screens && op.screens.length) ? op.screens : (r.screens || []);
  return pantallas.some((x) => /(^|:)screen-admin$/.test(String(x)));
}
// Lo que puede viajar a cualquier telefono: sin contraseñas
function publico(op) {
  const o = Object.assign({}, op);
  delete o.passHash; delete o.pin;
  return o;
}

// Freno a la fuerza bruta (por instancia): por direccion y por usuario
const INTENTOS = new Map();
function bloqueado(clave, max, ventanaMs) {
  const v = INTENTOS.get(clave);
  return !!(v && Date.now() - v.desde < ventanaMs && v.n >= max);
}
function fallo(clave, ventanaMs) {
  const ahora = Date.now(), v = INTENTOS.get(clave);
  if (!v || ahora - v.desde > ventanaMs) INTENTOS.set(clave, { desde: ahora, n: 1 });
  else v.n++;
}

exports.safetyLogin = onRequest(Object.assign({}, OPTS_SEG, { memory: "512MiB" }), async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }
  if (!origenValido(req)) { res.status(403).json({ ok: false, error: "origin not allowed" }); return; }
  const b = req.body || {};
  const id = String(b.username || "").trim().toLowerCase().slice(0, 120);
  const pass = String(b.password || "").slice(0, 200);
  if (!id || !pass) { res.status(400).json({ ok: false, error: "missing" }); return; }

  const ip = "ip:" + (req.ip || "?"), us = "u:" + id;
  if (bloqueado(ip, 30, 10 * 60000) || bloqueado(us, 8, 15 * 60000)) {
    res.status(429).json({ ok: false, error: "too many attempts" }); return;
  }
  try {
    const fs = fsCaputo();
    const [opsDoc, rolesDoc] = await Promise.all([fs.doc("config/operators").get(), fs.doc("config/roles").get()]);
    const ops = (opsDoc.exists && opsDoc.get("list")) || [];
    const roles = (rolesDoc.exists && rolesDoc.get("list")) || [];
    const op = ops.find((o) => o && ((o.username && String(o.username).toLowerCase() === id) ||
                                     (o.email && String(o.email).toLowerCase() === id) ||
                                     (o.name && String(o.name).toLowerCase() === id)));
    const r = op ? verificar(op, pass) : false;
    if (!op || !r) {
      fallo(ip, 10 * 60000); fallo(us, 15 * 60000);
      res.status(401).json({ ok: false, error: "wrong" }); return;
    }
    INTENTOS.delete(us);
    const opId = String(op.id);
    const admin = esAdmin(op, roles);

    // El hash viejo se re-guarda con PBKDF2 (la app ya no puede: la lista de
    // usuarios solo la escribe el administrador)
    if (r === "upgrade") {
      const nh = hashNuevo(pass);
      await fs.runTransaction(async (t) => {
        const d = await t.get(fs.doc("config/operators"));
        const l = (d.exists && d.get("list")) || [];
        const x = l.find((o) => o && String(o.id) === opId);
        if (!x) return;
        x.passHash = nh;
        t.set(fs.doc("config/operators"), { list: l, updatedAt: new Date().toISOString() }, { merge: true });
      });
      op.passHash = nh;
    }

    // El acceso: lo que miran las reglas en cada lectura y escritura
    await fs.doc("access/" + opId).set({
      active: true, admin: admin, role: String(op.role || ""), name: String(op.name || ""),
      at: new Date().toISOString(),
    });
    const token = await authCaputo().createCustomToken("op-" + opId, { op: opId, admin: admin });

    // Para entrar sin señal la proxima vez en este telefono: SOLO su propia
    // credencial. La lista de usuarios va sin contraseñas.
    const me = publico(op);
    me.cred = { passHash: op.passHash || "", pin: op.passHash ? "" : String(op.pin || "") };
    res.status(200).json({ ok: true, token: token, admin: admin, me: me, staff: ops.filter(Boolean).map(publico) });
  } catch (e) {
    console.error("safetyLogin", e && e.message);
    res.status(503).json({ ok: false, error: "login unavailable" });
  }
});
