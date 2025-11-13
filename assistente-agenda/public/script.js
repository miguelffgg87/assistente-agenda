const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("msg");
const sendBtn = document.getElementById("send-btn");
const authStatus = document.getElementById("auth-status");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

let isConnected = false;

function addMessage(text, isUser) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);

  const chatContainer = document.getElementById("chat-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message bot-message";
  loadingDiv.id = "loading-message";
  loadingDiv.innerHTML = '<span class="loading"></span> <span class="loading"></span> <span class="loading"></span>';
  messagesContainer.appendChild(loadingDiv);

  const chatContainer = document.getElementById("chat-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeLoading() {
  const loadingMsg = document.getElementById("loading-message");
  if (loadingMsg) {
    loadingMsg.remove();
  }
}

async function enviar() {
  const msg = inputField.value.trim();

  if (!msg) {
    addMessage("⚠️ Digite algo primeiro!", false);
    return;
  }

  addMessage(msg, true);
  inputField.value = "";
  sendBtn.disabled = true;

  showLoading();

  try {
    const res = await fetch("/mensagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: msg })
    });

    const data = await res.json();
    removeLoading();
    addMessage(data.resposta, false);
  } catch (error) {
    removeLoading();
    addMessage("❌ Erro ao conectar com o servidor. Tente novamente.", false);
    console.error("Erro:", error);
  } finally {
    sendBtn.disabled = false;
    inputField.focus();
  }
}

function handleKeyPress(event) {
  if (event.key === "Enter") {
    enviar();
  }
}

async function checkAuthStatus() {
  try {
    const res = await fetch("/auth/status");
    const data = await res.json();

    isConnected = data.connected;

    if (isConnected) {
      authStatus.textContent = "📅 Google Calendar conectado";
      authStatus.style.color = "#4caf50";
      logoutBtn.style.display = "inline-block";
      loginBtn.style.display = "none";
    } else {
      authStatus.textContent = "⚠️ Google Calendar desconectado";
      authStatus.style.color = "#f44336";
      logoutBtn.style.display = "none";
      loginBtn.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    authStatus.textContent = "⚠️ Erro na conexão";
    authStatus.style.color = "#ff9800";
    logoutBtn.style.display = "none";
    loginBtn.style.display = "inline-block";
  }
}

async function login() {
  try {
    const res = await fetch("/auth/login", { method: "POST" });
    const data = await res.json();

    if (data.redirectToOAuth) {
      window.location.href = "/auth/google-ui";
      return;
    }

    if (data.success) {
      addMessage("✅ Conectado ao Google Calendar com sucesso!", false);
      await checkAuthStatus();
    } else {
      addMessage("❌ " + data.message, false);
    }
  } catch (error) {
    addMessage("❌ Erro ao conectar.", false);
    console.error("Erro:", error);
  }
}

async function logout() {
  try {
    const res = await fetch("/auth/logout", { method: "POST" });
    const data = await res.json();

    if (data.success) {
      addMessage("📤 Você foi desconectado. Clique em 'Conectar Google' para entrar com outra conta.", false);
      await checkAuthStatus();
    }
  } catch (error) {
    addMessage("❌ Erro ao desconectar.", false);
    console.error("Erro:", error);
  }
}

checkAuthStatus();

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('login') === 'success') {
  addMessage("✅ Conectado ao Google Calendar com sucesso!", false);
  window.history.replaceState({}, document.title, window.location.pathname);
}

addMessage("Olá! 👋 Sou seu assistente de agenda inteligente. Posso te ajudar a:", false);
addMessage("📅 Criar eventos de dia inteiro (aniversários, feriados, etc)", false);
addMessage("⏰ Marcar compromissos com horário específico (consultas, reuniões)", false);
addMessage("💬 Ou apenas conversar!", false);
addMessage("Para trocar de conta do Google, clique em 'Trocar de conta' e depois em 'Conectar Google'.", false);

inputField.focus();
