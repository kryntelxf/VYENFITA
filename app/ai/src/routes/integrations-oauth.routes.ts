import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';
import { randomBytes } from 'crypto';

const OAUTH_PROVIDERS: Record<string, { authUrl: string; tokenUrl: string; scopes: string; envPrefix: string }> = {
  salesforce: { authUrl: 'https://login.salesforce.com/services/oauth2/authorize', tokenUrl: 'https://login.salesforce.com/services/oauth2/token', scopes: 'api refresh_token', envPrefix: 'SALESFORCE' },
  hubspot: { authUrl: 'https://app.hubspot.com/oauth/authorize', tokenUrl: 'https://api.hubapi.com/oauth/v1/token', scopes: 'crm.objects.contacts.read', envPrefix: 'HUBSPOT' },
  slack: { authUrl: 'https://slack.com/oauth/v2/authorize', tokenUrl: 'https://slack.com/api/oauth.v2.access', scopes: 'chat:write channels:read', envPrefix: 'SLACK' },
  jira: { authUrl: 'https://auth.atlassian.com/authorize', tokenUrl: 'https://auth.atlassian.com/oauth/token', scopes: 'read:jira-work write:jira-work', envPrefix: 'JIRA' },
};

export function createIntegrationsOAuthRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/:type/authorize', async (req: Request, res: Response) => {
    try {
      const { redirectUri } = req.body;
      const { type } = req.params;
      if (!redirectUri) return res.status(400).json({ success: false, error: 'redirectUri required' });
      const provider = OAUTH_PROVIDERS[type];
      if (!provider) return res.status(404).json({ success: false, error: 'Unknown provider' });
      const clientId = process.env[`${provider.envPrefix}_CLIENT_ID`];
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing CLIENT_ID' });

      const state = randomBytes(32).toString('hex');
      const codeVerifier = randomBytes(32).toString('base64url');

      await prisma.oAuthState.create({ data: { tenantId: req.user!.tenantId, integrationType: type, state, codeVerifier, redirectUri, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });

      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: provider.scopes, state });
      return res.json({ success: true, data: { url: `${provider.authUrl}?${params.toString()}`, state, codeVerifier } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:type/callback', async (req: Request, res: Response) => {
    try {
      const { code, state } = req.body;
      const { type } = req.params;
      if (!code || !state) return res.status(400).json({ success: false, error: 'Missing code/state' });
      
      const oauthState = await prisma.oAuthState.findFirst({ where: { state, integrationType: type } });
      if (!oauthState) return res.status(400).json({ success: false, error: 'Invalid state' });
      if (new Date() > oauthState.expiresAt) {
        await prisma.oAuthState.delete({ where: { id: oauthState.id } });
        return res.status(400).json({ success: false, error: 'Expired' });
      }

      const provider = OAUTH_PROVIDERS[type];
      const clientId = process.env[`${provider.envPrefix}_CLIENT_ID`];
      const clientSecret = process.env[`${provider.envPrefix}_CLIENT_SECRET`];
      if (!clientId || !clientSecret) return res.status(400).json({ success: false, error: 'Credentials missing' });

      const tokenRes = await fetch(provider.tokenUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: oauthState.redirectUri }),
      });

      if (!tokenRes.ok) return res.status(502).json({ success: false, error: 'Exchange failed' });
      const tokenData: any = await tokenRes.json();
      await prisma.oAuthState.delete({ where: { id: oauthState.id } });
      return res.json({ success: true, data: { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token || null, expiresIn: tokenData.expires_in || null, scope: tokenData.scope || null } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/providers', (_req: Request, res: Response) => {
    return res.json({ success: true, data: Object.entries(OAUTH_PROVIDERS).map(([type, cfg]) => ({ type, configured: !!process.env[`${cfg.envPrefix}_CLIENT_ID`] })) });
  });

  return router;
        }
