/**
 * VYENFITA OAuth Service
 * 
 * Unified OAuth2 flow handler.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createHmac, randomBytes } from 'crypto';
import { prisma } from '../database/client';
import { SecretService } from '../security/secret.service';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { IntegrationType, IntegrationError } from './integration.interface';

export interface OAuthState {
  id: string;
  tenantId: string;
  integrationType: IntegrationType;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  expiresAt: Date;
}

export class OAuthService {
  private secretService: SecretService;

  constructor() {
    this.secretService = new SecretService();
  }

  /**
   * Create OAuth state (PKCE)
   */
  async createState(
    tenantId: string,
    integrationType: IntegrationType,
    redirectUri: string
  ): Promise<{ state: string; codeVerifier: string }> {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');

    await prisma.oAuthState.create({
      data: {
        tenantId,
        integrationType,
        state,
        codeVerifier,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return { state, codeVerifier };
  }

  /**
   * Verify and consume OAuth state
   */
  async consumeState(
    state: string,
    integrationType: IntegrationType
  ): Promise<OAuthState> {
    const record = await prisma.oAuthState.findFirst({
      where: { state, integrationType },
    });

    if (!record) {
      throw new IntegrationError('Invalid state', 'INVALID_STATE');
    }

    if (new Date() > record.expiresAt) {
      await prisma.oAuthState.delete({ where: { id: record.id } });
      throw new IntegrationError('State expired', 'STATE_EXPIRED');
    }

    // Delete after use (one-time)
    await prisma.oAuthState.delete({ where: { id: record.id } });

    return record as any;
  }

  /**
   * Store connection with encrypted tokens
   */
  async storeConnection(params: {
    tenantId: string;
    integrationType: IntegrationType;
    userId: string;
    name: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: string[];
    config?: Record<string, any>;
  }): Promise<any> {
    const accessTokenEncrypted = this.secretService.encrypt(params.accessToken);
    const refreshTokenEncrypted = params.refreshToken
      ? this.secretService.encrypt(params.refreshToken)
      : undefined;

    const connection = await prisma.integrationConnection.create({
      data: {
        id: uuidv4(),
        tenantId: params.tenantId,
        integrationType: params.integrationType,
        name: params.name,
        status: 'connected',
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt: params.expiresAt,
        scopes: params.scopes || [],
        config: (params.config || {}) as any,
        connectedBy: params.userId,
      },
    });

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: 'create',
      action: 'integration.connect',
      resource: 'integration_connection',
      resourceId: connection.id,
      details: { integrationType: params.integrationType },
      status: 'success',
    });

    logger.info('Integration connection stored', {
      connectionId: connection.id,
      integrationType: params.integrationType,
      tenantId: params.tenantId,
    });

    return connection;
  }

  /**
   * Get decrypted access token
   */
  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new IntegrationError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    if (connection.status !== 'connected') {
      throw new IntegrationError(
        `Connection is ${connection.status}`,
        'CONNECTION_NOT_ACTIVE'
      );
    }

    if (!connection.accessTokenEncrypted) {
      throw new IntegrationError('No access token', 'NO_TOKEN');
    }

    return this.secretService.decrypt(connection.accessTokenEncrypted);
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(
    connectionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    const accessTokenEncrypted = this.secretService.encrypt(accessToken);
    const refreshTokenEncrypted = refreshToken
      ? this.secretService.encrypt(refreshToken)
      : undefined;

    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        accessTokenEncrypted,
        ...(refreshTokenEncrypted && { refreshTokenEncrypted }),
        ...(expiresAt && { expiresAt }),
        status: 'connected',
        lastError: null,
      },
    });
  }

  /**
   * Disconnect integration
   */
  async disconnect(connectionId: string, tenantId: string): Promise<void> {
    const connection = await prisma.integrationConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw new IntegrationError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    await prisma.integrationConnection.delete({
      where: { id: connectionId },
    });

    await auditService.log({
      tenantId,
      eventType: 'delete',
      action: 'integration.disconnect',
      resource: 'integration_connection',
      resourceId: connectionId,
      details: { integrationType: connection.integrationType },
      status: 'success',
    });

    logger.info('Integration disconnected', {
      connectionId,
      tenantId,
      integrationType: connection.integrationType,
    });
  }

  /**
   * List connections for tenant
   */
  async listConnections(tenantId: string, integrationType?: IntegrationType): Promise<any[]> {
    const where: any = { tenantId };
    if (integrationType) where.integrationType = integrationType;

    return prisma.integrationConnection.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        integrationType: true,
        name: true,
        status: true,
        expiresAt: true,
        scopes: true,
        config: true,
        connectedBy: true,
        connectedAt: true,
        updatedAt: true,
        lastUsedAt: true,
        lastError: true,
      },
    });
  }
}

export default OAuthService;
