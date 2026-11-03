
/* ==========================================
   RETROPIXEL MESSENGER™ 2.0
   LOGIN & REGISTRATION
   ========================================== */

import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ==========================================
// VARIÁVEIS
// ==========================================

const APP_URL = "app.html";

let authActionInProgress = false;

// ==========================================
// ELEMENTOS HTML
// ==========================================

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const authMessage = document.getElementById("authMessage");

// ==========================================
// MENSAGENS
// ==========================================

function showMessage(message, type = "error") {

  if (!authMessage) {
    alert(message);
    return;
  }

  authMessage.textContent = message;
  authMessage.className = "auth-message " + type;
  authMessage.hidden = false;

}

function clearMessage() {

  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.hidden = true;

}

// ==========================================
// ERROS DO FIREBASE
// ==========================================

function getErrorMessage(error) {

  const errors = {

    "auth/invalid-email":
      "O endereço de e-mail é inválido.",

    "auth/user-not-found":
      "Não encontramos uma conta com esse e-mail.",

    "auth/wrong-password":
      "Senha incorreta.",

    "auth/invalid-credential":
      "E-mail ou senha incorretos.",

    "auth/email-already-in-use":
      "Este e-mail já possui uma conta.",

    "auth/weak-password":
      "A senha precisa ter pelo menos 6 caracteres.",

    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco e tente novamente.",

    "auth/network-request-failed":
      "Erro de conexão. Verifique sua internet."

  };

  return errors[error.code] ||
    "Não foi possível realizar a operação. Tente novamente.";

}

// ==========================================
// VALIDAÇÃO
// ==========================================

function getCredentials() {

  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {

    showMessage("Preencha o e-mail e a senha.");

    return null;

  }

  return { email, password };

}

// ==========================================
// ESTADO DOS BOTÕES
// ==========================================

function setLoading(loading) {

  if (loginBtn) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading
      ? "Entrando..."
      : "Entrar";
  }

  if (registerBtn) {
    registerBtn.disabled = loading;
    registerBtn.textContent = loading
      ? "Aguarde..."
      : "Criar conta";
  }

}

// ==========================================
// LOGIN
// ==========================================

async function login() {

  clearMessage();

  const credentials = getCredentials();

  if (!credentials) return;

  authActionInProgress = true;
  setLoading(true);

  try {

    await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );

    showMessage("Login realizado! Abrindo o RPM™...", "success");

    location.replace(APP_URL);

  }

  catch (error) {

    console.error("RPM 2.0 - Erro no login:", error);

    authActionInProgress = false;

    showMessage(getErrorMessage(error));

    setLoading(false);

  }

}

// ==========================================
// CADASTRO
// ==========================================

async function register() {

  clearMessage();

  const credentials = getCredentials();

  if (!credentials) return;

  if (credentials.password.length < 6) {

    showMessage("A senha precisa ter pelo menos 6 caracteres.");

    return;

  }

  authActionInProgress = true;
  setLoading(true);

  let userCredential = null;

  try {

    // Criar conta
    userCredential = await createUserWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );

    const user = userCredential.user;

    // Criar perfil no Firestore
    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email,
        status: "offline"
      }
    );

    showMessage("Conta criada! Bem-vindo ao RPM™ 2.0!", "success");

    location.replace(APP_URL);

  }

  catch (error) {

    console.error("RPM 2.0 - Erro no cadastro:", error);

    if (userCredential) {

      showMessage(
        "Sua conta foi criada, mas não foi possível salvar seu perfil. Não crie outra conta. Entre novamente após corrigirmos o problema."
      );

    } else {

      showMessage(getErrorMessage(error));

    }

    authActionInProgress = false;

    setLoading(false);

  }

}

// ==========================================
// AUTENTICAÇÃO AUTOMÁTICA
// ==========================================

onAuthStateChanged(auth, user => {

  if (authActionInProgress) return;

  if (user) {

    location.replace(APP_URL);

  }

});

// ==========================================
// EVENTOS
// ==========================================

loginBtn?.addEventListener("click", login);

registerBtn?.addEventListener("click", register);

// Permitir Enter para entrar
passwordInput?.addEventListener("keydown", event => {

  if (event.key === "Enter") {
    login();
  }

});

document.getElementById("loginForm")
  ?.addEventListener("submit", event => {
    event.preventDefault();
    login();
  });

console.log("🚀 RPM 2.0 - Login carregado!");

