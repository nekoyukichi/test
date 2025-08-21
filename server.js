const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// minimal static server
const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(urlPath.split('?')[0]));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    const map = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
});

// ws server
const wss = new WebSocket.Server({ server });
const clients = new Map(); // ws -> {id, name}

function uid() { return Math.random().toString(36).slice(2, 9); }
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}
function onlineCount() { return [...wss.clients].filter(c => c.readyState === WebSocket.OPEN).length; }

wss.on('connection', (ws) => {
  const me = { id: uid(), name: `Guest-${Math.floor(Math.random()*1000)}` };
  clients.set(ws, me);

  ws.send(JSON.stringify({ type:'hello', id: me.id, name: me.name }));
  ws.send(JSON.stringify({ type:'system', text:'接続しました。名前は右上で変更できます。' }));
  broadcast({ type:'presence', online: onlineCount() });

  ws.on('message', (raw) => {
    let data = {};
    try { data = JSON.parse(raw.toString()); } catch { return; }

    if (data.type === 'rename') {
      const old = me.name;
      me.name = String(data.name||'').slice(0,32) || me.name;
      broadcast({ type:'notice', text: `${old} が ${me.name} に変更しました` });
      return;
    }

    if (data.type === 'typing') {
      broadcast({ type:'typing', id: me.id, name: me.name });
      return;
    }

    if (data.type === 'msg') {
      const text = String(data.text||'').slice(0, 2000);
      if (!text.trim()) return;
      broadcast({ type:'msg', id: me.id, name: me.name, text, ts: Date.now() });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type:'presence', online: onlineCount() });
  });
});

setInterval(() => {
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.ping();
}, 30000);

server.listen(PORT, () => {
  console.log(`HTTP http://localhost:${PORT}`);
});
