const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const ROOT = __dirname;
const FRONTEND_DIR = path.resolve(ROOT, '..', 'frontend');
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function createUserRecord(user) {
  const now = new Date().toISOString();
  const passwordHash = hashPassword(user.password);
  return {
    id: crypto.randomUUID(),
    email: normalizeEmail(user.email),
    name: user.name,
    role: user.role || roleFromEmail(user.email),
    phone: user.phone || '',
    education: user.education || '',
    experience: user.experience || '',
    motivation: user.motivation || '',
    schedule: user.schedule || '',
    newsletter: Boolean(user.newsletter),
    enrolled: user.enrolled || [],
    passwordHash,
    createdAt: now,
    updatedAt: now
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function roleFromEmail(email) {
  return normalizeEmail(email).endsWith('@englishcenter.vn') ? 'teacher' : 'student';
}

function publicUser(user) {
  let enrolled = user.enrolled || [];
  if (typeof enrolled === 'string') {
    try {
      enrolled = JSON.parse(enrolled);
    } catch {
      enrolled = [];
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone || '',
    education: user.education || '',
    experience: user.experience || '',
    motivation: user.motivation || '',
    schedule: user.schedule || '',
    newsletter: Boolean(user.newsletter),
    enrolled
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        const params = new URLSearchParams(body);
        resolve(Object.fromEntries(params.entries()));
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function findSessionUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  return db.findSessionUser(token);
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    try {
      await db.pingDatabase();
      return sendJson(res, 200, {
        ok: true,
        name: 'English Center API',
        database: db.DB_CONFIG.database,
        time: new Date().toISOString()
      });
    } catch (error) {
      return sendJson(res, 503, {
        ok: false,
        name: 'English Center API',
        database: db.DB_CONFIG.database,
        message: 'Khong ket noi duoc MySQL. Hay bat MySQL trong XAMPP va import backend/database.sql.',
        detail: error.message
      });
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const name = String(body.name || `${firstName} ${lastName}`.trim() || email).trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return sendJson(res, 400, { ok: false, message: 'Email khong hop le.' });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { ok: false, message: 'Mat khau phai co it nhat 6 ky tu.' });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return sendJson(res, 409, { ok: false, message: 'Email da duoc dang ky.' });
    }

    const userRecord = createUserRecord({
      email,
      password,
      name,
      role: body.role === 'teacher' || body.role === 'admin' ? body.role : 'student',
      phone: body.phone,
      education: body.education,
      experience: body.experience,
      motivation: body.motivation,
      schedule: body.schedule,
      newsletter: body.newsletter
    });
    const user = await db.createUser(userRecord);

    const token = await createSession(user.id);
    return sendJson(res, 201, { ok: true, token, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const user = await db.findUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { ok: false, message: 'Email hoac mat khau khong dung.' });
    }

    const token = await createSession(user.id);
    return sendJson(res, 200, { ok: true, token, user: publicUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = await findSessionUser(req);
    if (!user) return sendJson(res, 401, { ok: false, message: 'Chua dang nhap.' });
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getBearerToken(req);
    if (token) await db.deleteSession(token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/contact') {
    const body = await parseBody(req);
    await db.createSubmission({
      id: crypto.randomUUID(),
      type: body.type || 'contact',
      data: body
    });
    return sendJson(res, 201, { ok: true, message: 'Da ghi nhan thong tin.' });
  }

  return sendJson(res, 404, { ok: false, message: 'API endpoint not found.' });
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.createSession(token, userId);
  return token;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  filePath = filePath.replace(/^\/+/, '');
  const absolutePath = path.resolve(FRONTEND_DIR, filePath);
  const relativePath = path.relative(FRONTEND_DIR, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(absolutePath, (error, stats) => {
    if (error || !stats.isFile()) {
      const notFoundPath = path.join(FRONTEND_DIR, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(notFoundPath).pipe(res);
    }

    const type = MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

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

server.listen(PORT, () => {
  console.log(`English Center is running at http://localhost:${PORT}`);
});
