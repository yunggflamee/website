// ============================================================
//  DevMind — script.js
//  All the chat logic lives here. Beginner-friendly comments!
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// After deploying your Cloudflare Worker, paste its URL in Settings (⚙)
// It's saved in your browser so you only set it once.
let WORKER_URL = localStorage.getItem("workerUrl") || "";

// ── STATE ────────────────────────────────────────────────────
let chats    = JSON.parse(localStorage.getItem("chats") || "{}");  // All saved chats
let activeId = null;   // ID of the currently open chat
let isThinking = false; // Is the AI currently responding?

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  renderChatList();

  // Configure markdown renderer
  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
  });

  // Override how marked renders code blocks — we add a copy button
  const renderer = new marked.Renderer();
  renderer.code = (code, lang) => {
    const highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;

    const id = "code-" + Math.random().toString(36).slice(2, 8);
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">${lang || "code"}</span>
          <button class="copy-btn" onclick="copyCode('${id}', this)">Copy</button>
        </div>
        <pre><code id="${id}">${highlighted}</code></pre>
      </div>`;
  };
  marked.use({ renderer });

  // Auto-resize textarea as the user types
  const textarea = document.getElementById("userInput");
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  });

  // Send on Enter (but Shift+Enter = new line)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Sidebar toggle
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
  });

  // New chat button
  document.getElementById("newChatBtn").addEventListener("click", startNewChat);

  // Settings modal
  document.getElementById("settingsBtn").addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.add("open");
  });
  document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.remove("open");
  });
  document.getElementById("saveSettings").addEventListener("click", saveSettings);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
  });
});

// ── SEND MESSAGE ─────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("userInput");
  const text  = input.value.trim();

  if (!text || isThinking) return;

  // Check if worker URL is set
  if (!WORKER_URL) {
    alert("Please set your Worker URL first! Click ⚙ Settings in the sidebar.");
    return;
  }

  // If no chat is open, create a new one
  if (!activeId) startNewChat();

  // Add the user's message to the chat
  const userMsg = { role: "user", content: text };
  chats[activeId].messages.push(userMsg);
  appendMessage("user", text);

  // Clear and reset the textarea
  input.value = "";
  input.style.height = "auto";

  // Update the chat title (use first message)
  if (chats[activeId].messages.length === 1) {
    const title = text.length > 40 ? text.slice(0, 40) + "…" : text;
    chats[activeId].title = title;
    document.getElementById("topbarTitle").textContent = title;
    renderChatList();
  }

  // Show the thinking indicator
  setThinking(true);
  const thinkingEl = appendThinking();

  try {
    const model      = document.getElementById("modelSelect").value;
    const sysPrompt  = document.getElementById("systemPrompt").value;

    // Build the full message array (system prompt + history)
    const messages = [
      { role: "system", content: sysPrompt },
      ...chats[activeId].messages,
    ];

    // Call our Cloudflare Worker (which calls OpenRouter)
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "meta-llama/llama-3.3-70b-instruct:free", messages }),
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}`);
    }

    const data    = await response.json();
    const aiText  = data.choices?.[0]?.message?.content;

    if (!aiText) throw new Error("Empty response from AI");

    // Save AI reply to history
    chats[activeId].messages.push({ role: "assistant", content: aiText });
    saveChats();

    // Replace thinking indicator with actual response
    thinkingEl.remove();
    appendMessage("assistant", aiText);

  } catch (err) {
    thinkingEl.remove();
    appendMessage("error", "⚠ Error: " + err.message + "\n\nCheck your Worker URL in Settings, and make sure your Worker is deployed and the API key is set.");
  } finally {
    setThinking(false);
  }
}

// ── RENDER A MESSAGE ─────────────────────────────────────────
function appendMessage(role, content) {
  // Hide welcome screen once a message appears
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.style.display = "none";

  const container = document.getElementById("messages");

  const div = document.createElement("div");
  div.className = `message ${role === "user" ? "user" : "ai"}`;

  let avatarHtml, contentHtml;

  if (role === "user") {
    avatarHtml  = `<div class="avatar user-avatar">👤</div>`;
    contentHtml = `<div class="message-content">${escapeHtml(content)}</div>`;
  } else if (role === "error") {
    avatarHtml  = `<div class="avatar ai-avatar">!</div>`;
    contentHtml = `<div class="message-content" style="color:#ef4444">${escapeHtml(content)}</div>`;
  } else {
    avatarHtml  = `<div class="avatar ai-avatar">D</div>`;
    contentHtml = `<div class="message-content">${marked.parse(content)}</div>`;
  }

  div.innerHTML = `<div class="message-inner">${avatarHtml}${contentHtml}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ── THINKING INDICATOR ───────────────────────────────────────
function appendThinking() {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message ai thinking-msg";
  div.innerHTML = `
    <div class="message-inner">
      <div class="avatar ai-avatar">D</div>
      <div class="message-content" style="color:var(--text-muted)">Thinking</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ── COPY CODE BUTTON ─────────────────────────────────────────
function copyCode(id, btn) {
  const code = document.getElementById(id)?.innerText;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("copied");
    }, 2000);
  });
}


// ── SUGGESTION BUTTONS ───────────────────────────────────────
function fillInput(text) {
  const input = document.getElementById("userInput");
  input.value = text;
  input.focus();
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 200) + "px";
}

// ── CHAT MANAGEMENT ──────────────────────────────────────────
function startNewChat() {
  const id = "chat-" + Date.now();
  chats[id] = { title: "New Chat", messages: [], created: Date.now() };
  activeId = id;
  saveChats();
  renderChatList();

  // Clear the messages area
  const messages = document.getElementById("messages");
  messages.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">⌥</div>
      <h1>DevMind</h1>
      <p>Your AI coding assistant. Ask me anything about code, tech, bugs, or concepts.</p>
      <div class="suggestions">
        <button class="suggest-btn" onclick="fillInput('Write a Python web scraper using BeautifulSoup')">🕷 Python web scraper</button>
        <button class="suggest-btn" onclick="fillInput('Explain how async/await works in JavaScript')">⚡ Async/await explained</button>
        <button class="suggest-btn" onclick="fillInput('Build a REST API in Node.js with Express')">🛠 REST API in Node.js</button>
        <button class="suggest-btn" onclick="fillInput('What is the difference between SQL and NoSQL?')">🗄 SQL vs NoSQL</button>
      </div>
    </div>`;
  document.getElementById("topbarTitle").textContent = "New Chat";
}

function loadChat(id) {
  activeId = id;
  renderChatList();

  const chat = chats[id];
  document.getElementById("topbarTitle").textContent = chat.title;
  const messages = document.getElementById("messages");
  messages.innerHTML = "";

  chat.messages.forEach((msg) => {
    appendMessage(msg.role, msg.content);
  });
}

function renderChatList() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";

  // Sort chats newest first
  const sorted = Object.entries(chats).sort((a, b) => b[1].created - a[1].created);

  if (sorted.length === 0) {
    list.innerHTML = `<div style="padding:12px 10px;font-size:12px;color:var(--text-dim)">No chats yet</div>`;
    return;
  }

  sorted.forEach(([id, chat]) => {
    const item = document.createElement("div");
    item.className = "chat-item" + (id === activeId ? " active" : "");
    item.textContent = chat.title;
    item.title = chat.title;
    item.onclick = () => loadChat(id);
    list.appendChild(item);
  });
}

// ── SETTINGS ─────────────────────────────────────────────────
function saveSettings() {
  WORKER_URL = document.getElementById("workerUrl").value.trim();
  localStorage.setItem("workerUrl", WORKER_URL);
  document.getElementById("modalOverlay").classList.remove("open");
}

function loadSettings() {
  const url = localStorage.getItem("workerUrl") || "";
  document.getElementById("workerUrl").value = url;
  WORKER_URL = url;
}

// ── HELPERS ───────────────────────────────────────────────────
function setThinking(val) {
  isThinking = val;
  document.getElementById("sendBtn").disabled = val;
  document.getElementById("statusDot").className = "status-dot" + (val ? " thinking" : "");
  document.getElementById("statusText").textContent = val ? "Thinking…" : "Ready";
}

function saveChats() {
  localStorage.setItem("chats", JSON.stringify(chats));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}