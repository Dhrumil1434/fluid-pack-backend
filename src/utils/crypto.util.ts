// Basic crypto utilities for data encryption
import crypto from 'crypto';

const ENCRYPTION_KEY =
  process.env['ENCRYPTION_KEY'] || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a string using AES-256-CBC
 */
export function encryptString(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Encrypt an object by converting to JSON and encrypting
 */
export function encryptObject(obj: Record<string, unknown>): string {
  const jsonString = JSON.stringify(obj);
  return encryptString(jsonString);
}

/**
 * Generate HMAC for deterministic hashing
 */
export function hmacDeterministic(input: string): string {
  return crypto
    .createHmac('sha256', ENCRYPTION_KEY)
    .update(input)
    .digest('hex');
}
