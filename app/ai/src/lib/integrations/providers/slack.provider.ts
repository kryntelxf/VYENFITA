/**
 * VYENFITA Slack Integration
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

export class SlackAdapter extends IntegrationAdapter {
  readonly provider: IntegrationProvider = {
    type: 'slack',
    name: 'Slack',
    description: 'Team communication and collaboration',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    authScopes: ['chat:write', 'channels:read', 'users:read', 'files:write'],
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    capabilities: [
      { name: 'send:message', description: 'Send messages' },
      { name: 'send:file', description: 'Send files' },
      { name: 'read:channels', description: 'Read channel list' },
    ],
    actions: [
      {
        name: 'send_message',
        description: 'Send a message to a channel or user',
        category: 'message',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or user ID' },
            text: { type: 'string' },
            blocks: { type: 'array', description: 'Block Kit blocks' },
          },
          required: ['channel'],
        },
        riskLevel: 'low',
      },
      {
        name: 'send_file',
        description: 'Send a file',
        category: 'file',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            content: { type: 'string' },
            filename: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['channel', 'content', 'filename'],
        },
        riskLevel: 'low',
      },
      {
        name: 'list_channels',
        description: 'List all channels',
        category: 'data',
        inputSchema: { type: 'object' },
        riskLevel: 'low',
      },
    ],
    triggers: [
      { name: 'message_received', description: 'When a message is received', event: 'message' },
      { name: 'reaction_added', description: 'When a reaction is added', event: 'reaction_added' },
    ],
  };

  private secretService = new SecretService();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    super();
    this.clientId = process.env.SLACK_CLIENT_ID || '';
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || '';
  }

  async getAuthorizationUrl(
    _tenantId: string,
    redirectUri: string,
    state: string
  ): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.provider.authScopes.join(','),
      redirect_uri: redirectUri,
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
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: redirectUri,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Unknown error');
      }

      return {
        accessToken: response.data.access_token,
        scopes: response.data.scope ? response.data.scope.split(',') : [],
      };
    } catch (error: any) {
      throw new IntegrationError(
        `Slack token exchange failed: ${error.message}`,
        'TOKEN_EXCHANGE_FAILED'
      );
    }
  }

  async refreshToken(_refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    throw new IntegrationError(
      'Slack does not support refresh tokens',
      'REFRESH_NOT_SUPPORTED'
    );
  }

  async executeAction(
    actionName: string,
    input: any,
    connection: IntegrationConnection
  ): Promise<IntegrationResult> {
    try {
      const accessToken = this.secretService.decrypt(connection.accessTokenEncrypted!);

      switch (actionName) {
        case 'send_message':
          return this.sendMessage(accessToken, input);
        case 'send_file':
          return this.sendFile(accessToken, input);
        case 'list_channels':
          return this.listChannels(accessToken);
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

      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return { healthy: response.data.ok };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async sendMessage(accessToken: string, input: any): Promise<IntegrationResult> {
    const body: any = {
      channel: input.channel,
      text: input.text,
    };

    if (input.blocks) body.blocks = input.blocks;

    const response = await axios.post('https://slack.com/api/chat.postMessage', body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.data.ok) {
      throw new IntegrationError(response.data.error, 'SLACK_ERROR');
    }

    return {
      success: true,
      data: {
        ts: response.data.ts,
        channel: response.data.channel,
      },
    };
  }

  private async sendFile(accessToken: string, input: any): Promise<IntegrationResult> {
    const response = await axios.post(
      'https://slack.com/api/files.upload',
      new URLSearchParams({
        channels: input.channel,
        content: input.content,
        filename: input.filename,
        title: input.title || input.filename,
      }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.data.ok) {
      throw new IntegrationError(response.data.error, 'SLACK_ERROR');
    }

    return {
      success: true,
      data: { fileId: response.data.file.id },
    };
  }

  private async listChannels(accessToken: string): Promise<IntegrationResult> {
    const response = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.data.ok) {
      throw new IntegrationError(response.data.error, 'SLACK_ERROR');
    }

    return {
      success: true,
      data: {
        channels: response.data.channels.map((c: any) => ({
          id: c.id,
          name: c.name,
          isPrivate: c.is_private,
          memberCount: c.num_members,
        })),
      },
    };
  }
}

export default SlackAdapter;
