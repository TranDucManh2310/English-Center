const crypto = require('crypto');
const db = require('../repositories');
const { WS_GUID } = require('../config/app');
const { parseCookies } = require('../http/request');
const { publicUser } = require('../services/user-service');

const onlineClients = new Map();

function wsAcceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function encodeWsFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const length = body.length;
  if (length < 126) return Buffer.concat([Buffer.from([0x81, length]), body]);
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, body]);
}

function decodeWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  let offset = 2;
  let length = buffer[1] & 0x7f;
  const masked = Boolean(buffer[1] & 0x80);
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  if (!masked || buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    payload[index] = buffer[offset + index] ^ mask[index % 4];
  }
  return { opcode, payload: payload.toString('utf8') };
}

async function getRealtimeSnapshot() {
  const dashboard = await db.getAdminDashboard();
  return {
    type: 'online',
    online: dashboard.online,
    users: dashboard.recentOnlineUsers || []
  };
}

function sendWs(socket, payload) {
  if (!socket.destroyed) socket.write(encodeWsFrame(payload));
}

async function broadcastOnline() {
  const payload = await getRealtimeSnapshot().catch(error => ({
    type: 'error',
    message: error.message
  }));
  onlineClients.forEach(client => sendWs(client.socket, payload));
}

async function handleWsUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws/online') {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get('token') || parseCookies(req.headers.cookie).ec_auth_token || '';
  const user = token ? await db.findSessionUser(token) : null;
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${wsAcceptKey(key)}`,
    '\r\n'
  ].join('\r\n'));

  const clientId = crypto.randomUUID();
  onlineClients.set(clientId, { socket, token, userId: user.id });
  await db.touchSession(token, url.searchParams.get('page') || '');
  sendWs(socket, { type: 'hello', user: publicUser(user) });
  await broadcastOnline();

  socket.on('data', async chunk => {
    const frame = decodeWsFrame(chunk);
    if (!frame) return;
    if (frame.opcode === 0x8) {
      socket.end();
      return;
    }
    if (frame.opcode !== 0x1) return;
    const message = JSON.parse(frame.payload || '{}');
    if (message.type === 'ping' || message.type === 'presence') {
      await db.touchSession(token, message.page || '');
      sendWs(socket, { type: 'pong', at: new Date().toISOString() });
      await broadcastOnline();
    }
  });

  socket.on('close', () => {
    onlineClients.delete(clientId);
    setTimeout(() => broadcastOnline().catch(() => {}), 1000);
  });
  socket.on('error', () => {
    onlineClients.delete(clientId);
  });
}

module.exports = {
  handleWsUpgrade,
  broadcastOnline
};
