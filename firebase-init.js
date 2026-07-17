// ---------------------------------------------------------------
// Plain classic script (no "import", no type="module") on purpose:
// some mobile networks run data-compression proxies that can strip
// or mangle module-script attributes, which breaks ES module syntax.
// This version uses the Firebase "compat" SDK instead, loaded via
// ordinary <script src> tags, so it behaves like any other script.
//
// This config is safe to keep in client-side code; your data is
// actually protected by the Firestore security rules, not by
// keeping this object secret.
// ---------------------------------------------------------------
var firebaseConfig = {
  apiKey: "AIzaSyD4i7PO7WIiz40DojFiKacAQmASSOHBJng",
  authDomain: "bridgegap-d4ad0.firebaseapp.com",
  projectId: "bridgegap-d4ad0",
  storageBucket: "bridgegap-d4ad0.firebasestorage.app",
  messagingSenderId: "417879979346",
  appId: "1:417879979346:web:edd866628546e1ae02368b",
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

db.enablePersistence().catch(function () {
  // Persistence can fail if multiple tabs are open; the app still works online.
});

function doc(dbRef, collectionName, id) {
  return dbRef.collection(collectionName).doc(id);
}

function onSnapshot(ref, onNext, onError) {
  return ref.onSnapshot(function (snap) {
    // Normalize the compat snapshot ("exists" is a boolean here) to
    // look like the modular SDK's shape ("exists()" is a function),
    // so the rest of the app doesn't need to know which SDK is in use.
    var existsVal = snap.exists;
    var wrapped = {
      exists: function () { return existsVal; },
      data: function () { return snap.data(); },
    };
    onNext(wrapped);
  }, onError);
}

function setDoc(ref, data) {
  return ref.set(data);
}

function signInWithEmailAndPassword(authRef, email, password) {
  return authRef.signInWithEmailAndPassword(email, password);
}

function onAuthStateChanged(authRef, cb) {
  return authRef.onAuthStateChanged(cb);
}

function signOut(authRef) {
  return authRef.signOut();
}

window.__fb = {
  auth: auth, db: db, doc: doc, onSnapshot: onSnapshot, setDoc: setDoc,
  signInWithEmailAndPassword: signInWithEmailAndPassword,
  onAuthStateChanged: onAuthStateChanged,
  signOut: signOut,
};
window.dispatchEvent(new Event("fb-ready"));
