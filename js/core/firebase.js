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

  // ============================================================
  //  SYNC EN TIEMPO REAL — solo la ventana reciente en vivo.
  //  Antes se descargaban TODOS los registros al abrir y cada 60s
  //  (~2000 docs por sync). Ahora onSnapshot trae la ventana una vez
  //  y luego solo los cambios. El historial mas viejo se carga bajo
  //  demanda (Dashboard "all time" / Search por fecha antigua).
  // ============================================================
  var WINDOW_DAYS = 90;
  // Fecha-solo (YYYY-MM-DD): así compara bien contra registros con fecha ISO
  // completa (weights/seals) y con fecha-solo (gmps/temps).
  function windowStartISO(){
    var d = new Date(); d.setDate(d.getDate() - WINDOW_DAYS);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function daysAgoISO(n){ var d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }

  var historyLoadedFrom = null;   // hasta donde atras esta cargado el historial
  var listenersUp = false;
  var BIG_COLS   = ['weights','seals','gmps','temps','metal'];  // por fecha (ventana)
  var SMALL_COLS = ['products','holds','capa','shifts'];        // coleccion completa

  // Reconstruye una coleccion grande: la ventana en vivo + el historial ya
  // cargado (mas viejo que la ventana) + lo creado offline (sin _fbId).
  function replaceBig(col, snap){
    var ldb = getDB();
    var ws = windowStartISO();
    var remote = snap.docs.map(function(d){ var x=d.data(); x._fbId=d.id; return x; });
    var rids = {}; remote.forEach(function(x){ if(x && x.id!=null) rids[x.id]=1; });
    var keep = (ldb[col]||[]).filter(function(r){
      if(!r) return false;
      if(r.id!=null && rids[r.id]) return false;  // ya está en remote (recién subido)
      if(!r._fbId) return true;             // creado offline, pendiente de subir
      return String(r.date||'') < ws;       // historial anterior a la ventana
    });
    ldb[col] = remote.concat(keep);
    saveDB(ldb);
  }
  // Coleccion pequena completa + lo creado offline.
  function replaceSmall(col, snap){
    var ldb = getDB();
    var remote = snap.docs.map(function(d){ var x=d.data(); x._fbId=d.id; return x; });
    var rids = {}; remote.forEach(function(x){ if(x && x.id!=null) rids[x.id]=1; });
    var keep = (ldb[col]||[]).filter(function(r){ return r && !r._fbId && !(r.id!=null && rids[r.id]); });
    ldb[col] = remote.concat(keep);
    saveDB(ldb);
  }

  function onSyncOk(){ showSyncStatus('Synced'); setTimeout(hideSyncStatus, 1500); }
  function onSyncErr(e){ showSyncStatus('Offline'); setTimeout(hideSyncStatus, 2500); if(e) console.error('Sync error:', e && e.code); }

  function setupRealtime(){
    if(listenersUp) return;
    listenersUp = true;
    historyLoadedFrom = windowStartISO();
    showSyncStatus('Syncing...');
    var ws = windowStartISO();

    BIG_COLS.forEach(function(col){
      onSnapshot(query(collection(db,col), where('date','>=', ws), orderBy('date','asc')),
        function(snap){ replaceBig(col, snap); onSyncOk(); flushSoon(); }, onSyncErr);
    });
    SMALL_COLS.forEach(function(col){
      onSnapshot(collection(db,col),
        function(snap){ replaceSmall(col, snap); onSyncOk(); flushSoon(); }, onSyncErr);
    });
    // Areas y operadores (documentos de config)
    onSnapshot(doc(db,'config','areas'), function(d){
      if(d.exists()){ var list=d.data().list||[]; if(list.length){ var ldb=getDB(); ldb.areas=list; saveDB(ldb); } }
    }, function(){});
    onSnapshot(doc(db,'config','operators'), function(d){
      if(d.exists()){ var list=d.data().list||[]; if(list.length){ var ldb=getDB(); ldb.operators=list; saveDB(ldb); } }
      if(window.initLogin) window.initLogin();
    }, function(){ if(window.initLogin) window.initLogin(); });
    // Activity log: solo lo reciente (2 dias) para el home; el resto lo carga
    // la pantalla de Activity con sus propios cargadores.
    onSnapshot(query(collection(db,'activityLog'), where('date','>=', daysAgoISO(2)), orderBy('date','asc')),
      function(snap){
        var ldb=getDB();
        var cut = daysAgoISO(2);
        var older  = (ldb.activityLog||[]).filter(function(l){ return String(l.date||'') < cut; });
        var merged = older.concat(snap.docs.map(function(d){ return d.data(); }));
        var seen={}; ldb.activityLog = merged.filter(function(l){ if(seen[l.id]) return false; seen[l.id]=true; return true; });
        saveDB(ldb);
      }, function(){});
  }

  // ---- Carga bajo demanda del historial anterior a la ventana ----
  window.loadHistory = async function(fromISO, cb){
    try {
      if(!fromISO) fromISO = '1970-01-01';
      var upper = historyLoadedFrom || windowStartISO();
      if(fromISO >= upper){ if(cb) cb(); return; }   // ya esta cargado
      showSyncStatus('Loading history...');
      var ldb = getDB();
      for(var i=0;i<BIG_COLS.length;i++){
        var col = BIG_COLS[i];
        var snap = await getDocs(query(collection(db,col),
          where('date','>=', fromISO), where('date','<', upper), orderBy('date','asc')));
        var have = {}; (ldb[col]||[]).forEach(function(r){ if(r._fbId) have[r._fbId]=true; });
        var add = snap.docs.map(function(d){ var x=d.data(); x._fbId=d.id; return x; })
                      .filter(function(x){ return !have[x._fbId]; });
        ldb[col] = (ldb[col]||[]).concat(add);
      }
      historyLoadedFrom = fromISO;
      if(fromISO <= '1970-01-02') window._historyFull = true;
      saveDB(ldb);
      hideSyncStatus();
    } catch(e){ console.error('Load history error:', e); }
    if(cb) cb();
  };
  window.isHistoryFull = function(){ return !!window._historyFull; };

  // ---- FLUSH: sube a Firestore los registros creados offline (sin _fbId) ----
  var flushing = false, flushTimer = null;
  function flushSoon(){ if(flushTimer) return; flushTimer = setTimeout(function(){ flushTimer=null; flushPending(); }, 1500); }
  async function flushPending(){
    if(flushing) return;
    flushing = true;
    try {
      var localDb = getDB();
      var cols = ['weights','seals','gmps','temps','metal','capa','shifts','products'];
      var uploaded = {};   // {col: {recId: fbId}}
      for(var ci=0; ci<cols.length; ci++){
        var arr = localDb[cols[ci]] || [];
        for(var i=0; i<arr.length; i++){
          var rec = arr[i];
          if(rec && !rec._fbId){
            try {
              var payload = Object.assign({}, rec); delete payload._fbId;
              var ref = await addDoc(collection(db, cols[ci]), payload);
              if(!uploaded[cols[ci]]) uploaded[cols[ci]] = {};
              uploaded[cols[ci]][rec.id] = ref.id;
            } catch(e){ /* sigue offline: se reintenta luego */ }
          }
        }
      }
      // Holds: reescritura completa si alguno quedó sin subir
      var holds = localDb.holds || [];
      if(holds.some(function(h){ return h && !h._fbId; }) && window.saveHoldsToFirebase){
        try { await window.saveHoldsToFirebase(holds); } catch(e){}
      }
      // Relee fresco (los listeners pueden haber cambiado otras colecciones) y
      // solo marca los _fbId de lo que se subió.
      if(Object.keys(uploaded).length){
        var fresh = getDB();
        Object.keys(uploaded).forEach(function(col){
          (fresh[col]||[]).forEach(function(r){
            if(r && !r._fbId && uploaded[col][r.id]) r._fbId = uploaded[col][r.id];
          });
        });
        saveDB(fresh);
      }
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

  // Arranca los listeners en tiempo real cuando la sesión anónima esté lista.
  // Ya no hay polling cada 60s: onSnapshot trae solo los cambios.
  authReady.then(function(){
    setupRealtime();
  });
  window.addEventListener('online', function(){ flushPending(); });
