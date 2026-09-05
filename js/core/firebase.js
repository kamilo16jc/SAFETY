  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, where, onSnapshot, deleteField, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyD2QOrY7TyeYCcHE14hXoQ3nCsC4nozL-8",
    authDomain: "caputo-cheese.firebaseapp.com",
    projectId: "caputo-cheese",
    storageBucket: "caputo-cheese.firebasestorage.app",
    messagingSenderId: "20561008857",
    appId: "1:20561008857:web:cc24df6e99c5d893af86c8"
  };

  const app  = initializeApp(firebaseConfig);
  const db   = getFirestore(app);
  const auth = getAuth(app);

  // Sesión anónima: cuando las reglas exijan request.auth != null, la app ya
  // llega con una sesión. Es tolerante a fallos — si Anonymous Auth todavía no
  // está habilitado, se registra el error pero la app no se bloquea.
  var authReady = new Promise(function(resolve){
    var done = false;
    var finish = function(){ if(!done){ done = true; resolve(); } };
    onAuthStateChanged(auth, function(user){ if(user) finish(); });
    signInAnonymously(auth).catch(function(e){
      console.warn('Anonymous sign-in unavailable:', e && e.code);
      finish(); // no bloquear la app aunque falle
    });
    setTimeout(finish, 4000); // red de seguridad
  });

  // Conserva los registros creados sin señal (aún sin _fbId): así el sync no
  // los borra al traer la copia de Firestore. Se suben con flushPending().
  function mergePending(remote, local){
    var pend = (local||[]).filter(function(r){ return r && !r._fbId; });
    return remote.concat(pend);
  }

  // ---- SYNC: load all data from Firestore into localStorage on start ----
  async function syncFromFirebase() {
    try {
      showSyncStatus('Syncing...');
      var localDb = getDB();

      // Weights
      var wSnap = await getDocs(query(collection(db,'weights'), orderBy('date','asc')));
      localDb.weights = mergePending(wSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.weights);

      // Seals
      var sSnap = await getDocs(query(collection(db,'seals'), orderBy('date','asc')));
      localDb.seals = mergePending(sSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.seals);

      // GMPs
      var gSnap = await getDocs(query(collection(db,'gmps'), orderBy('date','asc')));
      localDb.gmps = mergePending(gSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.gmps);

      // Temps
      try {
        var tSnap = await getDocs(query(collection(db,'temps'), orderBy('date','asc')));
        localDb.temps = mergePending(tSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.temps);
      } catch(e) { localDb.temps = localDb.temps||[]; }

      // Metal detector checks
      try {
        var mSnap = await getDocs(query(collection(db,'metal'), orderBy('date','asc')));
        localDb.metal = mergePending(mSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.metal);
      } catch(e) { localDb.metal = localDb.metal||[]; }

      // CAPA / incident reports
      try {
        var cSnap = await getDocs(collection(db,'capa'));
        localDb.capa = mergePending(cSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.capa);
      } catch(e) { localDb.capa = localDb.capa||[]; }

      // Shift reports
      try {
        var srSnap = await getDocs(collection(db,'shifts'));
        localDb.shifts = mergePending(srSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.shifts);
      } catch(e) { localDb.shifts = localDb.shifts||[]; }

      // Areas (config doc)
      try {
        var arDoc = await getDoc(doc(db,'config','areas'));
        if(arDoc.exists() && (arDoc.data().list||[]).length) localDb.areas = arDoc.data().list;
      } catch(e) {}

      // Product catalog
      try {
        var pSnap = await getDocs(collection(db,'products'));
        localDb.products = mergePending(pSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.products);
      } catch(e) { localDb.products = localDb.products||[]; }

      // Holds
      try {
        var hSnap = await getDocs(collection(db,'holds'));
        localDb.holds = mergePending(hSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; }), localDb.holds);
      } catch(e) {}

      // Activity Log - last 7 days only
      try {
        var sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        var aSnap = await getDocs(query(
          collection(db,'activityLog'),
          orderBy('date','asc'),
          where('date','>=', sevenDaysAgo.toISOString())
        ));
        if(!aSnap.empty) localDb.activityLog = aSnap.docs.map(function(d){ return d.data(); });
      } catch(e) {}

      // Operators — stored as single document for easy sync
      try {
        var opDoc = await getDoc(doc(db,'config','operators'));
        if(opDoc.exists()) {
          var remoteOps = opDoc.data().list || [];
          if(remoteOps.length > 0) localDb.operators = remoteOps;
        }
      } catch(e) {}

      saveDB(localDb);
      showSyncStatus('Synced');
      setTimeout(function(){ hideSyncStatus(); }, 2000);
      if(window.initLogin) window.initLogin();
      flushPending();   // sube lo que se creó sin señal
    } catch(e) {
      showSyncStatus('Offline');
      setTimeout(function(){ hideSyncStatus(); }, 3000);
      console.error('Sync error:', e);
    }
  }

  // ---- FLUSH: sube a Firestore los registros creados offline (sin _fbId) ----
  var flushing = false;
  async function flushPending(){
    if(flushing) return;
    flushing = true;
    try {
      var localDb = getDB();
      var cols = ['weights','seals','gmps','temps','metal','capa','shifts','products'];
      var changed = false;
      for(var ci=0; ci<cols.length; ci++){
        var arr = localDb[cols[ci]] || [];
        for(var i=0; i<arr.length; i++){
          var rec = arr[i];
          if(rec && !rec._fbId){
            try {
              var payload = Object.assign({}, rec); delete payload._fbId;
              var ref = await addDoc(collection(db, cols[ci]), payload);
              rec._fbId = ref.id; changed = true;
            } catch(e){ /* sigue offline: se reintenta en el próximo sync */ }
          }
        }
      }
      // Holds: reescritura completa si alguno quedó sin subir
      var holds = localDb.holds || [];
      if(holds.some(function(h){ return h && !h._fbId; }) && window.saveHoldsToFirebase){
        try { await window.saveHoldsToFirebase(holds); } catch(e){}
      }
      if(changed) saveDB(localDb);
    } finally { flushing = false; }
  }

  // ---- SAVE to Firestore ----
  window.saveToFirebase = async function(colName, record) {
    try {
      var docRef = await addDoc(collection(db, colName), record);
      var localDb = getDB();
      var arr = localDb[colName] || [];
      var last = arr[arr.length - 1];
      if(last) last._fbId = docRef.id;
      saveDB(localDb);
    } catch(e) {
      console.error('Firebase save error:', e);
    }
  };

  // ---- OVERWRITE an existing doc in place (corrección sin duplicar) ----
  window.saveToFirebaseAt = async function(colName, fbId, record) {
    try {
      var payload = Object.assign({}, record);
      delete payload._fbId;
      await setDoc(doc(db, colName, fbId), payload);
    } catch(e) {
      console.error('Firebase overwrite error:', e);
    }
  };

  // ---- DELETE a single doc ----
  window.deleteFromFirebase = async function(colName, fbId) {
    try {
      await deleteDoc(doc(db, colName, fbId));
    } catch(e) {
      console.error('Firebase delete error:', e);
    }
  };

  // ---- SAVE ALL HOLDS to Firestore (overwrite entire collection) ----
  window.saveHoldsToFirebase = async function(holds) {
    try {
      // Delete all existing hold docs then rewrite
      var snap = await getDocs(collection(db,'holds'));
      var batch = writeBatch(db);
      snap.docs.forEach(function(d){ batch.delete(d.ref); });
      holds.forEach(function(h){
        var ref = doc(collection(db,'holds'));
        batch.set(ref, h);
      });
      await batch.commit();
    } catch(e) {
      console.error('Save holds error:', e);
    }
  };

  // ---- SAVE ACTIVITY LOG to Firestore ----
  window.saveActivityToFirebase = async function(entry) {
    try {
      await addDoc(collection(db,'activityLog'), entry);
    } catch(e) {
      console.error('Save activity error:', e);
    }
  };

  // ---- LOAD ACTIVITY LOG (N days back) ----
  window._fbLoadActivity = async function(days, callback) {
    try {
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      var aSnap = await getDocs(query(
        collection(db,'activityLog'),
        orderBy('date','asc'),
        where('date','>=', cutoff.toISOString())
      ));
      var localDb = getDB();
      if(!aSnap.empty) localDb.activityLog = aSnap.docs.map(function(d){ return d.data(); });
      saveDB(localDb);
    } catch(e) { console.error('Load activity error:', e); }
    if(callback) callback();
  };

  // ---- LOAD ACTIVITY LOG for specific date range ----
  window._fbLoadActivityRange = async function(start, end, callback) {
    try {
      var aSnap = await getDocs(query(
        collection(db,'activityLog'),
        orderBy('date','asc'),
        where('date','>=', start.toISOString()),
        where('date','<=', end.toISOString())
      ));
      var localDb = getDB();
      // Merge with existing logs (don't overwrite)
      var existing = localDb.activityLog || [];
      var newLogs   = aSnap.docs.map(function(d){ return d.data(); });
      // Combine and deduplicate by id
      var merged = existing.concat(newLogs);
      var seen   = {};
      localDb.activityLog = merged.filter(function(l){
        if(seen[l.id]) return false;
        seen[l.id] = true; return true;
      });
      saveDB(localDb);
    } catch(e) { console.error('Load activity range error:', e); }
    if(callback) callback();
  };

  // ---- SAVE AREAS to Firestore ----
  window.saveAreasToFirebase = async function(list) {
    try {
      await setDoc(doc(db,'config','areas'), {list: list, updatedAt: new Date().toISOString()});
    } catch(e) {
      console.error('Save areas error:', e);
    }
  };

  // ---- SAVE OPERATORS to Firestore ----
  window.saveOperatorsToFirebase = async function(ops) {
    try {
      await setDoc(doc(db,'config','operators'), {list: ops, updatedAt: new Date().toISOString()});
    } catch(e) {
      console.error('Save operators error:', e);
    }
  };

  // ---- CLEAR Firestore ----
  window.clearFirebase = async function() {
    try {
      var batch = writeBatch(db);
      for(var col of ['weights','seals','gmps','temps']) {
        var snap = await getDocs(collection(db, col));
        snap.docs.forEach(function(d){ batch.delete(d.ref); });
      }
      await batch.commit();
    } catch(e) {
      console.error('Firebase clear error:', e);
    }
  };

  // Run sync on load — después de que la sesión anónima esté lista
  authReady.then(function(){
    syncFromFirebase();
    setInterval(syncFromFirebase, 60000);
  });
