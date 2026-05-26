const crypto = require('crypto');
const db = require('./db');

const DEMO_USERS = [
  { email: 'nhom3@englishcenter.edu.vn', password: 'admin123C', name: 'Quan Tri Vien', role: 'admin' },
  { email: 'demo@englishcenter.vn', password: '123456', name: 'Giao Vien Demo', role: 'teacher' },
  { email: 'giaovien@englishcenter.vn', password: 'giaovien123', name: 'Nguyen Thi Giao Vien', role: 'teacher' },
  { email: 'test@gmail.com', password: 'password', name: 'Hoc Sinh Demo', role: 'student' }
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seedDemoUsers() {
  for (const item of DEMO_USERS) {
    const email = normalizeEmail(item.email);
    const exists = await db.findUserByEmail(email);
    if (exists) continue;

    await db.createUser({
      id: crypto.randomUUID(),
      email,
      name: item.name,
      role: item.role,
      passwordHash: hashPassword(item.password),
      enrolled: []
    });
  }
}

if (require.main === module) {
  seedDemoUsers()
    .then(() => {
      console.log('Seeded demo users.');
      process.exit(0);
    })
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { seedDemoUsers };
