// ===== CONFIG =====

// Fastest free models (priority order)
const MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free"
];

let currentModel = MODELS[0];

let WORKER_URL =
  localStorage.getItem("workerUrl") ||
  "https://your-worker-name.your-username.workers.dev";

let messages = [];

// ===== DOM =====

const chatBox = document.getElementById("chatBox");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const modelSelect = document.getElementById("modelSelect");
const saveWorkerBtn = document.getElementById("saveWorker");
const workerInput = document.getElementById("workerInput");

// ===== LOAD SETTINGS =====

workerInput.value = WORKER_URL;

// ===== SAVE WORKER URL =====

saveWorkerBtn.onclick = () => {
  WORKER_URL = workerInput.value.trim();
  localStorage.setItem("workerUrl", WORKER_URL);
  alert("Worker URL saved");
};

// ===== MODEL CHANGE =====

modelSelect.onchange = () => {
  currentModel = modelSelect.value;
};

// ===== UI FUNCTIONS =====

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = role;
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ===== TIMEOUT FETCH =====

async function fetchWithTimeout(url, options, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  options.signal = controller.signal;

  try {
    const response = await fetch(url, options);
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ===== TRY MODELS UNTIL SUCCESS =====

async function tryModels() {

  for (let model of MODELS) {

    try {

      const response = await fetchWithTimeout(
        WORKER_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
          }),
        },
        15000
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.choices && data.choices[0]) {
        currentModel = model;
        return data.choices[0].message.content;
      }

    } catch (err) {
      continue;
    }

  }

  throw new Error("All models failed");
}

// ===== SEND MESSAGE =====

async function sendMessage() {

  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  addMessage("user", text);

  messages.push({
    role: "user",
    content: text
  });

  addMessage("assistant", "Thinking...");

  try {

    const reply = await tryModels();

    chatBox.lastChild.innerText = reply;

    messages.push({
      role: "assistant",
      content: reply
    });

  }
  catch (err) {
    chatBox.lastChild.innerText =
      "Error: All models busy. Try again.";
  }
}

// ===== EVENTS =====

sendBtn.onclick = sendMessage;

input.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});