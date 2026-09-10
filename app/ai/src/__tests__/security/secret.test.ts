/**
 * VYENFITA Secret Service Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { SecretService, maskSecret } from '../../lib/security/secret.service';

describe('Secret Service', () => {
  let service: SecretService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-characters-long';
    service = new SecretService();
  });

  it('should encrypt and decrypt', () => {
    const plaintext = 'my-secret-value';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time (IV randomness)', () => {
    const plaintext = 'my-secret-value';
    const enc1 = service.encrypt(plaintext);
    const enc2 = service.encrypt(plaintext);

    expect(enc1).not.toBe(enc2);

    // Both decrypt to same value
    expect(service.decrypt(enc1)).toBe(plaintext);
    expect(service.decrypt(enc2)).toBe(plaintext);
  });

  it('should fail with tampered data', () => {
    const encrypted = service.encrypt('secret');
    const tampered = encrypted.substring(0, encrypted.length - 4) + 'XXXX';

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should mask secrets for display', () => {
    expect(maskSecret('sk-1234567890abcdef')).toBe('sk-1***********cdef');
    expect(maskSecret('abc')).toBe('***');
    expect(maskSecret('')).toBe('');
  });
});
