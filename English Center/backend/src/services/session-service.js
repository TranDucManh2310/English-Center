const crypto = require('crypto');
const db = require('../repositories');

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.createSession(token, userId);
  return token;
}

module.exports = {
  createSession
};
