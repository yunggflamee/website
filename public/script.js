const WORKER_URL = "https://devbuildai.infinityabs4.workers.dev"

const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

function createMessage(text, className) {
  const div = document.createElement("div");
  div.classList.add("message", className);
  div.textContent = text;
  return div;
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {

  const message = input.value.trim();
  if (!message) return;

  // Add user message
  chat.appendChild(createMessage(message, "user"));
  scrollToBottom();
  input.value = "";

  // Add thinking message
  const thinking = createMessage("Thinking...", "ai");
  chat.appendChild(thinking);
  scrollToBottom();

  try {

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    thinking.textContent = data.reply || "No response";

  } catch (error) {

    thinking.textContent = "Connection error";

  }

  scrollToBottom();
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});