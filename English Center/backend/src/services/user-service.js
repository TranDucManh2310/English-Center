const crypto = require('crypto');

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
    enrolled,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastActiveAt: user.lastActiveAt || null
  };
}

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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || crypto.randomUUID().slice(0, 8);
}

module.exports = {
  createUserRecord,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  roleFromEmail,
  publicUser,
  slugify
};
