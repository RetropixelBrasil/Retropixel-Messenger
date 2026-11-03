// IMPORTS (versão mais recente que você recebeu)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// SUA CONFIG (já correta)
const firebaseConfig = {
  apiKey: "AIzaSyA1xy2-1rQh2LQJZoM4U0mV6STLFFWOh9g",
  authDomain: "retropixel-messenger-rp.firebaseapp.com",
  projectId: "retropixel-messenger-rp",
  storageBucket: "retropixel-messenger-rp.firebasestorage.app",
  messagingSenderId: "450602101038",
  appId: "1:450602101038:web:c81068d83177be0eb172bf"
};

// INICIALIZA
const app = initializeApp(firebaseConfig);

// EXPORTA (ESSENCIAL)
export const auth = getAuth(app);
export const db = getFirestore(app);