/**
 * VYENFITA SSO Interface
 * 
 * Contract for SSO providers:
 * - OIDC (OpenID Connect)
 * - SAML 2.0
 * 
 * @version 1.0.0
 */

export type SSOProviderType = 'oidc' | 'saml';

export interface SSOProviderConfig {
  id: string;
  tenantId: string;
  name: string;
  type: SSOProviderType;
  enabled: boolean;
  config: OIDCConfig | SAMLConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface OIDCConfig {
  issuer: string; // e.g. https://accounts.google.com
  clientId: string;
  clientSecretEncrypted: string; // Encrypted
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  scopes: string[]; // e.g. ['openid', 'email', 'profile']
  // Claim mapping
  claims: {
    userId: string; // e.g. 'sub'
    email: string; // e.g. 'email'
    name: string; // e.g. 'name'
    groups?: string; // e.g. 'groups'
  };
  // Access control
  allowedDomains?: string[]; // e.g. ['example.com']
  autoProvision: boolean;
}

export interface SAMLConfig {
  entryPoint: string; // IdP SSO URL
  issuer: string; // SP entity ID
  callbackUrl: string; // ACS URL
  idpCert: string; // IdP x509 cert (PEM)
  // SP cert for signing requests (optional)
  spPrivateKey?: string;
  spCert?: string;
  // Attribute mapping
  attributes: {
    userId: string; // e.g. 'NameID'
    email: string; // e.g. 'email'
    name: string; // e.g. 'displayName'
    groups?: string; // e.g. 'groups'
  };
  // Access control
  allowedDomains?: string[];
  autoProvision: boolean;
}

export interface SSOUserInfo {
  providerId: string;
  externalId: string;
  email: string;
  name?: string;
  groups?: string[];
  attributes?: Record<string, any>;
}

export interface SSOSession {
  id: string;
  providerId: string;
  userId: string;
  externalId: string;
  tenantId: string;
  state: string; // CSRF state for OIDC
  nonce?: string;
  codeVerifier?: string; // PKCE
  redirectUri: string;
  createdAt: Date;
  expiresAt: Date;
}

export class SSOError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly providerId?: string
  ) {
    super(message);
    this.name = 'SSOError';
  }
  }
