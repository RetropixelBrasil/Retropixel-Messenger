
/* ==========================================
   RETROPIXEL MESSENGER™ 2.0
   FIREBASE CONFIGURATION
   ========================================== */

// FIREBASE SDK
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

import { getDatabase } from
  "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

// ==========================================
// CONFIGURAÇÕES DO PROJETO
// ==========================================

const firebaseConfig = {

  apiKey: "AIzaSyA1xy2-1rQh2LQJZoM4U0mV6STLFFWOh9g",

  authDomain: "retropixel-messenger-rp.firebaseapp.com",

  projectId: "retropixel-messenger-rp",

  storageBucket: "retropixel-messenger-rp.firebasestorage.app",

  messagingSenderId: "450602101038",

  appId: "1:450602101038:web:c81068d83177be0eb172bf",

  // URL do Firebase Realtime Database
  databaseURL: "https://retropixel-messenger-rp-default-rtdb.firebaseio.com/"

};

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const app = initializeApp(firebaseConfig);

// ==========================================
// SERVIÇOS FIREBASE
// ==========================================

// Autenticação
export const auth = getAuth(app);

// Cloud Firestore
export const db = getFirestore(app);

// Realtime Database
export const rtdb = getDatabase(app);

// Aplicativo Firebase
export { app };

console.log("🚀 RPM 2.0: Firebase conectado!");
