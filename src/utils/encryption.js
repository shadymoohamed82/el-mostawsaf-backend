const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY       = Buffer.from(
  process.env.DB_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)
);

function encrypt(text) {
  if (!text) return null;
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv        = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };