/**
 * VYENFITA Secret Service
 * 
 * AES-256-GCM encryption for secrets stored in database
 * - Encrypt before storing
 * - Decrypt on retrieval
 * - Never log plaintext
 * 
 * @version 1.0.0
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export class SecretService {
  private key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY must be set and at least 32 characters long'
      );
    }

    // Derive a 32-byte key from the provided key
    this.key = createHash('sha256').update(encryptionKey).digest();
  }

  /**
   * Encrypt a plaintext secret
   * Returns: base64(iv || authTag || ciphertext)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Pack: iv (16) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);

    return packed.toString('base64');
  }

  /**
   * Decrypt an encrypted secret
   */
  decrypt(encryptedBase64: string): string {
    const packed = Buffer.from(encryptedBase64, 'base64');

    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data');
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash for comparison (one-way)
   */
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

let instance: SecretService | undefined;

export function getSecretService(): SecretService {
  if (!instance) {
    instance = new SecretService();
  }
  return instance;
}

/**
 * Mask a secret for display/logging
 */
export function maskSecret(value: string, visibleChars: number = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars * 2) return '*'.repeat(value.length);
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  return `${start}${'*'.repeat(Math.min(20, value.length - visibleChars * 2))}${end}`;
      }
