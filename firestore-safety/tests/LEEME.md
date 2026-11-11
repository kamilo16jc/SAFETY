# Pruebas de seguridad (emuladores de Firebase, datos sintéticos)

Nada de esto toca producción. Hace falta Java (emulador de Firestore) y
`firebase-tools`.

1. **Reglas** (30 casos): en una carpeta aparte
   `npm install @firebase/rules-unit-testing@4 firebase@11`, y desde `firestore-safety/`:
   `firebase emulators:exec --only firestore --project demo-caputo "node tests/reglas.test.js firestore.rules"`
2. **Login de punta a punta** (24 casos): emuladores Auth + Firestore + Functions
   con el proyecto `caputo-cheese` (las funciones de `functions/`, un
   `functions/.secret.local` con `CAPUTO_SA={}`), `node tests/sembrar.js`
   (usuarios de prueba), el servidor de diseño en 8146 y
   `python -I tests/login_prueba.py` (abre `http://localhost:8146/?emu`).
3. **Estreno**: con las reglas abiertas de antes y el login caído,
   `python -I tests/transicion_prueba.py` (se entra como antes).
