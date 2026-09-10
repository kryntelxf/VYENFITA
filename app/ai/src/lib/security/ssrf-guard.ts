/**
 * VYENFITA SSRF Guard
 * 
 * Blocks Server-Side Request Forgery:
 * - Blocks private IP ranges
 * - Blocks cloud metadata endpoints
 * - Blocks localhost
 * - Blocks non-HTTP(S) protocols
 * 
 * @version 1.0.0
 */

import { URL } from 'url';
import { promises as dns } from 'dns';

// Private IP ranges
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./, // Link-local
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
];

// Blocked hosts
const BLOCKED_HOSTS = [
  'localhost',
  'metadata.google.internal',
  'metadata.aws.internal',
  '169.254.169.254',
];

// Blocked ports (only allow standard web ports)
const ALLOWED_PORTS = [80, 443, 8080, 8443, 3000, 5000];

export interface SSRFCheckResult {
  safe: boolean;
  reason?: string;
}

export class SSRFGuard {
  /**
   * Check if a URL is safe to fetch
   */
  static async check(urlString: string): Promise<SSRFCheckResult> {
    let url: URL;

    try {
      url = new URL(urlString);
    } catch {
      return { safe: false, reason: 'Invalid URL' };
    }

    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: `Protocol not allowed: ${url.protocol}` };
    }

    const hostname = url.hostname.toLowerCase();

    // Block known bad hosts
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { safe: false, reason: 'Blocked host' };
    }

    // Block private IP literals
    if (this.isPrivateIP(hostname)) {
      return { safe: false, reason: 'Private IP not allowed' };
    }

    // Check port
    const port = url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80;
    if (!ALLOWED_PORTS.includes(port)) {
      return { safe: false, reason: `Port ${port} not allowed` };
    }

    // Resolve DNS and check all IPs
    try {
      const addresses = await this.resolveAll(hostname);

      if (addresses.length === 0) {
        return { safe: false, reason: 'DNS resolution failed' };
      }

      for (const addr of addresses) {
        if (this.isPrivateIP(addr)) {
          return {
            safe: false,
            reason: `Host resolves to private IP: ${addr}`,
          };
        }
      }
    } catch (error) {
      return {
        safe: false,
        reason: `DNS lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }

    return { safe: true };
  }

  /**
   * Synchronous check for IP literals (no DNS)
   */
  static checkSync(urlString: string): SSRFCheckResult {
    let url: URL;

    try {
      url = new URL(urlString);
    } catch {
      return { safe: false, reason: 'Invalid URL' };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: `Protocol not allowed: ${url.protocol}` };
    }

    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) {
      return { safe: false, reason: 'Blocked host' };
    }

    if (this.isPrivateIP(hostname)) {
      return { safe: false, reason: 'Private IP not allowed' };
    }

    return { safe: true };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static isPrivateIP(ip: string): boolean {
    return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
  }

  private static async resolveAll(hostname: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const v4 = await dns.resolve4(hostname).catch(() => []);
      results.push(...v4);
    } catch {}

    try {
      const v6 = await dns.resolve6(hostname).catch(() => []);
      results.push(...v6);
    } catch {}

    return results;
  }
}
