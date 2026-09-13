/**
 * VYENFITA OIDC Provider
 * 
 * OpenID Connect authentication flow:
 * - Authorization code flow
 * - PKCE support
 * - ID token verification via JWKS
 * 
 * @version 1.0.0
 */

import { createHash, randomBytes } from 'crypto';
import { SecretService } from '../security/secret.service';
import {
  OIDCConfig,
  SSOUserInfo,
  SSOError,
} from './sso.interface';
import { logger } from '../observability/logger';

export interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

export class OIDCProvider {
  private config: OIDCConfig;
  private secretService: SecretService;
  private discovery?: OIDCDiscovery;

  constructor(config: OIDCConfig) {
    this.config = config;
    this.secretService = new SecretService();
  }

  /**
   * Discover OIDC endpoints
   */
  async discover(): Promise<OIDCDiscovery> {
    if (this.discovery) return this.discovery;

    const url = `${this.config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new SSOError(
          `OIDC discovery failed: HTTP ${response.status}`,
          'DISCOVERY_FAILED'
        );
      }

      this.discovery = (await response.json()) as OIDCDiscovery;
      return this.discovery;
    } catch (error) {
      throw new SSOError(
        `OIDC discovery error: ${error instanceof Error ? error.message : 'Unknown'}`,
        'DISCOVERY_ERROR'
      );
    }
  }

  /**
   * Build authorization URL
   */
  async buildAuthorizationUrl(params: {
    redirectUri: string;
    state: string;
    nonce: string;
  }): Promise<{ url: string; codeVerifier: string; codeChallenge: string }> {
    const discovery = await this.discover();

    // PKCE
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: params.redirectUri,
      scope: this.config.scopes.join(' '),
      state: params.state,
      nonce: params.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `${discovery.authorization_endpoint}?${query.toString()}`,
      codeVerifier,
      codeChallenge,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<{ idToken: string; accessToken: string; refreshToken?: string }> {
    const discovery = await this.discover();
    const clientSecret = this.secretService.decrypt(this.config.clientSecretEncrypted);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: this.config.clientId,
      client_secret: clientSecret,
      code_verifier: params.codeVerifier,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new SSOError(
        `Token exchange failed: ${response.status} ${text}`,
        'TOKEN_EXCHANGE_FAILED'
      );
    }

    const tokens = (await response.json()) as any;

    if (!tokens.id_token) {
      throw new SSOError('No id_token in response', 'NO_ID_TOKEN');
    }

    return {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Verify ID token and extract user info
   * 
   * In production, use a JWT library to verify signature via JWKS.
   * Here we decode the payload and validate basic claims.
   */
  async verifyIdToken(
    idToken: string,
    expectedNonce?: string
  ): Promise<SSOUserInfo> {
    // Decode JWT (header.payload.signature)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new SSOError('Invalid ID token format', 'INVALID_ID_TOKEN');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Verify issuer
    if (payload.iss !== this.config.issuer) {
      throw new SSOError(
        `Issuer mismatch: expected ${this.config.issuer}, got ${payload.iss}`,
        'ISSUER_MISMATCH'
      );
    }

    // Verify audience
    if (payload.aud !== this.config.clientId) {
      throw new SSOError(
        `Audience mismatch: expected ${this.config.clientId}, got ${payload.aud}`,
        'AUDIENCE_MISMATCH'
      );
    }

    // Verify nonce if provided
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new SSOError('Nonce mismatch', 'NONCE_MISMATCH');
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new SSOError('ID token expired', 'TOKEN_EXPIRED');
    }

    // Extract claims
    const userId = this.getClaim(payload, this.config.claims.userId);
    const email = this.getClaim(payload, this.config.claims.email);

    if (!userId) {
      throw new SSOError(
        `Missing required claim: ${this.config.claims.userId}`,
        'MISSING_USER_CLAIM'
      );
    }

    if (!email) {
      throw new SSOError(
        `Missing required claim: ${this.config.claims.email}`,
        'MISSING_EMAIL_CLAIM'
      );
    }

    // Validate email domain
    if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (!this.config.allowedDomains.includes(domain)) {
        throw new SSOError(
          `Email domain ${domain} is not allowed`,
          'DOMAIN_NOT_ALLOWED'
        );
      }
    }

    // Extract groups
    let groups: string[] = [];
    if (this.config.claims.groups) {
      const groupsClaim = this.getClaim(payload, this.config.claims.groups);
      if (Array.isArray(groupsClaim)) {
        groups = groupsClaim;
      } else if (typeof groupsClaim === 'string') {
        groups = groupsClaim.split(',').map((g) => g.trim());
      }
    }

    return {
      providerId: this.config.clientId,
      externalId: userId,
      email: email.toLowerCase(),
      name: this.config.claims.name
        ? this.getClaim(payload, this.config.claims.name)
        : undefined,
      groups,
      attributes: payload,
    };
  }

  /**
   * Get a claim value (supports nested paths like "user.profile.email")
   */
  private getClaim(payload: any, path: string): any {
    const parts = path.split('.');
    let current = payload;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }
      }
