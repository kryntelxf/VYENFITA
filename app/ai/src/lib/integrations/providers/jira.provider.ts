/**
 * VYENFITA Jira Integration
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

export class JiraAdapter extends IntegrationAdapter {
  readonly provider: IntegrationProvider = {
    type: 'jira',
    name: 'Jira',
    description: 'Issue tracking & project management',
    icon: '🔷',
    category: 'devtools',
    authType: 'oauth2',
    authScopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    capabilities: [
      { name: 'read:issues', description: 'Read issues' },
      { name: 'write:issues', description: 'Create/update issues' },
    ],
    actions: [
      {
        name: 'create_issue',
        description: 'Create a new Jira issue',
        category: 'issue',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            issueType: { type: 'string', default: 'Task' },
            priority: { type: 'string', default: 'Medium' },
            assignee: { type: 'string' },
          },
          required: ['projectKey', 'summary'],
        },
        riskLevel: 'medium',
      },
      {
        name: 'search_issues',
        description: 'Search issues with JQL',
        category: 'issue',
        inputSchema: {
          type: 'object',
          properties: {
            jql: { type: 'string' },
            limit: { type: 'number', default: 10 },
          },
          required: ['jql'],
        },
        riskLevel: 'low',
      },
    ],
    triggers: [
      { name: 'issue_created', description: 'When an issue is created', event: 'jira:issue_created' },
      { name: 'issue_updated', description: 'When an issue is updated', event: 'jira:issue_updated' },
    ],
  };

  private secretService = new SecretService();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    super();
    this.clientId = process.env.JIRA_CLIENT_ID || '';
    this.clientSecret = process.env.JIRA_CLIENT_SECRET || '';
  }

  async getAuthorizationUrl(
    _tenantId: string,
    redirectUri: string,
    state: string
  ): Promise<string> {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: this.provider.authScopes.join(' '),
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
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
  }> {
    const response = await axios.post(this.provider.tokenUrl!, {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const response = await axios.post(this.provider.tokenUrl!, {
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

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
    const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);
    const cloudId = connection.config?.cloudId;

    if (!cloudId) {
      throw new IntegrationError('Cloud ID not configured', 'NO_CLOUD_ID');
    }

    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;

    switch (actionName) {
      case 'create_issue':
        return this.createIssue(accessToken, baseUrl, input);
      case 'search_issues':
        return this.searchIssues(accessToken, baseUrl, input);
      default:
        throw new IntegrationError(`Unknown action: ${actionName}`, 'UNKNOWN_ACTION');
    }
  }

  async testConnection(
    connection: IntegrationConnection
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);
      const cloudId = connection.config?.cloudId;

      if (!cloudId) return { healthy: false, error: 'No cloudId' };

      await axios.get(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
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

  private async createIssue(
    accessToken: string,
    baseUrl: string,
    input: any
  ): Promise<IntegrationResult> {
    const response = await axios.post(
      `${baseUrl}/rest/api/3/issue`,
      {
        fields: {
          project: { key: input.projectKey },
          summary: input.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: input.description || '' }],
              },
            ],
          },
          issuetype: { name: input.issueType || 'Task' },
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
      data: { issueKey: response.data.key, issueId: response.data.id },
    };
  }

  private async searchIssues(
    accessToken: string,
    baseUrl: string,
    input: any
  ): Promise<IntegrationResult> {
    const response = await axios.get(`${baseUrl}/rest/api/3/search`, {
      params: { jql: input.jql, maxResults: input.limit || 10 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return { success: true, data: response.data };
  }
}

export default JiraAdapter;
