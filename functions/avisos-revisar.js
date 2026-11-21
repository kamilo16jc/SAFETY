// ===== AVISOS: LA REVISION DEL TURNO (sin Firebase adentro) =====
// La usa safetyReminders (functions/index.js). Va aparte para poder probarla
// sola con datos de mentira: no toca Firestore ni manda nada por su cuenta,
// todo lo trae "io".
const crypto = require("crypto");
const AVISOS = require("./avisos-reglas");
const PLANTA_TZ = "America/Chicago";

// La llave publica sale de la privada: asi no hay un segundo dato que guardar
function vapidPublica(priv) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(String(priv).trim(), "base64url"));
  return ecdh.getPublicKey().toString("base64url");
}

// La hora de la planta (Illinois), sin importar donde corra la funcion
function horaPlanta(d) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: PLANTA_TZ, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d || new Date());
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { fecha: g("year") + "-" + g("month") + "-" + g("day"), min: (+g("hour")) * 60 + (+g("minute")) };
}

// La revision, sin Firestore ni envio adentro: io los trae (asi se prueba sola)
//   io.config() io.subs() io.datos(ctx) io.estado(ctx) io.enviar(sub, aviso)
//   io.olvidar(sub) io.apuntar(ctx, llaves)
async function revisarAvisos(io, ahora) {
  const cfg = AVISOS.config(await io.config());
  const ctx = AVISOS.turnoActual(ahora.fecha, ahora.min, cfg);
  if (!ctx) return { ctx: null, nuevos: [], enviados: 0 };
  const subs = (await io.subs()).filter((s) => s.active !== false && s.sub && s.sub.endpoint &&
    (s.shifts || ["1", "2"]).map(String).indexOf(ctx.shift) >= 0);
  if (!subs.length) return { ctx, nuevos: [], enviados: 0 };
  const items = AVISOS.pendientes(await io.datos(ctx), ctx, cfg);
  const ya = (await io.estado(ctx)) || {};
  const nuevos = items.filter((a) => !ya[a.k]);
  let enviados = 0;
  const idos = {};
  for (const a of nuevos) {
    for (const s of subs) {
      if (idos[s.id] || (s.alerts && s.alerts[a.tipo] === false)) continue;
      const r = await io.enviar(s, { k: a.k, tipo: a.tipo, tag: a.tag, title: a.title, body: a.body, screen: a.screen, mod: a.mod });
      if (r === "gone") { idos[s.id] = true; await io.olvidar(s); } else if (r === "ok") enviados++;
    }
  }
  if (nuevos.length) await io.apuntar(ctx, nuevos.map((a) => a.k));
  return { ctx, nuevos, enviados };
}

module.exports = { revisarAvisos, horaPlanta, vapidPublica };
