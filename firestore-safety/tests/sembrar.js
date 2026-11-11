// Datos de PRUEBA en el emulador (nunca en produccion): usuarios con contraseñas
// en los tres esquemas de la app, roles y unos registros.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
const crypto = require('crypto');
const { initializeApp } = require('./functions/node_modules/firebase-admin/lib/app');
const { getFirestore } = require('./functions/node_modules/firebase-admin/lib/firestore');
const app = initializeApp({ projectId: 'caputo-cheese' }, 'sembrar');
const db = getFirestore(app);
const pb = (p) => { const s = crypto.randomBytes(16).toString('hex'); return 'pbkdf2$150000$' + s + '$' + crypto.pbkdf2Sync(p, Buffer.from(s, 'hex'), 150000, 32, 'sha256').toString('hex'); };
const viejo = (u, p) => crypto.createHash('sha256').update(u.toLowerCase() + ':' + p + ':safetyQC').digest('hex');
(async () => {
  await db.doc('config/roles').set({ list: [
    { key: 'admin', name: 'Administrator', protected: true, screens: ['admin:screen-admin', 'qa:screen-weight', 'lab:screen-analysis'] },
    { key: 'operator', name: 'Operator', screens: ['qa:screen-weight', 'lab:screen-analysis'] } ] });
  await db.doc('config/operators').set({ list: [
    { id: 1001, name: 'Ana Ruiz', username: 'ana', email: '', role: 'operator', passHash: pb('clave123') },
    { id: 1002, name: 'Jefe QA', username: 'jefe', email: '', role: 'admin', passHash: pb('admin456') },
    { id: 1003, name: 'Viejo Hash', username: 'viejo', email: '', role: 'operator', passHash: viejo('viejo', 'antigua1') },
    { id: 1004, name: 'Pin Ero', username: 'pinero', email: '', role: 'operator', pin: '4321' } ] });
  await db.doc('config/customers').set({ list: [] });
  const hoy = new Date(); const f = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  await db.doc('weights/emu-1').set({ id: 777001, date: f + 'T08:00:00', line: 1, shift: 1, product: 'EMU-1', lot: '26314', total: 5, pass: 5 });
  console.log('sembrado', f);
})().catch(e => { console.error(e); process.exit(1); });
