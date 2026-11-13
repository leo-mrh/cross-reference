const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

async function hash(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 32);
  const keyBase64 = derivedKey.toString('base64');
  console.log(`FULL_HASH:${salt}:${keyBase64}`);
}

hash('123456');
