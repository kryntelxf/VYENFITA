/**
 * VYENFITA HubSpot Integration
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
} from '../integration.interface';

const HUBSPOT_API = 'https://api.hubapi.com';

export class HubSpotAdapter extends IntegrationAdapter {
  readonly provider: IntegrationProvider = {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'CRM & marketing automation platform',
    icon: '🟠',
    category: 'crm',
    authType: 'oauth2',
    authScopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.companies.read'],
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    capabilities: [
      { name: 'read:contacts', description: 'Read contacts' },
      { name: 'write:contacts', description: 'Create/update contacts' },
      { name: 'read:deals', description: 'Read deals' },
      { name: 'read:companies', description: 'Read companies' },
    ],
    actions: [
      {
        name: 'create_contact',
        description: 'Create a new contact',
        category: 'contact',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
          },
          required: ['email'],
        },
        riskLevel: 'medium',
      },
      {
        name: 'get_contacts',
        description: 'Get contacts with optional filters',
        category: 'contact',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
          },
        },
        riskLevel: 'low',
      },
      {
        name: 'get_deals',
        description: 'Get deals',
        category: 'deal',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
          },
        },
        riskLevel: 'low',
      },
    ],
    triggers: [
      { name: 'contact_created', description: 'When a contact is created', event: 'contact.creation' },
      { name: 'deal_created', description: 'When a deal is created', event: 'deal.creation' },
    ],
  };

  private secretService = new SecretService();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    super();
    this.clientId = process.env.HUBSPOT_CLIENT_ID || '';
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '';
  }

  async getAuthorizationUrl(
    _tenantId: string,
    redirectUri: string,
    state: string
  ): Promise<string> {
    const params = new URLSearchParams({
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
      const response = await axios.post(
        this.provider.tokenUrl!,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      };
    } catch (error: any) {
      throw new IntegrationError(
        `HubSpot token exchange failed: ${error.message}`,
        'TOKEN_EXCHANGE_FAILED'
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const response = await axios.post(
      this.provider.tokenUrl!,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      })
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
    };
  }

  async executeAction(
    actionName: string,
    input: any,
    connection: IntegrationConnection
  ): Promise<IntegrationResult> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);

      switch (actionName) {
        case 'create_contact':
          return this.createContact(accessToken, input);
        case 'get_contacts':
          return this.getContacts(accessToken, input);
        case 'get_deals':
          return this.getDeals(accessToken, input);
        default:
          throw new IntegrationError(`Unknown action: ${actionName}`, 'UNKNOWN_ACTION');
      }
    } catch (error: any) {
      if (error instanceof IntegrationError) throw error;
      return { success: false, error: error.message };
    }
  }

  async testConnection(
    connection: IntegrationConnection
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);

      await axios.get(`${HUBSPOT_API}/crm/v3/objects/contacts?limit=1`, {
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

  private async createContact(accessToken: string, input: any): Promise<IntegrationResult> {
    const response = await axios.post(
      `${HUBSPOT_API}/crm/v3/objects/contacts`,
      {
        properties: {
          email: input.email,
          firstname: input.firstName,
          lastname: input.lastName,
          phone: input.phone,
          company: input.company,
        },
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
      data: { contactId: response.data.id },
    };
  }

  private async getContacts(accessToken: string, input: any): Promise<IntegrationResult> {
    const response = await axios.get(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
      params: { limit: input.limit || 10 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return { success: true, data: response.data };
  }

  private async getDeals(accessToken: string, input: any): Promise<IntegrationResult> {
    const response = await axios.get(`${HUBSPOT_API}/crm/v3/objects/deals`, {
      params: { limit: input.limit || 10 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return { success: true, data: response.data };
  }
}

export default HubSpotAdapter;
