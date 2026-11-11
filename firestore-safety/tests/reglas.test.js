// Pruebas de firestore-safety/firestore.rules en el emulador (proyecto demo).
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } = require('firebase/firestore');

const RULES = process.argv[2];
let pasa = 0, falla = 0;
async function caso(nombre, p, debe) {
  try {
    if (debe) await assertSucceeds(p); else await assertFails(p);
    pasa++; console.log('OK ', nombre);
  } catch (e) { falla++; console.log('MAL', nombre, '->', e && e.message ? e.message.split('\n')[0] : e); }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-caputo',
    firestore: { rules: fs.readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8085 },
  });
  // Datos de partida (sin reglas)
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'weights/w1'), { lot: '26314' });
    await setDoc(doc(db, 'config/operators'), { list: [{ id: 1, passHash: 'x' }] });
    await setDoc(doc(db, 'config/roles'), { list: [{ key: 'admin' }] });
    await setDoc(doc(db, 'config/customers'), { list: [] });
    await setDoc(doc(db, 'access/100'), { active: true, admin: false });
    await setDoc(doc(db, 'access/200'), { active: true, admin: true });
    await setDoc(doc(db, 'access/300'), { active: false, admin: false });
    await setDoc(doc(db, 'reader/100'), { events: [] });
    await setDoc(doc(db, 'reader/200'), { events: [] });
  });
  const nadie = env.unauthenticatedContext().firestore();
  const anonimo = env.authenticatedContext('anon-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const oper = env.authenticatedContext('op-100', { op: '100' }).firestore();
  const adm = env.authenticatedContext('op-200', { op: '200', admin: true }).firestore();
  const quitado = env.authenticatedContext('op-300', { op: '300' }).firestore();
  const sinAcceso = env.authenticatedContext('op-999', { op: '999' }).firestore();
  const falsoAdmin = env.authenticatedContext('op-100', { op: '100', admin: true }).firestore();   // se pone admin en el pase: no basta

  console.log('-- sin pase');
  await caso('sin sesion no lee pesos', getDoc(doc(nadie, 'weights/w1')), false);
  await caso('sesion anonima (la de antes) no lee pesos', getDoc(doc(anonimo, 'weights/w1')), false);
  await caso('sesion anonima no escribe', setDoc(doc(anonimo, 'weights/w2'), { a: 1 }), false);
  await caso('sesion anonima no lee clientes', getDoc(doc(anonimo, 'config/customers')), false);
  console.log('-- usuario normal activo');
  await caso('lee pesos', getDoc(doc(oper, 'weights/w1')), true);
  await caso('lista una coleccion', getDocs(collection(oper, 'weights')), true);
  await caso('escribe un peso', setDoc(doc(oper, 'weights/w3'), { lot: '26315' }), true);
  await caso('borra un registro', deleteDoc(doc(oper, 'weights/w3')), true);
  await caso('lee clientes', getDoc(doc(oper, 'config/customers')), true);
  await caso('escribe clientes (pantalla Customers)', setDoc(doc(oper, 'config/customers'), { list: [1] }), true);
  await caso('lee roles', getDoc(doc(oper, 'config/roles')), true);
  await caso('NO lee usuarios/contraseñas', getDoc(doc(oper, 'config/operators')), false);
  await caso('NO escribe usuarios', setDoc(doc(oper, 'config/operators'), { list: [] }), false);
  await caso('NO escribe roles', setDoc(doc(oper, 'config/roles'), { list: [] }), false);
  await caso('NO se da acceso a si mismo', setDoc(doc(oper, 'access/100'), { active: true, admin: true }), false);
  await caso('NO cambia su acceso a admin', updateDoc(doc(oper, 'access/100'), { admin: true }), false);
  await caso('lee su acceso', getDoc(doc(oper, 'access/100')), true);
  await caso('NO lee el acceso de otro', getDoc(doc(oper, 'access/200')), false);
  await caso('su canal del lector', setDoc(doc(oper, 'reader/100'), { events: [1] }), true);
  await caso('NO el canal de otro', getDoc(doc(oper, 'reader/200')), false);
  await caso('pase con admin falso NO lee usuarios', getDoc(doc(falsoAdmin, 'config/operators')), false);
  await caso('subcoleccion: denegada', setDoc(doc(oper, 'weights/w1/x/y'), { a: 1 }), false);
  console.log('-- administrador');
  await caso('lee usuarios', getDoc(doc(adm, 'config/operators')), true);
  await caso('escribe usuarios', setDoc(doc(adm, 'config/operators'), { list: [{ id: 1 }] }), true);
  await caso('escribe roles', setDoc(doc(adm, 'config/roles'), { list: [{ key: 'admin' }] }), true);
  await caso('quita el acceso de alguien', deleteDoc(doc(adm, 'access/100')), true);
  await caso('NO crea accesos (solo el login)', setDoc(doc(adm, 'access/555'), { active: true }), false);
  console.log('-- acceso quitado / sin acceso');
  await caso('acceso desactivado no lee', getDoc(doc(quitado, 'weights/w1')), false);
  await caso('sin documento de acceso no lee', getDoc(doc(sinAcceso, 'weights/w1')), false);
  await caso('al que se le quito el acceso ya no lee', getDoc(doc(oper, 'weights/w1')), false);
  await env.cleanup();
  console.log('PASAN', pasa, '· FALLAN', falla);
  process.exit(falla ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
