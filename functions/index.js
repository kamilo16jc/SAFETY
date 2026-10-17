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

const REGION = "us-central1";

// Solo la app publicada y el servidor de desarrollo local. El navegador hace
// cumplir el CORS; la revision de Origin de abajo frena tambien al que llama
// sin navegador y no se molesta en falsificarlo.
const ORIGINS = [
  "https://kamilo16jc.github.io",
  "http://localhost:8145",
  "http://127.0.0.1:8145",
];

const OPTS = {
  region: REGION,
  cors: ORIGINS,
  memory: "256MiB",
  timeoutSeconds: 60,
  maxInstances: 3,          // tope de costo: esto no necesita mas
};

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
exports.safetyPhotoUpload = onRequest(OPTS, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }
  if (!origenValido(req)) { res.status(403).json({ ok: false, error: "origin not allowed" }); return; }
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
  try {
    const r = await llamarFlujo(url, {
      fileName: fileName,
      contentBase64: b64,
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
exports.safetyPhotoGet = onRequest(OPTS, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }
  if (!origenValido(req)) { res.status(403).json({ ok: false, error: "origin not allowed" }); return; }

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
