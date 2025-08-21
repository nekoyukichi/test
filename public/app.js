const $ = (s)=>document.querySelector(s);
const messages = $('#messages');
const input = $('#input');
const sendBtn = $('#send');
const nameInput = $('#name');
const statusEl = $('#status');
const onlineEl = $('#online');

let ws;
let typingTimer;
let myId = null;

function connect() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener('open', () => {
    statusEl.textContent = '接続済み';
    statusEl.className = 'ok';
    if (nameInput.value.trim()) rename(nameInput.value.trim());
  });
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'hello') {
      myId = data.id;
    } else if (data.type === 'msg') {
      addMessage({ author: `${data.name}` , text: data.text, ts: data.ts, mine: data.id === myId });
    } else if (data.type === 'notice' || data.type === 'system') {
      addNotice(data.text);
    } else if (data.type === 'presence') {
      onlineEl.textContent = `オンライン ${data.online}`;
    } else if (data.type === 'typing') {
      showTyping(`${data.name} が入力中...`);
    }
  });
  ws.addEventListener('close', () => {
    statusEl.textContent = '切断（自動再接続）';
    statusEl.className = 'warn';
    setTimeout(connect, 1000);
  });
}

function addMessage({ author, text, ts=Date.now(), mine=false }) {
  const div = document.createElement('div');
  div.className = 'msg ' + (mine ? 'mine' : 'other');
  const time = new Date(ts).toLocaleTimeString();
  const avatar = initials(author);
  div.innerHTML = `
    ${mine ? '' : `<div class="avatar" aria-hidden="true">${avatar}</div>`}
    <div class="bubble">
      ${mine ? '' : `<div class="author">${escapeHtml(author)}</div>`}
      <div class="body">${linkify(escapeHtml(text)).replace(/\n/g, '<br>')}</div>
      <div class="time">${time}</div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
function addNotice(text) {
  const div = document.createElement('div');
  div.className = 'notice';
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
function showTyping(text) {
  let el = document.querySelector('.typing');
  if (!el) {
    el = document.createElement('div');
    el.className = 'typing';
    messages.appendChild(el);
  }
  el.textContent = text;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(()=>{ el.remove(); }, 1200);
  messages.scrollTop = messages.scrollHeight;
}

function send() {
  const v = input.value;
  if (!v.trim()) return;
  ws?.send(JSON.stringify({ type:'msg', text: v }));
  input.value = '';
  input.style.height = '40px';
}
function rename(v) {
  ws?.send(JSON.stringify({ type:'rename', name: v }));
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
input.addEventListener('input', () => {
  autoResize(input, 40, 160);
  ws?.send(JSON.stringify({ type:'typing' }));
});
sendBtn.addEventListener('click', send);
nameInput.addEventListener('change', () => {
  const v = nameInput.value.trim().slice(0,32);
  if (v) rename(v);
});

function autoResize(el, min=40, max=160) {
  el.style.height = 'auto';
  el.style.height = Math.max(min, Math.min(max, el.scrollHeight)) + 'px';
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }
function linkify(s){ return s.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function initials(name){
  const p = (name||'').trim().split(/\s+/);
  const a = (p[0]?.[0]||'').toUpperCase();
  const b = (p[1]?.[0]||'').toUpperCase();
  return (a+b)||'U';
}

connect();
