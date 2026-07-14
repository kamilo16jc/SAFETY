  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, query, orderBy, where, onSnapshot, deleteField, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyD2QOrY7TyeYCcHE14hXoQ3nCsC4nozL-8",
    authDomain: "caputo-cheese.firebaseapp.com",
    projectId: "caputo-cheese",
    storageBucket: "caputo-cheese.firebasestorage.app",
    messagingSenderId: "20561008857",
    appId: "1:20561008857:web:cc24df6e99c5d893af86c8"
  };

  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  // ---- SYNC: load all data from Firestore into localStorage on start ----
  async function syncFromFirebase() {
    try {
      showSyncStatus('Syncing...');
      var localDb = getDB();

      // Weights
      var wSnap = await getDocs(query(collection(db,'weights'), orderBy('date','asc')));
      localDb.weights = wSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; });

      // Seals
      var sSnap = await getDocs(query(collection(db,'seals'), orderBy('date','asc')));
      localDb.seals = sSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; });

      // GMPs
      var gSnap = await getDocs(query(collection(db,'gmps'), orderBy('date','asc')));
      localDb.gmps = gSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; });

      // Temps
      try {
        var tSnap = await getDocs(query(collection(db,'temps'), orderBy('date','asc')));
        localDb.temps = tSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; });
      } catch(e) { localDb.temps = localDb.temps||[]; }

      // Holds
      try {
        var hSnap = await getDocs(collection(db,'holds'));
        if(!hSnap.empty) localDb.holds = hSnap.docs.map(function(d){ var data=d.data(); data._fbId=d.id; return data; });
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
      showSyncStatus('✓ Synced');
      setTimeout(function(){ hideSyncStatus(); }, 2000);
      if(window.initLogin) window.initLogin();
    } catch(e) {
      showSyncStatus('⚠ Offline');
      setTimeout(function(){ hideSyncStatus(); }, 3000);
      console.error('Sync error:', e);
    }
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

  // Run sync on load
  syncFromFirebase();
  // Re-sync every 60 seconds
  setInterval(syncFromFirebase, 60000);
