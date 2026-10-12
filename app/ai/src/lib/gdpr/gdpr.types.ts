/**
 * VYENFITA GDPR Types
 * 
 * Types for GDPR-compliant data export and deletion.
 * 
 * @version 1.0.0
 */

export interface UserDataExport {
  metadata: {
    exportedAt: string;
    userId: string;
    tenantId: string;
    version: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    status: string;
    emailVerified: boolean;
    preferredLanguage: string;
    timezone: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
  memberships: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    roleName: string;
    status: string;
    joinedAt: string | null;
  }>;
  sessions: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    eventType: string;
    action: string;
    resource: string;
    resourceId: string | null;
    status: string;
    timestamp: string;
    details: Record<string, any>;
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    details: Record<string, any>;
    timestamp: string;
  }>;
  usageRecords: Array<{
    id: string;
    service: string;
    operation: string;
    quantity: number;
    unit: string;
    timestamp: string;
  }>;
  consents: Array<{
    id: string;
    purpose: string;
    status: string;
    givenAt: string;
    revokedAt: string | null;
  }>;
}

export interface TenantDataExport {
  metadata: {
    exportedAt: string;
    tenantId: string;
    exportedBy: string;
    version: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    plan: string;
    status: string;
    settings: Record<string, any>;
    createdAt: string;
  };
  counts: {
    members: number;
    applications: number;
    workflows: number;
    deployments: number;
    integrations: number;
    marketplaceTemplates: number;
  };
  members: Array<{
    userId: string;
    email: string;
    name: string | null;
    roleName: string;
    status: string;
    joinedAt: string | null;
  }>;
}

export type ExportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  tenantId: string;
  userId: string;
  type: 'user' | 'tenant';
  status: ExportJobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  error: string | null;
  sizeBytes: number | null;
}

export interface DeleteUserRequest {
  confirmEmail: string;
  reason?: string;
}

export interface DeleteUserResult {
  success: boolean;
  scheduledDeletionAt: string;
  gracePeriodDays: number;
  message: string;
  }
