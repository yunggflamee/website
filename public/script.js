const WORKER_URL = "https://devbuildai.infinityabs4.workers.dev";

const chat = document.getElementById("chat");
const input = document.getElementById("messageInput");
const button = document.getElementById("sendBtn");

function createMessage(text, type) {

  const div = document.createElement("div");

  div.classList.add("message", type);

  div.textContent = text;

  return div;
}

function scrollBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function typeEffect(element, text, speed = 12) {

  element.textContent = "";

  let i = 0;

  function type() {

    if (i < text.length) {

      element.textContent += text.charAt(i);

      i++;

      setTimeout(type, speed);
    }
  }

  type();
}

async function sendMessage() {

  const message = input.value.trim();

  if (!message) return;

  chat.appendChild(createMessage(message, "user"));

  input.value = "";

  const thinking = createMessage("Thinking...", "ai");

  chat.appendChild(thinking);

  scrollBottom();

  try {

    const response = await fetch(WORKER_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message
      })
    });

    const data = await response.json();

    typeEffect(thinking, data.reply || "No response");

  }

  catch {

    thinking.textContent = "Connection error";

  }

  scrollBottom();
}

button.onclick = sendMessage;

input.addEventListener("keypress", e => {

  if (e.key === "Enter") sendMessage();

});