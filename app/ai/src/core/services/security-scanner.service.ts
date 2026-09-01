/**
 * VYENFITA Security Scanner Service
 * 
 * Scans applications for security vulnerabilities
 * - SAST (Static Application Security Testing)
 * - DAST (Dynamic Application Security Testing)
 * - Dependency scanning
 * - Secret scanning
 * - Compliance scanning
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface SecurityScan {
  id: string;
  applicationId: string;
  type: 'sast' | 'dast' | 'dependency' | 'secret' | 'compliance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  findings: SecurityFinding[];
  summary: SecuritySummary;
  startedAt: Date;
  completedAt?: Date;
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: string;
  recommendation: string;
  cwe?: string;
  cve?: string;
  references?: string[];
  status: 'open' | 'resolved' | 'false_positive' | 'accepted';
}

export interface SecuritySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export class SecurityScannerService {
  private scans: Map<string, SecurityScan>;

  constructor() {
    this.scans = new Map();
  }

  /**
   * Run a security scan
   */
  async scan(applicationId: string, type: SecurityScan['type']): Promise<SecurityScan> {
    const scan: SecurityScan = {
      id: uuidv4(),
      applicationId,
      type,
      status: 'running',
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        score: 0,
        grade: 'F',
      },
      startedAt: new Date(),
    };

    this.scans.set(scan.id, scan);

    // Simulate scan
    await this.simulateScan(scan);

    return scan;
  }

  /**
   * Simulate a security scan
   */
  private async simulateScan(scan: SecurityScan): Promise<void> {
    // Simulate scan duration
    await this.sleep(3000);

    // Generate sample findings based on scan type
    const findings = this.generateFindings(scan.type);
    scan.findings = findings;

    // Calculate summary
    const summary: SecuritySummary = {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
      score: this.calculateScore(findings),
      grade: this.calculateGrade(findings),
    };

    scan.summary = summary;
    scan.status = 'completed';
    scan.completedAt = new Date();

    this.scans.set(scan.id, scan);
  }

  /**
   * Generate findings based on scan type
   */
  private generateFindings(type: SecurityScan['type']): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Common findings for all scans
    findings.push({
      id: uuidv4(),
      severity: 'medium',
      title: 'Missing Input Validation',
      description: 'User input is not properly validated before being used in queries.',
      location: 'src/api/users.ts:42',
      recommendation: 'Implement input validation using a validation library like Joi or Zod.',
      cwe: 'CWE-20',
      status: 'open',
      references: ['https://owasp.org/Top10/A01_2021-Broken_Access_Control/'],
    });

    // Type-specific findings
    if (type === 'sast') {
      findings.push({
        id: uuidv4(),
        severity: 'critical',
        title: 'SQL Injection Vulnerability',
        description: 'User input is concatenated directly into SQL queries.',
        location: 'src/db/queries.ts:15',
        recommendation: 'Use parameterized queries or an ORM.',
        cwe: 'CWE-89',
        cve: 'CVE-2024-12345',
        status: 'open',
        references: ['https://owasp.org/Top10/A03_2021-Injection/'],
      });

      findings.push({
        id: uuidv4(),
        severity: 'high',
        title: 'Hardcoded Credentials',
        description: 'API keys are hardcoded in the source code.',
        location: 'src/config/secrets.ts:5',
        recommendation: 'Store credentials in environment variables or a secrets manager.',
        cwe: 'CWE-798',
        status: 'open',
      });
    }

    if (type === 'dependency') {
      findings.push({
        id: uuidv4(),
        severity: 'high',
        title: 'Vulnerable Dependency: axios@1.6.0',
        description: 'axios version 1.6.0 has a known vulnerability.',
        location: 'package.json',
        recommendation: 'Upgrade to axios@1.6.1 or later.',
        cve: 'CVE-2024-12345',
        status: 'open',
        references: ['https://github.com/axios/axios/security/advisories/GHSA-xxxx'],
      });
    }

    if (type === 'secret') {
      findings.push({
        id: uuidv4(),
        severity: 'critical',
        title: 'AWS Access Key Exposed',
        description: 'AWS access key was found in commit history.',
        location: 'commit: abc123def456',
        recommendation: 'Revoke the access key immediately and rotate credentials.',
        status: 'open',
        references: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'],
      });
    }

    if (type === 'compliance') {
      findings.push({
        id: uuidv4(),
        severity: 'medium',
        title: 'GDPR: Data Retention Not Defined',
        description: 'No data retention policy is defined in the application.',
        location: 'N/A',
        recommendation: 'Implement a data retention policy and auto-delete old records.',
        status: 'open',
      });
    }

    // Randomize findings
    const numFindings = Math.floor(Math.random() * 3) + 2;
    return findings.slice(0, numFindings);
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateScore(findings: SecurityFinding[]): number {
    const weights = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5,
      info: 0,
    };

    let score = 100;
    for (const finding of findings) {
      score -= weights[finding.severity];
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate security grade
   */
  private calculateGrade(findings: SecurityFinding[]): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.calculateScore(findings);
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get a security scan
   */
  getScan(id: string): SecurityScan | undefined {
    return this.scans.get(id);
  }

  /**
   * Get all scans for an application
   */
  getScans(applicationId: string): SecurityScan[] {
    const result: SecurityScan[] = [];
    for (const scan of this.scans.values()) {
      if (scan.applicationId === applicationId) {
        result.push(scan);
      }
    }
    return result.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Get latest scan for an application
   */
  getLatestScan(applicationId: string): SecurityScan | undefined {
    const scans = this.getScans(applicationId);
    return scans.length > 0 ? scans[0] : undefined;
  }

  /**
   * Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
