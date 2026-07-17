// ---------------------------------------------------------------
// Replace the values below with YOUR BridgeGap project's config.
// Find it in: Firebase Console -> Project settings (gear icon) ->
// General tab -> "Your apps" -> Web app -> SDK setup and configuration.
// This config is safe to keep in client-side code; your data is
// actually protected by the Firestore security rules, not by
// keeping this object secret.
// ---------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD4i7PO7WIiz40DojFiKacAQmASSOHBJng",
  authDomain: "bridgegap-d4ad0.firebaseapp.com",
  projectId: "bridgegap-d4ad0",
  storageBucket: "bridgegap-d4ad0.firebasestorage.app",
  messagingSenderId: "417879979346",
  appId: "1:417879979346:web:edd866628546e1ae02368b",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => {
  // Persistence can fail if multiple tabs are open; the app still works online.
});

window.__fb = {
  auth, db, doc, getDoc, setDoc, onSnapshot,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
};
window.dispatchEvent(new Event("fb-ready"));
