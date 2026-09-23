/**
 * VYENFITA Integration Framework
 * 
 * Base interface for all integrations.
 * 
 * @version 1.0.0
 */

export type IntegrationType =
  | 'salesforce'
  | 'hubspot'
  | 'slack'
  | 'jira'
  | 'microsoft365'
  | 'google-workspace'
  | 'github'
  | 'stripe'
  | 'zendesk'
  | 'intercom';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface IntegrationProvider {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  category: 'crm' | 'communication' | 'productivity' | 'devtools' | 'payment' | 'support';
  
  // OAuth config
  authType: 'oauth2' | 'api-key' | 'basic' | 'bearer';
  authScopes: string[];
  authUrl?: string;
  tokenUrl?: string;
  
  // Capabilities
  capabilities: IntegrationCapability[];
  
  // Actions
  actions: IntegrationAction[];
  
  // Triggers (webhooks)
  triggers: IntegrationTrigger[];
}

export interface IntegrationCapability {
  name: string;
  description: string;
}

export interface IntegrationAction {
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface IntegrationTrigger {
  name: string;
  description: string;
  event: string;
}

export interface IntegrationConnection {
  id: string;
  tenantId: string;
  integrationType: IntegrationType;
  name: string;
  status: IntegrationStatus;
  
  // Encrypted credentials
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: Date;
  scopes?: string[];
  
  // Config
  config: Record<string, any>;
  
  // Metadata
  connectedBy: string;
  connectedAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  lastError?: string;
}

export interface IntegrationContext {
  tenantId: string;
  connectionId: string;
  userId?: string;
}

export interface IntegrationResult {
  success: boolean;
  data?: any;
  error?: string;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
  };
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

// ============================================================
// BASE ADAPTER
// ============================================================

export abstract class IntegrationAdapter {
  abstract readonly provider: IntegrationProvider;
  
  /**
   * Get OAuth authorization URL
   */
  abstract getAuthorizationUrl(
    tenantId: string,
    redirectUri: string,
    state: string
  ): Promise<string>;
  
  /**
   * Exchange code for tokens
   */
  abstract exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: string[];
  }>;
  
  /**
   * Refresh access token
   */
  abstract refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  
  /**
   * Execute an action
   */
  abstract executeAction(
    actionName: string,
    input: any,
    connection: IntegrationConnection
  ): Promise<IntegrationResult>;
  
  /**
   * Test connection health
   */
  abstract testConnection(
    connection: IntegrationConnection
  ): Promise<{ healthy: boolean; error?: string }>;
  
  /**
   * Handle webhook payload (optional)
   */
  async handleWebhook?(payload: any, signature?: string): Promise<any>;
}
