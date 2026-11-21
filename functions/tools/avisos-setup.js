// ===== AVISOS EN EL TELEFONO: LA LLAVE Y EL DESPLIEGUE (una sola vez) =====
// Lo corre el usuario UNA vez, desde la carpeta que despliega las funciones
// (C:\Users\Julic\nexora-local, la que tiene functions/.env):
//
//   node functions/tools/avisos-setup.js
//
// 1) Crea la llave VAPID con la que el servidor firma las notificaciones.
// 2) Guarda la parte privada en Secret Manager de envirotrack-5173f como
//    SAFETY_VAPID_PRIVATE. No se muestra en pantalla ni se escribe en disco:
//    va directo de este programa a la CLI de Firebase.
// 3) Despliega las funciones "safety" (safetyReminders y safetyPushKey nuevas;
//    las de siempre igual que estaban).
//
// Si la llave ya existe NO se cambia (cambiarla deja sin avisos a todos los
// telefonos ya anotados hasta que los vuelvan a prender): solo despliega.
// Para una llave nueva a proposito: node functions/tools/avisos-setup.js --nueva
const { spawnSync } = require("child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const PROYECTO = "envirotrack-5173f";
const SECRETO = "SAFETY_VAPID_PRIVATE";
const fb = process.platform === "win32" ? "firebase.cmd" : "firebase";
const correr = (args, extra) => spawnSync(fb, args, Object.assign({ cwd: RAIZ, shell: true }, extra || {}));

let webpush;
try { webpush = require(path.join(RAIZ, "functions", "node_modules", "web-push")); }
catch (e) {
  console.error("Falta web-push. Corre primero:  cd functions  y luego  npm install");
  process.exit(1);
}

const existe = correr(["functions:secrets:get", SECRETO, "--project", PROYECTO], { stdio: "pipe" }).status === 0;
if (existe && process.argv.indexOf("--nueva") < 0) {
  console.log("La llave " + SECRETO + " ya existe: no se cambia.");
} else {
  const k = webpush.generateVAPIDKeys();
  const r = correr(["functions:secrets:set", SECRETO, "--project", PROYECTO, "--data-file", "-"],
    { input: k.privateKey, stdio: ["pipe", "inherit", "inherit"] });
  if (r.status !== 0) { console.error("\nNo se pudo guardar la llave. No se desplego nada."); process.exit(1); }
  console.log("\nLlave guardada en Secret Manager (" + SECRETO + ").");
}

console.log("\nDesplegando las funciones safety...\n");
const d = correr(["deploy", "--only", "functions:safety", "--project", PROYECTO], { stdio: "inherit" });
if (d.status !== 0) { console.error("\nEl despliegue fallo. Mandale a Claude lo que salio arriba."); process.exit(1); }
console.log("\nListo. Los telefonos ya pueden prender los avisos (menu del usuario > Notifications).");
