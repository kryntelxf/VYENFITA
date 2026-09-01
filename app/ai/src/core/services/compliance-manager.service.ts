/**
 * VYENFITA Compliance Manager Service
 * 
 * Manages compliance requirements
 * - GDPR compliance
 * - SOC2 compliance
 * - HIPAA compliance
 * - ISO 27001 compliance
 * - Data privacy
 * - Data retention
 * - Audit trail
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  requirements: ComplianceRequirement[];
  status: 'not_started' | 'in_progress' | 'compliant' | 'non_compliant';
  assessmentDate?: Date;
  validUntil?: Date;
}

export interface ComplianceRequirement {
  id: string;
  frameworkId: string;
  name: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'implemented' | 'verified' | 'non_compliant';
  evidence: ComplianceEvidence[];
  notes: string;
  implementedAt?: Date;
  verifiedAt?: Date;
}

export interface ComplianceEvidence {
  id: string;
  requirementId: string;
  type: 'document' | 'screenshot' | 'log' | 'configuration' | 'policy';
  name: string;
  description: string;
  url?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface DataPrivacyPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  dataCategories: DataCategory[];
  retentionPeriods: RetentionPolicy[];
  userConsents: ConsentRecord[];
  version: string;
  effectiveDate: Date;
  status: 'draft' | 'active' | 'archived';
}

export interface DataCategory {
  id: string;
  name: string;
  description: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionDays: number;
  processingPurpose: string;
  legalBasis: string;
}

export interface RetentionPolicy {
  id: string;
  dataType: string;
  retentionDays: number;
  action: 'archive' | 'delete' | 'anonymize';
  schedule: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  givenAt: Date;
  revokedAt?: Date;
  status: 'active' | 'revoked';
  ipAddress: string;
  userAgent: string;
}

export class ComplianceManagerService {
  private frameworks: Map<string, ComplianceFramework>;
  private policies: Map<string, DataPrivacyPolicy>;
  private consents: Map<string, ConsentRecord>;

  constructor() {
    this.frameworks = new Map();
    this.policies = new Map();
    this.consents = new Map();

    // Initialize default frameworks
    this.initializeDefaultFrameworks();
  }

  /**
   * Initialize default compliance frameworks
   */
  private initializeDefaultFrameworks(): void {
    // GDPR
    const gdpr: ComplianceFramework = {
      id: 'gdpr',
      name: 'GDPR',
      version: 'EU/2016/679',
      description: 'General Data Protection Regulation',
      requirements: [
        {
          id: 'gdpr-1',
          frameworkId: 'gdpr',
          name: 'Data Protection Policy',
          description: 'Implement data protection policies',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
        {
          id: 'gdpr-2',
          frameworkId: 'gdpr',
          name: 'Data Subject Rights',
          description: 'Enable users to access, correct, and delete their data',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
        {
          id: 'gdpr-3',
          frameworkId: 'gdpr',
          name: 'Data Breach Notification',
          description: 'Implement breach detection and notification process',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
        {
          id: 'gdpr-4',
          frameworkId: 'gdpr',
          name: 'Data Retention',
          description: 'Implement data retention and deletion policies',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
      ],
      status: 'not_started',
    };
    this.frameworks.set('gdpr', gdpr);

    // SOC2
    const soc2: ComplianceFramework = {
      id: 'soc2',
      name: 'SOC2',
      version: 'Type II',
      description: 'Service Organization Control 2',
      requirements: [
        {
          id: 'soc2-1',
          frameworkId: 'soc2',
          name: 'Security Controls',
          description: 'Implement security controls and monitoring',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
        {
          id: 'soc2-2',
          frameworkId: 'soc2',
          name: 'Availability Controls',
          description: 'Implement availability and disaster recovery',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
        {
          id: 'soc2-3',
          frameworkId: 'soc2',
          name: 'Incident Response',
          description: 'Implement incident response procedure',
          status: 'not_started',
          evidence: [],
          notes: '',
        },
      ],
      status: 'not_started',
    };
    this.frameworks.set('soc2', soc2);
  }

  /**
   * Get all compliance frameworks
   */
  getFrameworks(): ComplianceFramework[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get a specific framework
   */
  getFramework(id: string): ComplianceFramework | undefined {
    return this.frameworks.get(id);
  }

  /**
   * Update a framework requirement
   */
  updateRequirement(
    frameworkId: string,
    requirementId: string,
    updates: Partial<ComplianceRequirement>
  ): boolean {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) return false;

    const requirement = framework.requirements.find(r => r.id === requirementId);
    if (!requirement) return false;

    Object.assign(requirement, updates);

    // Update framework status
    this.updateFrameworkStatus(frameworkId);

    return true;
  }

  /**
   * Add evidence to a requirement
   */
  addEvidence(
    frameworkId: string,
    requirementId: string,
    evidence: Omit<ComplianceEvidence, 'id' | 'requirementId' | 'uploadedAt'>
  ): boolean {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) return false;

    const requirement = framework.requirements.find(r => r.id === requirementId);
    if (!requirement) return false;

    const newEvidence: ComplianceEvidence = {
      id: uuidv4(),
      requirementId,
      ...evidence,
      uploadedAt: new Date(),
    };

    requirement.evidence.push(newEvidence);
    return true;
  }

  /**
   * Update framework status based on requirements
   */
  private updateFrameworkStatus(frameworkId: string): void {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) return;

    const requirements = framework.requirements;
    const total = requirements.length;
    const implemented = requirements.filter(r => r.status === 'implemented' || r.status === 'verified').length;
    const verified = requirements.filter(r => r.status === 'verified').length;

    if (verified === total) {
      framework.status = 'compliant';
      framework.assessmentDate = new Date();
      framework.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (implemented > 0) {
      framework.status = 'in_progress';
    } else {
      framework.status = 'not_started';
    }

    this.frameworks.set(frameworkId, framework);
  }

  /**
   * Create a data privacy policy
   */
  createPrivacyPolicy(
    tenantId: string,
    name: string,
    description: string,
    dataCategories: Omit<DataCategory, 'id'>[],
    retentionPeriods: Omit<RetentionPolicy, 'id'>[]
  ): DataPrivacyPolicy {
    const policy: DataPrivacyPolicy = {
      id: uuidv4(),
      tenantId,
      name,
      description,
      dataCategories: dataCategories.map(c => ({
        id: uuidv4(),
        ...c,
      })),
      retentionPeriods: retentionPeriods.map(r => ({
        id: uuidv4(),
        ...r,
      })),
      userConsents: [],
      version: '1.0.0',
      effectiveDate: new Date(),
      status: 'active',
    };

    this.policies.set(policy.id, policy);
    return policy;
  }

  /**
   * Get privacy policies
   */
  getPrivacyPolicies(tenantId: string): DataPrivacyPolicy[] {
    const result: DataPrivacyPolicy[] = [];
    for (const policy of this.policies.values()) {
      if (policy.tenantId === tenantId) {
        result.push(policy);
      }
    }
    return result;
  }

  /**
   * Record user consent
   */
  recordConsent(
    userId: string,
    purpose: string,
    ipAddress: string,
    userAgent: string
  ): ConsentRecord {
    const consent: ConsentRecord = {
      id: uuidv4(),
      userId,
      purpose,
      givenAt: new Date(),
      status: 'active',
      ipAddress,
      userAgent,
    };

    this.consents.set(consent.id, consent);
    return consent;
  }

  /**
   * Revoke user consent
   */
  revokeConsent(consentId: string): boolean {
    const consent = this.consents.get(consentId);
    if (!consent) return false;

    consent.status = 'revoked';
    consent.revokedAt = new Date();
    this.consents.set(consentId, consent);
    return true;
  }

  /**
   * Get user consents
   */
  getUserConsents(userId: string): ConsentRecord[] {
    const result: ConsentRecord[] = [];
    for (const consent of this.consents.values()) {
      if (consent.userId === userId) {
        result.push(consent);
      }
    }
    return result;
  }

  /**
   * Check if a user has active consent
   */
  hasConsent(userId: string, purpose: string): boolean {
    for (const consent of this.consents.values()) {
      if (consent.userId === userId && consent.purpose === purpose && consent.status === 'active') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get compliance status summary
   */
  getComplianceSummary(tenantId: string): {
    totalFrameworks: number;
    compliantFrameworks: number;
    inProgressFrameworks: number;
    overallStatus: 'compliant' | 'in_progress' | 'non_compliant';
    completionPercentage: number;
  } {
    const frameworks = Array.from(this.frameworks.values());
    const total = frameworks.length;
    const compliant = frameworks.filter(f => f.status === 'compliant').length;
    const inProgress = frameworks.filter(f => f.status === 'in_progress').length;

    // Calculate completion percentage
    let totalRequirements = 0;
    let completedRequirements = 0;
    for (const framework of frameworks) {
      totalRequirements += framework.requirements.length;
      completedRequirements += framework.requirements.filter(
        r => r.status === 'implemented' || r.status === 'verified'
      ).length;
    }

    const completionPercentage = totalRequirements > 0
      ? (completedRequirements / totalRequirements) * 100
      : 0;

    let overallStatus: 'compliant' | 'in_progress' | 'non_compliant' = 'in_progress';
    if (completedRequirements === totalRequirements && compliant === total) {
      overallStatus = 'compliant';
    } else if (completedRequirements === 0) {
      overallStatus = 'non_compliant';
    }

    return {
      totalFrameworks: total,
      compliantFrameworks: compliant,
      inProgressFrameworks: inProgress,
      overallStatus,
      completionPercentage,
    };
  }
  }
