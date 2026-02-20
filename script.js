let WORKER_URL =
localStorage.getItem("workerUrl") || "";

let chats =
JSON.parse(localStorage.getItem("chats") || "{}");

let activeId = null;
let isThinking = false;

window.addEventListener("DOMContentLoaded", () => {

loadSettings();
renderChatList();

marked.setOptions({
highlight: (code, lang) => {
if (lang && hljs.getLanguage(lang)) {
return hljs.highlight(code, { language: lang }).value;
}
return hljs.highlightAuto(code).value;
},
breaks: true,
});

document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("newChatBtn").onclick = startNewChat;

document.getElementById("settingsBtn").onclick =
() => document.getElementById("modalOverlay").classList.add("open");

document.getElementById("modalClose").onclick =
() => document.getElementById("modalOverlay").classList.remove("open");

document.getElementById("saveSettings").onclick = saveSettings;

});


async function sendMessage(){

const input = document.getElementById("userInput");
const text  = input.value.trim();

if(!text || isThinking) return;

if(!WORKER_URL){
alert("Set your Worker URL in Settings.");
return;
}

if(!activeId) startNewChat();

appendMessage("user", text);

chats[activeId].messages.push({
role:"user",
content:text
});

input.value="";

setThinking(true);

const thinkingEl = appendThinking();

try{

const model =
document.getElementById("modelSelect").value;

const sysPrompt =
document.getElementById("systemPrompt").value;

const messages = [
{ role:"system", content: sysPrompt },
...chats[activeId].messages
];

const response = await fetch(WORKER_URL,{
method:"POST",
headers:{ "Content-Type":"application/json" },
body: JSON.stringify({ model, messages })
});

const data = await response.json();

thinkingEl.remove();

const aiText =
data.choices?.[0]?.message?.content
|| "No response";

appendMessage("assistant", aiText);

chats[activeId].messages.push({
role:"assistant",
content: aiText
});

saveChats();

}catch(err){

thinkingEl.remove();
appendMessage("error", err.message);

}

setThinking(false);
}



function appendMessage(role, content){

document.getElementById("welcome")?.remove();

const container =
document.getElementById("messages");

const div = document.createElement("div");
div.className = `message ${role}`;

let avatar, contentHtml;

if(role==="user"){
avatar = `<div class="avatar user-avatar">👤</div>`;
contentHtml =
`<div class="message-content">${escapeHtml(content)}</div>`;
}
else if(role==="assistant"){
avatar = `<div class="avatar ai-avatar">D</div>`;
contentHtml =
`<div class="message-content">${marked.parse(content)}</div>`;
}
else{
avatar = `<div class="avatar ai-avatar">!</div>`;
contentHtml =
`<div class="message-content" style="color:#ef4444">${escapeHtml(content)}</div>`;
}

div.innerHTML =
`<div class="message-inner">${avatar}${contentHtml}</div>`;

container.appendChild(div);
container.scrollTop = container.scrollHeight;
return div;
}



function appendThinking(){
const container =
document.getElementById("messages");

const div = document.createElement("div");
div.className="message ai thinking-msg";
div.innerHTML=`
<div class="message-inner">
<div class="avatar ai-avatar">D</div>
<div class="message-content">Thinking</div>
</div>`;
container.appendChild(div);
container.scrollTop = container.scrollHeight;
return div;
}



function startNewChat(){

const id="chat-"+Date.now();

chats[id]={
title:"New Chat",
messages:[]
};

activeId=id;

saveChats();
renderChatList();

document.getElementById("messages").innerHTML="";
document.getElementById("topbarTitle").textContent="New Chat";

}



function renderChatList(){

const list=document.getElementById("chatList");
list.innerHTML="";

Object.entries(chats)
.reverse()
.forEach(([id, chat])=>{

const item=document.createElement("div");
item.className="chat-item";
item.textContent=chat.title;
item.onclick=()=>loadChat(id);
list.appendChild(item);

});
}



function loadChat(id){

activeId=id;

const chat=chats[id];

document.getElementById("topbarTitle").textContent=chat.title;

document.getElementById("messages").innerHTML="";

chat.messages.forEach(msg=>{
appendMessage(msg.role,msg.content);
});

}



function saveChats(){
localStorage.setItem("chats",JSON.stringify(chats));
}



function saveSettings(){
WORKER_URL=document.getElementById("workerUrl").value.trim();
localStorage.setItem("workerUrl",WORKER_URL);
document.getElementById("modalOverlay").classList.remove("open");
}



function loadSettings(){
const url=localStorage.getItem("workerUrl")||"";
document.getElementById("workerUrl").value=url;
WORKER_URL=url;
}



function setThinking(val){
isThinking=val;
document.getElementById("sendBtn").disabled=val;
document.getElementById("statusDot").className="status-dot"+(val?" thinking":"");
document.getElementById("statusText").textContent=val?"Thinking…":"Ready";
}



function escapeHtml(str){
return str
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;");
}