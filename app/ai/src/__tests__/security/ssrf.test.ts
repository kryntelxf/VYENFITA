/**
 * VYENFITA SSRF Guard Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { SSRFGuard } from '../../lib/security/ssrf-guard';

describe('SSRF Guard', () => {
  it('should block localhost', () => {
    expect(SSRFGuard.checkSync('http://localhost/admin').safe).toBe(false);
    expect(SSRFGuard.checkSync('http://127.0.0.1/').safe).toBe(false);
    expect(SSRFGuard.checkSync('http://127.0.0.1:8080/').safe).toBe(false);
  });

  it('should block private IPs', () => {
    expect(SSRFGuard.checkSync('http://10.0.0.1/').safe).toBe(false);
    expect(SSRFGuard.checkSync('http://192.168.1.1/').safe).toBe(false);
    expect(SSRFGuard.checkSync('http://172.16.0.1/').safe).toBe(false);
  });

  it('should block AWS metadata IP', () => {
    expect(SSRFGuard.checkSync('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
  });

  it('should block GCP metadata host', () => {
    expect(SSRFGuard.checkSync('http://metadata.google.internal/').safe).toBe(false);
  });

  it('should block non-HTTP protocols', () => {
    expect(SSRFGuard.checkSync('file:///etc/passwd').safe).toBe(false);
    expect(SSRFGuard.checkSync('gopher://localhost/').safe).toBe(false);
    expect(SSRFGuard.checkSync('ftp://example.com/').safe).toBe(false);
  });

  it('should block non-standard ports', () => {
    expect(SSRFGuard.checkSync('http://example.com:22/').safe).toBe(false);
    expect(SSRFGuard.checkSync('http://example.com:6379/').safe).toBe(false);
  });

  it('should allow public HTTPS URLs', () => {
    expect(SSRFGuard.checkSync('https://api.github.com/').safe).toBe(true);
    expect(SSRFGuard.checkSync('https://example.com/').safe).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(SSRFGuard.checkSync('not-a-url').safe).toBe(false);
    expect(SSRFGuard.checkSync('').safe).toBe(false);
  });
});
