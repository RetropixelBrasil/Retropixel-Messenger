import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/* ================= VARS ================= */

let currentUser = null;
let currentChat = null;
let unsubscribe = null;

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  console.log("🚀 DOM pronto");

  setupLoginUI();
  setupAppUI();

});

/* ================= HELPERS ================= */

function playClick() {

  const el = document.getElementById("clickSound");

  if (!el) return;

  el.currentTime = 0;

  el.play().catch(() => {});

}

function playNudge() {

  const el = document.getElementById("nudgeSound");

  if (!el) return;

  el.currentTime = 0;

  el.play().catch(() => {});

}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  console.log("🔐 Auth mudou:", user);

  const path = location.pathname.toLowerCase();

  const isIndex =
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.includes("index.html");

  const isProtected =
    path.includes("app.html") ||
    path.includes("configuracoes.html") ||
    path.includes("sobre.html") ||
    path.includes("termos.html");

  try {

    if (user && isIndex) {

      location.href = "app.html";
      return;

    }

    if (!user && isProtected) {

      location.href = "index.html";
      return;

    }

    if (user) {

      currentUser = user;

      await setDoc(doc(db, "users", user.uid), {

        email: user.email,
        status: "online"

      }, { merge: true });

      if (path.includes("app.html")) {

        loadContacts();

      }

    }

  }

  catch (e) {

    console.error("Erro no Auth:", e);

  }

});

/* ================= LOGIN UI ================= */

function setupLoginUI() {

  document
    .getElementById("loginBtn")
    ?.addEventListener("click", login);

  document
    .getElementById("registerBtn")
    ?.addEventListener("click", register);

}

/* ================= APP UI ================= */

function setupAppUI() {

  document
    .getElementById("logoutBtn")
    ?.addEventListener("click", logout);

  document
    .getElementById("sendBtn")
    ?.addEventListener("click", sendMessage);

  document
    .getElementById("nudgeBtn")
    ?.addEventListener("click", sendNudge);

  document
    .getElementById("addContactBtn")
    ?.addEventListener("click", addContact);

  document
    .getElementById("sobreBtn")
    ?.addEventListener("click", () => {

      playClick();
      location.href = "sobre.html";

    });

  document
    .getElementById("configBtn")
    ?.addEventListener("click", () => {

      playClick();
      location.href = "configuracoes.html";

    });

  document
    .getElementById("termosBtn")
    ?.addEventListener("click", () => {

      playClick();
      location.href = "termos.html";

    });

}

/* ================= LOGIN ================= */

async function login() {

  playClick();

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!email || !password) {

    alert("Preencha todos os campos.");
    return;

  }

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  }

  catch (e) {

    console.error(e);

    alert(e.message);

  }

}

/* ================= REGISTER ================= */

async function register() {

  playClick();

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!email || !password) {

    alert("Preencha todos os campos.");
    return;

  }

  try {

    const userCred =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    await setDoc(
      doc(db, "users", userCred.user.uid),
      {

        email,
        status: "online"

      },
      {
        merge: true
      }
    );

    alert("Conta criada!");

  }

  catch (e) {

    console.error(e);

    alert(e.message);

  }

}

/* ================= LOGOUT ================= */

async function logout() {

  playClick();

  if (!currentUser) return;

  try {

    await setDoc(
      doc(db, "users", currentUser.uid),
      {

        status: "offline"

      },
      {
        merge: true
      }
    );

    await signOut(auth);

  }

  catch (e) {

    console.error(e);

  }

}

/* ================= CONTATOS ================= */

async function loadContacts() {

  const el = document.getElementById("contacts");

  if (!el || !currentUser) return;

  el.innerHTML = "Carregando...";

  try {

    const q = query(
      collection(db, "contacts"),
      where("owner", "==", currentUser.uid)
    );

    const contacts = await getDocs(q);
    const users = await getDocs(collection(db, "users"));

    el.innerHTML = "";

    contacts.forEach(contactDoc => {

      const contact = contactDoc.data();

      users.forEach(userDoc => {

        if (userDoc.id !== contact.contactId) return;

        const user = userDoc.data();

        const div = document.createElement("div");

        div.className = "contact";

        div.innerHTML = `
          <span class="status ${user.status || "offline"}"></span>
          <img src="assets/avatar.png" class="contact-avatar">
          <span class="contact-name">${user.email}</span>
        `;

        div.onclick = () => {

          playClick();

          openChat(userDoc.id, user.email);

        };

        el.appendChild(div);

      });

    });

  }

  catch (e) {

    console.error("Erro ao carregar contatos:", e);

  }

}

/* ================= ADD CONTATO ================= */

async function addContact() {

  playClick();

  const email = prompt("Email do contato:");

  if (!email) return;

  try {

    const users = await getDocs(collection(db, "users"));

    let found = null;

    users.forEach(user => {

      if (user.data().email.toLowerCase() === email.toLowerCase()) {

        found = user.id;

      }

    });

    if (!found) {

      alert("Usuário não encontrado!");

      return;

    }

    if (found === currentUser.uid) {

      alert("Você não pode adicionar a si mesmo.");

      return;

    }

    await addDoc(collection(db, "contacts"), {

      owner: currentUser.uid,
      contactId: found

    });

    loadContacts();

  }

  catch (e) {

    console.error("Erro ao adicionar contato:", e);

  }

}

/* ================= CHAT ================= */

function getChatId(a, b) {

  return [a, b].sort().join("_");

}

function openChat(uid, email) {

  currentChat = getChatId(currentUser.uid, uid);

  const title = document.getElementById("chatTitle");

  if (title) {

    title.innerText = email;

  }

  listenMessages();

}

/* ================= MENSAGENS ================= */

function listenMessages() {

  if (unsubscribe) {

    unsubscribe();
    unsubscribe = null;

  }

  const el = document.getElementById("messages");

  if (!el || !currentChat) return;

  const q = query(
    collection(db, "messages", currentChat, "chat"),
    orderBy("timestamp")
  );

  unsubscribe = onSnapshot(q, snapshot => {

    el.innerHTML = "";

    snapshot.forEach(docSnap => {

      const msg = docSnap.data();

      /* NUDGE */

      if (msg.type === "nudge") {

        shakeWindow();

        if (msg.sender !== currentUser.uid) {

          playNudge();

        }

        return;

      }

      const div = document.createElement("div");

      div.className =
        msg.sender === currentUser.uid
          ? "msg me"
          : "msg";

      div.textContent = msg.text;

      el.appendChild(div);

    });

    el.scrollTop = el.scrollHeight;

  });

}

/* ================= ENVIAR ================= */

async function sendMessage() {

  playClick();

  const input = document.getElementById("messageInput");

  if (!input) return;

  const text = input.value.trim();

  if (!text) return;

  if (!currentChat) {

    alert("Selecione um contato.");

    return;

  }

  try {

    await addDoc(
      collection(db, "messages", currentChat, "chat"),
      {

        text,
        sender: currentUser.uid,
        timestamp: serverTimestamp()

      }
    );

    input.value = "";

    input.focus();

  }

  catch (e) {

    console.error("Erro ao enviar mensagem:", e);

    alert("Erro ao enviar mensagem.");

  }

}

/* ================= NUDGE ================= */

async function sendNudge() {

  if (!currentChat) return;

  playNudge();

  try {

    await addDoc(
      collection(db, "messages", currentChat, "chat"),
      {

        type: "nudge",
        sender: currentUser.uid,
        timestamp: serverTimestamp()

      }
    );

  }

  catch (e) {

    console.error("Erro ao enviar nudge:", e);

  }

}

/* ================= NUDGE FX ================= */

function shakeWindow() {

  const windowEl =
    document.querySelector(".messenger-window");

  if (!windowEl) return;

  let count = 0;

  const interval = setInterval(() => {

    windowEl.style.transform =
      `translate(${count % 2 ? 6 : -6}px,0)`;

    count++;

    if (count > 10) {

      clearInterval(interval);

      windowEl.style.transform = "";

    }

  }, 40);

}

/* ================= ENTER ================= */

document.addEventListener("keydown", event => {

  if (event.key !== "Enter") return;

  const input = document.getElementById("messageInput");

  if (!input) return;

  if (document.activeElement === input) {

    sendMessage();

  }

});