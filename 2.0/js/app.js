import { auth, db, rtdb } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, query, where, orderBy,
  limit, onSnapshot, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const $ = id => document.getElementById(id);
const rpmApp = $("rpmApp"), contactsList = $("contactsList"), contactSearch = $("contactSearch");
const myEmail = $("myEmail"), myStatusDot = $("myStatusDot"), myStatusText = $("myStatusText");
const chatTitle = $("chatTitle"), chatSubtitle = $("chatSubtitle"), chatAvatar = $("chatAvatar");
const chatEmpty = $("chatEmpty"), messagesBox = $("messages");
const messageForm = $("messageForm"), messageInput = $("messageInput"), sendBtn = $("sendBtn");
const nudgeBtn = $("nudgeBtn"), chatFeedback = $("chatFeedback");
const addContactModal = $("addContactModal"), addContactForm = $("addContactForm");
const newContactEmail = $("newContactEmail"), addContactMessage = $("addContactMessage");
const confirmAddContactBtn = $("confirmAddContactBtn");

let currentUser = null, selectedContact = null, contacts = [], presenceData = {};
let unsubscribeContacts = null, unsubscribeMessages = null;
const unsubscribePresence = new Map();
let presenceInitialized = false, authInitialized = false, firstMessageSnapshot = true;
let knownMessageIds = new Set();
const notificationCounts = { nudge: 0, message: 0 };

function playSound(id) {
  const audio = $(id);
  if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}
function chatIdFor(a, b) { return [a, b].sort().join("_"); }
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function statusOf(uid) { return presenceData[uid]?.state === "online" ? "online" : "offline"; }
function formatTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  return timestamp.toDate().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
}
function stopPresenceListeners() {
  unsubscribePresence.forEach(unsubscribe => unsubscribe());
  unsubscribePresence.clear();
}
function showNotification(type, sender) {
  const nudge = type === "nudge";
  const card = $(nudge ? "nudgeNotification" : "messageNotification");
  const label = $(nudge ? "nudgeNotificationText" : "messageNotificationText");
  const badge = $(nudge ? "nudgeNotificationCount" : "messageNotificationCount");
  notificationCounts[type]++;
  label.textContent = nudge ? `${sender} enviou um Ding-a-ding!` : `${sender} enviou uma mensagem.`;
  badge.textContent = `(${notificationCounts[type]})`;
  badge.hidden = notificationCounts[type] <= 1;
  card.hidden = false;
  playSound(nudge ? "dingSound" : "clickSound");
}
function dismissNotification(type) {
  $(type === "nudge" ? "nudgeNotification" : "messageNotification").hidden = true;
  notificationCounts[type] = 0;
}

async function initializePresence() {
  if (!currentUser || presenceInitialized) return;
  const ownPresence = ref(rtdb, `presence/${currentUser.uid}`);
  try {
    await onDisconnect(ownPresence).set({state:"offline",last_changed:Date.now()});
    await set(ownPresence, {state:"online",last_changed:Date.now()});
    presenceInitialized = true;
    await updateDoc(doc(db,"users",currentUser.uid),{status:"online"}).catch(error =>
      console.warn("Falha ao atualizar status no Firestore:", error)
    );
    myStatusDot.classList.remove("offline");
    myStatusText.textContent = "Disponível";
  } catch (error) {
    console.error("Erro ao iniciar presença:", error);
    myStatusDot.classList.add("offline");
    myStatusText.textContent = "Presença indisponível";
  }
}
async function setOffline() {
  if (!currentUser) return;
  try {
    await set(ref(rtdb,`presence/${currentUser.uid}`),{state:"offline",last_changed:Date.now()});
  } catch (error) { console.warn("Falha ao atualizar presença:",error); }
}

function renderContacts() {
  contactsList.replaceChildren();
  const term = contactSearch.value.trim().toLowerCase();
  const filtered = contacts.filter(c => (c.email || "").toLowerCase().includes(term));
  const online = filtered.filter(c => statusOf(c.uid) === "online");
  const offline = filtered.filter(c => statusOf(c.uid) !== "online");

  function group(title, list, isOnline) {
    const heading = document.createElement("div");
    heading.className = "group-title";
    heading.textContent = `${title} (${list.length})`;
    contactsList.appendChild(heading);
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "loading-state";
      empty.textContent = "Nenhum contato aqui.";
      contactsList.appendChild(empty);
      return;
    }
    list.forEach(contact => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "contact-item";
      if (selectedContact?.uid === contact.uid) button.classList.add("selected");
      const avatar = document.createElement("img");
      avatar.className = "contact-avatar";
      avatar.src = "assets/avatar.png";
      avatar.alt = "";
      const info = document.createElement("span");
      info.className = "contact-info";
      const name = document.createElement("span");
      name.className = "contact-name";
      name.textContent = contact.email || "Contato";
      const presence = document.createElement("span");
      presence.className = "contact-presence";
      presence.textContent = isOnline ? "● Disponível" : "○ Offline";
      info.append(name,presence);
      button.append(avatar,info);
      button.addEventListener("click",()=>openChat(contact));
      contactsList.appendChild(button);
    });
  }
  group("Disponíveis",online,true);
  group("Offline",offline,false);
}

async function loadContacts() {
  if (!currentUser) return;
  if (unsubscribeContacts) unsubscribeContacts();
  stopPresenceListeners();
  const q = query(collection(db,"contacts"),where("owner","==",currentUser.uid));
  unsubscribeContacts = onSnapshot(q,async snapshot=>{
    const loaded = [];
    for (const item of snapshot.docs) {
      const data = item.data();
      if (!data.contactId || data.contactId === currentUser.uid) continue;
      try {
        const userDoc = await getDoc(doc(db,"users",data.contactId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          loaded.push({uid:data.contactId,email:userData.email || data.email || "Contato"});
        }
      } catch(error) { console.error("Erro ao carregar contato:",error); }
    }
    contacts = loaded;
    contacts.forEach(contact=>{
      if (unsubscribePresence.has(contact.uid)) return;
      const presenceRef = ref(rtdb,`presence/${contact.uid}`);
      const unsubscribe = onValue(presenceRef,snap=>{
        presenceData[contact.uid] = snap.val() || {state:"offline"};
        renderContacts();
        if (selectedContact?.uid === contact.uid) updateChatStatus();
      });
      unsubscribePresence.set(contact.uid,unsubscribe);
    });
    renderContacts();
  },error=>{
    console.error("Erro ao carregar contatos:",error);
    contactsList.textContent = "Não foi possível carregar seus contatos.";
  });
}

function openAddContactModal() {
  addContactMessage.textContent = "";
  newContactEmail.value = "";
  addContactModal.hidden = false;
  newContactEmail.focus();
}
function closeAddContactModal() { addContactModal.hidden = true; }

async function addContact(event) {
  event.preventDefault();
  if (!currentUser) return;
  const email = normalizeEmail(newContactEmail.value);
  if (!email) { addContactMessage.textContent = "Digite um e-mail válido."; return; }
  if (email === normalizeEmail(currentUser.email)) {
    addContactMessage.textContent = "Você não pode adicionar sua própria conta.";
    return;
  }
  confirmAddContactBtn.disabled = true;
  confirmAddContactBtn.textContent = "Adicionando...";
  try {
    const usersQuery = query(collection(db,"users"),where("email","==",email),limit(1));
    const result = await getDocs(usersQuery);
    if (result.empty) { addContactMessage.textContent = "Não encontramos uma conta com esse e-mail."; return; }
    const contactUid = result.docs[0].id;
    const existingQuery = query(collection(db,"contacts"),
      where("owner","==",currentUser.uid),where("contactId","==",contactUid),limit(1));
    const existing = await getDocs(existingQuery);
    if (!existing.empty) { addContactMessage.textContent = "Este contato já está na sua lista."; return; }
    await addDoc(collection(db,"contacts"),{owner:currentUser.uid,contactId:contactUid,email});
    playSound("clickSound");
    closeAddContactModal();
  } catch(error) {
    console.error("Erro ao adicionar contato:",error);
    addContactMessage.textContent = "Não foi possível adicionar. Verifique sua conexão e as regras do Firestore.";
  } finally {
    confirmAddContactBtn.disabled = false;
    confirmAddContactBtn.textContent = "Adicionar";
  }
}

function updateChatStatus() {
  if (selectedContact) chatSubtitle.textContent = statusOf(selectedContact.uid)==="online" ? "● Disponível" : "○ Offline";
}
function renderMessage(data) {
  const item = document.createElement("div");
  const mine = data.sender === currentUser.uid;
  const nudge = data.type === "nudge";
  item.className = "message";
  if (mine) item.classList.add("mine");
  if (nudge) item.classList.add("nudge");
  if (nudge) {
    item.textContent = data.text || "🔔 Ding-a-ding!";
  } else {
    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = mine ? "Você" : (selectedContact?.email || "Contato");
    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.text || "";
    item.append(author,text);
  }
  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTime(data.timestamp);
  item.appendChild(time);
  messagesBox.appendChild(item);
}

function openChat(contact) {
  selectedContact = contact;
  firstMessageSnapshot = true;
  knownMessageIds = new Set();
  chatTitle.textContent = contact.email;
  chatAvatar.hidden = false;
  chatEmpty.hidden = true;
  messagesBox.hidden = false;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  nudgeBtn.disabled = false;
  chatFeedback.textContent = "Conversa em tempo real.";
  updateChatStatus();
  renderContacts();
  rpmApp.classList.add("chat-open");
  if (unsubscribeMessages) unsubscribeMessages();
  messagesBox.replaceChildren();

  const contactForThisListener = contact;
  const q = query(collection(db,"messages",chatIdFor(currentUser.uid,contact.uid),"chat"),
    orderBy("timestamp","asc"),limit(200));

  unsubscribeMessages = onSnapshot(q,snapshot=>{
    messagesBox.replaceChildren();
    snapshot.docs.forEach(messageDoc=>renderMessage(messageDoc.data()));

    if (firstMessageSnapshot) {
      snapshot.docs.forEach(messageDoc=>knownMessageIds.add(messageDoc.id));
      firstMessageSnapshot = false;
    } else {
      snapshot.docChanges().forEach(change=>{
        if (change.type !== "added" || knownMessageIds.has(change.doc.id)) return;
        knownMessageIds.add(change.doc.id);
        const data = change.doc.data();
        if (data.sender === currentUser.uid) return;
        showNotification(data.type === "nudge" ? "nudge" : "message",contactForThisListener.email);
      });
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
  },error=>{
    console.error("Erro ao carregar mensagens:",error);
    chatFeedback.textContent = "Não foi possível carregar as mensagens.";
  });
  messageInput.focus();
}

async function sendMessage(text,type="text") {
  if (!currentUser || !selectedContact) return false;
  const clean = text.trim();
  if (!clean) return false;
  try {
    await addDoc(collection(db,"messages",chatIdFor(currentUser.uid,selectedContact.uid),"chat"),{
      text:clean,sender:currentUser.uid,timestamp:serverTimestamp(),
      ...(type==="nudge" ? {type:"nudge"} : {})
    });
    return true;
  } catch(error) {
    console.error("Erro ao enviar mensagem:",error);
    chatFeedback.textContent = "Falha ao enviar. Verifique as regras do Firestore.";
    return false;
  }
}
async function handleSendMessage(event) {
  event.preventDefault();
  if (!messageInput.value.trim()) return;
  sendBtn.disabled = true;
  const ok = await sendMessage(messageInput.value);
  if (ok) {
    messageInput.value = "";
    chatFeedback.textContent = "Mensagem enviada.";
    playSound("clickSound");
  }
  sendBtn.disabled = !selectedContact;
  messageInput.focus();
}
async function sendNudge() {
  if (!selectedContact) return;
  nudgeBtn.disabled = true;
  const ok = await sendMessage("🔔 Ding-a-ding!","nudge");
  if (ok) {
    playSound("dingSound");
    rpmApp.animate([
      {transform:"translateX(0)"},{transform:"translateX(-5px)"},
      {transform:"translateX(5px)"},{transform:"translateX(-4px)"},
      {transform:"translateX(4px)"},{transform:"translateX(0)"}
    ],{duration:400});
  }
  nudgeBtn.disabled = !selectedContact;
}

async function logout() {
  if (!currentUser) return;
  $("logoutBtn").disabled = true;
  try {
    await setOffline();
    await updateDoc(doc(db,"users",currentUser.uid),{status:"offline"}).catch(()=>{});
    await signOut(auth);
  } catch(error) {
    console.error("Erro ao sair:",error);
    $("logoutBtn").disabled = false;
  }
}

onAuthStateChanged(auth,async user=>{
  if (!user) { location.replace("index.html"); return; }
  if (authInitialized && currentUser?.uid === user.uid) return;
  currentUser = user;
  authInitialized = true;
  myEmail.textContent = user.email || "Conta RPM";
  myStatusText.textContent = "Conectando...";
  await initializePresence();
  await loadContacts();
});

// UI event handlers
$("logoutBtn").addEventListener("click",logout);
$("addContactBtn").addEventListener("click",openAddContactModal);
$("addContactMobileBtn").addEventListener("click",openAddContactModal);
$("cancelAddContactBtn").addEventListener("click",closeAddContactModal);
addContactForm.addEventListener("submit",addContact);
addContactModal.addEventListener("click",event=>{if(event.target===addContactModal)closeAddContactModal();});
$("refreshBtn").addEventListener("click",()=>{loadContacts();playSound("clickSound");});
contactSearch.addEventListener("input",renderContacts);
messageForm.addEventListener("submit",handleSendMessage);
nudgeBtn.addEventListener("click",sendNudge);
$("backToContactsBtn").addEventListener("click",()=>rpmApp.classList.remove("chat-open"));
messageInput.addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();messageForm.requestSubmit();}
});
document.querySelectorAll("[data-dismiss]").forEach(button=>{
  button.addEventListener("click",()=>dismissNotification(button.dataset.dismiss));
});

console.log("🚀 RPM™ 2.0 — Mensageiro carregado!");
