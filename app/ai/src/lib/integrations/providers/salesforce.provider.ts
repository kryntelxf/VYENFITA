/**
 * VYENFITA Salesforce Integration
 * 
 * @version 1.0.0
 */

import axios from 'axios';
import { SecretService } from '../../security/secret.service';
import {
  IntegrationAdapter,
  IntegrationProvider,
  IntegrationConnection,
  IntegrationResult,
  IntegrationError,
  IntegrationContext,
} from '../integration.interface';
import { logger } from '../../observability/logger';

const SALESFORCE_API_VERSION = 'v59.0';

export class SalesforceAdapter extends IntegrationAdapter {
  readonly provider: IntegrationProvider = {
    type: 'salesforce',
    name: 'Salesforce',
    description: 'CRM platform for sales, service, marketing',
    icon: '☁️',
    category: 'crm',
    authType: 'oauth2',
    authScopes: ['api', 'refresh_token', 'offline_access'],
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    capabilities: [
      { name: 'read:leads', description: 'Read leads' },
      { name: 'write:leads', description: 'Create/update leads' },
      { name: 'read:contacts', description: 'Read contacts' },
      { name: 'read:opportunities', description: 'Read opportunities' },
      { name: 'read:accounts', description: 'Read accounts' },
    ],
    actions: [
      {
        name: 'create_lead',
        description: 'Create a new lead',
        category: 'lead',
        inputSchema: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            company: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['lastName', 'company'],
        },
        riskLevel: 'medium',
      },
      {
        name: 'update_lead',
        description: 'Update an existing lead',
        category: 'lead',
        inputSchema: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            fields: { type: 'object' },
          },
          required: ['leadId', 'fields'],
        },
        riskLevel: 'medium',
      },
      {
        name: 'query',
        description: 'Run SOQL query (read-only)',
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            soql: { type: 'string' },
          },
          required: ['soql'],
        },
        riskLevel: 'low',
      },
      {
        name: 'get_opportunities',
        description: 'Get opportunities with optional filters',
        category: 'opportunity',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'string' },
            limit: { type: 'number', default: 10 },
          },
        },
        riskLevel: 'low',
      },
    ],
    triggers: [
      { name: 'lead_created', description: 'When a lead is created', event: 'Lead.created' },
      { name: 'opportunity_stage_changed', description: 'When opp stage changes', event: 'Opportunity.updated' },
    ],
  };

  private secretService = new SecretService();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    super();
    this.clientId = process.env.SALESFORCE_CLIENT_ID || '';
    this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Salesforce credentials not configured');
    }
  }

  async getAuthorizationUrl(
    tenantId: string,
    redirectUri: string,
    state: string
  ): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: this.provider.authScopes.join(' '),
      state,
    });

    return `${this.provider.authUrl}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: string[];
  }> {
    try {
      const response = await axios.post(this.provider.tokenUrl!, null, {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const data = response.data;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scopes: data.scope ? data.scope.split(' ') : [],
      };
    } catch (error: any) {
      throw new IntegrationError(
        `Salesforce token exchange failed: ${error.response?.data?.error_description || error.message}`,
        'TOKEN_EXCHANGE_FAILED'
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    try {
      const response = await axios.post(this.provider.tokenUrl!, null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error: any) {
      throw new IntegrationError(
        `Salesforce token refresh failed: ${error.message}`,
        'TOKEN_REFRESH_FAILED'
      );
    }
  }

  async executeAction(
    actionName: string,
    input: any,
    connection: IntegrationConnection
  ): Promise<IntegrationResult> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);
      const instanceUrl = connection.config?.instanceUrl || 'https://login.salesforce.com';

      switch (actionName) {
        case 'create_lead':
          return this.createLead(accessToken, instanceUrl, input);
        case 'update_lead':
          return this.updateLead(accessToken, instanceUrl, input);
        case 'query':
          return this.runQuery(accessToken, instanceUrl, input.soql);
        case 'get_opportunities':
          return this.getOpportunities(accessToken, instanceUrl, input);
        default:
          throw new IntegrationError(`Unknown action: ${actionName}`, 'UNKNOWN_ACTION');
      }
    } catch (error: any) {
      if (error instanceof IntegrationError) throw error;
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  async testConnection(
    connection: IntegrationConnection
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);
      const instanceUrl = connection.config?.instanceUrl || 'https://login.salesforce.com';

      await axios.get(`${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async createLead(
    accessToken: string,
    instanceUrl: string,
    input: any
  ): Promise<IntegrationResult> {
    const response = await axios.post(
      `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead`,
      {
        FirstName: input.firstName,
        LastName: input.lastName,
        Company: input.company,
        Email: input.email,
        Phone: input.phone,
        Status: input.status || 'Open - Not Contacted',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: { leadId: response.data.id, success: true },
    };
  }

  private async updateLead(
    accessToken: string,
    instanceUrl: string,
    input: any
  ): Promise<IntegrationResult> {
    await axios.patch(
      `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead/${input.leadId}`,
      input.fields,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return { success: true, data: { updated: true } };
  }

  private async runQuery(
    accessToken: string,
    instanceUrl: string,
    soql: string
  ): Promise<IntegrationResult> {
    // Safety: only allow SELECT
    if (!/^\s*SELECT\s/i.test(soql)) {
      throw new IntegrationError(
        'Only SELECT queries are allowed',
        'UNSAFE_QUERY'
      );
    }

    const response = await axios.get(
      `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/query`,
      {
        params: { q: soql },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return {
      success: true,
      data: {
        records: response.data.records,
        totalSize: response.data.totalSize,
        done: response.data.done,
      },
    };
  }

  private async getOpportunities(
    accessToken: string,
    instanceUrl: string,
    input: any
  ): Promise<IntegrationResult> {
    let soql = `SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity`;

    if (input.stage) {
      soql += ` WHERE StageName = '${input.stage.replace(/'/g, "\\'")}'`;
    }

    soql += ` ORDER BY CloseDate DESC LIMIT ${input.limit || 10}`;

    const response = await axios.get(
      `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/query`,
      {
        params: { q: soql },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return { success: true, data: response.data };
  }
}

export default SalesforceAdapter;
