/**
 * VYENFITA SSO Service
 * 
 * Manages SSO providers and authentication flow:
 * - Register provider (OIDC/SAML)
 * - Initiate login (redirect to IdP)
 * - Handle callback (exchange code, verify token)
 * - Provision or link user
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4, randomBytes } from 'crypto';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import { OIDCProvider } from './oidc.provider';
import { SecretService } from '../security/secret.service';
import {
  SSOProviderConfig,
  SSOProviderType,
  SSOUserInfo,
  SSOError,
  OIDCConfig,
  SAMLConfig,
} from './sso.interface';

export interface RegisterProviderInput {
  tenantId: string;
  name: string;
  type: SSOProviderType;
  config: OIDCConfig | SAMLConfig;
  enabled?: boolean;
}

export interface InitiateLoginResult {
  authorizationUrl: string;
  state: string;
}

export interface CallbackResult {
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
  isNewUser: boolean;
}

export class SSOService {
  private secretService: SecretService;

  constructor() {
    this.secretService = new SecretService();
  }

  /**
   * Register an SSO provider
   */
  async registerProvider(
    input: RegisterProviderInput
  ): Promise<SSOProviderConfig> {
    // Validate by type
    this.validateConfig(input.type, input.config);

    // Encrypt sensitive fields
    let encryptedConfig: any = { ...input.config };

    if (input.type === 'oidc') {
      const oidcConfig = input.config as OIDCConfig;
      if (oidcConfig.clientSecretEncrypted && !this.isEncrypted(oidcConfig.clientSecretEncrypted)) {
        // Encrypt if not already
        encryptedConfig.clientSecretEncrypted = this.secretService.encrypt(
          oidcConfig.clientSecretEncrypted
        );
      }
    }

    if (input.type === 'saml') {
      const samlConfig = input.config as SAMLConfig;
      if (samlConfig.spPrivateKey && !this.isEncrypted(samlConfig.spPrivateKey)) {
        encryptedConfig.spPrivateKey = this.secretService.encrypt(samlConfig.spPrivateKey);
      }
    }

    // Store as Secret record
    const provider = await prisma.secret.create({
      data: {
        tenantId: input.tenantId,
        name: `sso:${input.name}`,
        description: `SSO Provider: ${input.name} (${input.type})`,
        type: 'sso_provider',
        provider: input.type,
        metadata: {
          ssoEnabled: input.enabled !== false,
          providerType: input.type,
          config: encryptedConfig,
        } as any,
      },
    });

    await auditService.log({
      tenantId: input.tenantId,
      eventType: 'create',
      action: 'sso.provider.register',
      resource: 'sso_provider',
      resourceId: provider.id,
      details: { name: input.name, type: input.type },
      status: 'success',
    });

    logger.info('SSO provider registered', {
      providerId: provider.id,
      type: input.type,
      tenantId: input.tenantId,
    });

    return {
      id: provider.id,
      tenantId: provider.tenantId,
      name: input.name,
      type: input.type,
      enabled: input.enabled !== false,
      config: encryptedConfig,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  /**
   * Get providers for a tenant
   */
  async listProviders(tenantId: string): Promise<SSOProviderConfig[]> {
    const providers = await prisma.secret.findMany({
      where: {
        tenantId,
        type: 'sso_provider',
        deletedAt: null,
      },
    });

    return providers.map((p) => {
      const metadata = p.metadata as any;
      return {
        id: p.id,
        tenantId: p.tenantId,
        name: p.name.replace('sso:', ''),
        type: metadata.providerType,
        enabled: metadata.ssoEnabled,
        config: metadata.config,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
  }

  /**
   * Get a specific provider
   */
  async getProvider(
    providerId: string,
    tenantId: string
  ): Promise<SSOProviderConfig | null> {
    const provider = await prisma.secret.findFirst({
      where: {
        id: providerId,
        tenantId,
        type: 'sso_provider',
        deletedAt: null,
      },
    });

    if (!provider) return null;

    const metadata = provider.metadata as any;

    return {
      id: provider.id,
      tenantId: provider.tenantId,
      name: provider.name.replace('sso:', ''),
      type: metadata.providerType,
      enabled: metadata.ssoEnabled,
      config: metadata.config,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  /**
   * Delete an SSO provider
   */
  async deleteProvider(providerId: string, tenantId: string): Promise<void> {
    const provider = await prisma.secret.findFirst({
      where: {
        id: providerId,
        tenantId,
        type: 'sso_provider',
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new SSOError('SSO provider not found', 'PROVIDER_NOT_FOUND');
    }

    await prisma.secret.update({
      where: { id: providerId },
      data: { deletedAt: new Date() },
    });

    await auditService.log({
      tenantId,
      eventType: 'delete',
      action: 'sso.provider.delete',
      resource: 'sso_provider',
      resourceId: providerId,
      status: 'success',
    });
  }

  /**
   * Initiate login — build authorization URL
   */
  async initiateLogin(
    providerId: string,
    tenantId: string,
    redirectUri: string
  ): Promise<InitiateLoginResult> {
    const provider = await this.getProvider(providerId, tenantId);
    if (!provider) {
      throw new SSOError('SSO provider not found', 'PROVIDER_NOT_FOUND');
    }

    if (!provider.enabled) {
      throw new SSOError('SSO provider is disabled', 'PROVIDER_DISABLED');
    }

    if (provider.type !== 'oidc') {
      throw new SSOError(
        'Only OIDC is supported for interactive login flow currently',
        'UNSUPPORTED_TYPE'
      );
    }

    const oidcProvider = new OIDCProvider(provider.config as OIDCConfig);

    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');

    const { url, codeVerifier } = await oidcProvider.buildAuthorizationUrl({
      redirectUri,
      state,
      nonce,
    });

    // Store session state
    await prisma.session.create({
      data: {
        userId: '00000000-0000-0000-0000-000000000000', // placeholder
        token: state,
        refreshToken: JSON.stringify({ nonce, codeVerifier, redirectUri, providerId }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    logger.info('SSO login initiated', {
      providerId,
      tenantId,
    });

    return {
      authorizationUrl: url,
      state,
    };
  }

  /**
   * Handle callback from IdP
   */
  async handleCallback(params: {
    providerId: string;
    tenantId: string;
    code: string;
    state: string;
  }): Promise<CallbackResult> {
    // Find session by state
    const session = await prisma.session.findFirst({
      where: { token: params.state, revokedAt: null },
    });

    if (!session) {
      throw new SSOError('Invalid or expired state', 'INVALID_STATE');
    }

    if (new Date() > session.expiresAt) {
      throw new SSOError('State expired', 'STATE_EXPIRED');
    }

    const sessionData = JSON.parse(session.refreshToken || '{}');

    if (sessionData.providerId !== params.providerId) {
      throw new SSOError('Provider mismatch', 'PROVIDER_MISMATCH');
    }

    // Revoke state (one-time use)
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Get provider
    const provider = await this.getProvider(params.providerId, params.tenantId);
    if (!provider) {
      throw new SSOError('SSO provider not found', 'PROVIDER_NOT_FOUND');
    }

    if (provider.type !== 'oidc') {
      throw new SSOError('Only OIDC is supported', 'UNSUPPORTED_TYPE');
    }

    const oidcProvider = new OIDCProvider(provider.config as OIDCConfig);

    // Exchange code
    const tokens = await oidcProvider.exchangeCode({
      code: params.code,
      redirectUri: sessionData.redirectUri,
      codeVerifier: sessionData.codeVerifier,
    });

    // Verify ID token
    const userInfo = await oidcProvider.verifyIdToken(tokens.idToken, sessionData.nonce);

    // Provision or link user
    return this.provisionUser(params.tenantId, provider.id, userInfo);
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private validateConfig(type: SSOProviderType, config: any): void {
    if (!config || typeof config !== 'object') {
      throw new SSOError('Config must be an object', 'INVALID_CONFIG');
    }

    if (type === 'oidc') {
      const c = config as OIDCConfig;
      if (!c.issuer) throw new SSOError('OIDC: issuer is required', 'INVALID_CONFIG');
      if (!c.clientId) throw new SSOError('OIDC: clientId is required', 'INVALID_CONFIG');
      if (!c.clientSecretEncrypted) {
        throw new SSOError('OIDC: clientSecret is required', 'INVALID_CONFIG');
      }
      if (!c.claims || !c.claims.userId || !c.claims.email) {
        throw new SSOError('OIDC: claims.userId and claims.email are required', 'INVALID_CONFIG');
      }
    } else if (type === 'saml') {
      const c = config as SAMLConfig;
      if (!c.entryPoint) throw new SSOError('SAML: entryPoint is required', 'INVALID_CONFIG');
      if (!c.issuer) throw new SSOError('SAML: issuer is required', 'INVALID_CONFIG');
      if (!c.callbackUrl) throw new SSOError('SAML: callbackUrl is required', 'INVALID_CONFIG');
      if (!c.idpCert) throw new SSOError('SAML: idpCert is required', 'INVALID_CONFIG');
    } else {
      throw new SSOError(`Unknown provider type: ${type}`, 'INVALID_TYPE');
    }
  }

  private isEncrypted(value: string): boolean {
    // Heuristic: encrypted strings are base64 and at least 32 chars
    try {
      const decoded = Buffer.from(value, 'base64');
      return decoded.length >= 32 && decoded.length % 16 === 0;
    } catch {
      return false;
    }
  }

  private async provisionUser(
    tenantId: string,
    providerId: string,
    userInfo: SSOUserInfo
  ): Promise<CallbackResult> {
    // Find existing user by SSO
    let user = await prisma.user.findFirst({
      where: {
        ssoProvider: providerId,
        ssoProviderId: userInfo.externalId,
        deletedAt: null,
      },
    });

    let isNewUser = false;

    if (!user) {
      // Try to find by email
      user = await prisma.user.findFirst({
        where: {
          email: userInfo.email,
          deletedAt: null,
        },
      });

      if (user) {
        // Link existing account to SSO
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ssoProvider: providerId,
            ssoProviderId: userInfo.externalId,
          },
        });

        logger.info('SSO account linked to existing user', {
          userId: user.id,
          providerId,
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: userInfo.email,
            name: userInfo.name,
            ssoProvider: providerId,
            ssoProviderId: userInfo.externalId,
            status: 'active',
            emailVerified: true,
          },
        });

        isNewUser = true;

        logger.info('SSO user created', {
          userId: user.id,
          email: user.email,
          providerId,
        });
      }
    }

    // Ensure membership exists
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existingMembership) {
      // Find default role
      const defaultRole = await prisma.role.findFirst({
        where: {
          tenantId,
          isDefault: true,
        },
      });

      if (!defaultRole) {
        throw new SSOError(
          'No default role configured for tenant',
          'NO_DEFAULT_ROLE'
        );
      }

      await prisma.membership.create({
        data: {
          userId: user.id,
          tenantId,
          roleId: defaultRole.id,
          status: 'active',
          joinedAt: new Date(),
        },
      });

      logger.info('SSO membership created', {
        userId: user.id,
        tenantId,
        roleId: defaultRole.id,
      });
    }

    await auditService.log({
      tenantId,
      userId: user.id,
      eventType: 'auth',
      action: 'sso.login',
      resource: 'user',
      resourceId: user.id,
      details: { providerId, isNewUser },
      status: 'success',
    });

    return {
      userId: user.id,
      tenantId,
      email: user.email,
      name: user.name || undefined,
      isNewUser,
    };
  }
}

let instance: SSOService | undefined;

export function getSSOService(): SSOService {
  if (!instance) {
    instance = new SSOService();
  }
  return instance;
  }
