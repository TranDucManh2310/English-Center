require('dotenv').config();
const http = require('http');
const { PORT } = require('./src/config/app');
const { handleApi } = require('./src/api/router');
const { sendJson } = require('./src/http/request');
const { serveStatic } = require('./src/http/static-server');
const { handleWsUpgrade } = require('./src/realtime/online-gateway');
const { migrateDatabase } = require('./migrate-db');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url.pathname);
    }
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, message: 'Server error.' });
  }
});

async function start() {
  try {
    await migrateDatabase();
  } catch (error) {
    console.warn('Database migration skipped:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`English Center is running at http://localhost:${PORT}`);
  });
}

start();

server.on('upgrade', (req, socket) => {
  handleWsUpgrade(req, socket).catch(() => socket.destroy());
});
