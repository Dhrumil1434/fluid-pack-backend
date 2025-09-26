import crypto from 'crypto';

// AES-256-GCM symmetric encryption utilities with deterministic HMAC hashing

const ENC_ALGO = 'aes-256-gcm';
const HMAC_ALGO = 'sha256';

function getKey(): Buffer {
  const keyB64 = process.env.DATA_ENC_KEY;
  if (!keyB64) {
    throw new Error('DATA_ENC_KEY is not set');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENC_KEY must be 32 bytes base64 (AES-256)');
  }
  return key;
}

export function encryptString(
  plainText: string | null | undefined,
): string | null | undefined {
  if (plainText == null) return plainText;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store as compact string: iv:tag:data (all base64)
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

export function decryptString(
  encText: string | null | undefined,
): string | null | undefined {
  if (encText == null) return encText;
  const parts = String(encText).split(':');
  if (parts.length !== 3) {
    // Not an encrypted payload, return as-is
    return encText;
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function encryptObject(obj: Record<string, unknown>): string {
  return encryptString(JSON.stringify(obj ?? {}));
}

export function decryptObject(enc: string): Record<string, unknown> {
  const dec = decryptString(enc);
  try {
    return JSON.parse(String(dec));
  } catch {
    return {};
  }
}

// Deterministic hash for searches/uniqueness without exposing plaintext
export function hmacDeterministic(value: string): string {
  const key = getKey();
  return crypto.createHmac(HMAC_ALGO, key).update(value).digest('hex');
}
