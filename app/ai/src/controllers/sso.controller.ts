/**
 * VYENFITA SSO Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getSSOService } from '../lib/sso/sso.service';
import { getAuthService } from '../lib/auth/auth.service';

export class SSOController {
  /**
   * List SSO providers for tenant
   * GET /api/v1/auth/sso/providers
   */
  async listProviders(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const sso = getSSOService();
      const providers = await sso.listProviders(req.user.tenantId);

      res.json({
        success: true,
        data: providers,
        count: providers.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  /**
   * Register an SSO provider
   * POST /api/v1/auth/sso/providers
   */
  async registerProvider(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { name, type, config, enabled } = req.body;

      if (!name || !type || !config) {
        res.status(400).json({
          success: false,
          error: 'name, type, and config are required',
        });
        return;
      }

      const sso = getSSOService();
      const provider = await sso.registerProvider({
        tenantId: req.user.tenantId,
        name,
        type,
        config,
        enabled,
      });

      res.status(201).json({
        success: true,
        data: provider,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError = message.includes('required') || message.includes('Invalid');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Failed to register provider',
      });
    }
  }

  /**
   * Delete an SSO provider
   * DELETE /api/v1/auth/sso/providers/:id
   */
  async deleteProvider(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const sso = getSSOService();
      await sso.deleteProvider(req.params.id, req.user.tenantId);

      res.json({ success: true, message: 'Provider deleted' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Initiate SSO login (redirect to IdP)
   * GET /api/v1/auth/sso/login/:providerId
   */
  async initiateLogin(req: Request, res: Response): Promise<void> {
    try {
      const { providerId } = req.params;
      const { tenantId, redirectUri } = req.query;

      if (!tenantId || !redirectUri) {
        res.status(400).json({
          success: false,
          error: 'tenantId and redirectUri are required',
        });
        return;
      }

      const sso = getSSOService();
      const result = await sso.initiateLogin(
        providerId,
        tenantId as string,
        redirectUri as string
      );

      // Redirect to IdP
      res.redirect(result.authorizationUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      res.status(400).json({ success: false, error: message });
    }
  }

  /**
   * Handle SSO callback
   * GET /api/v1/auth/sso/callback
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { providerId, tenantId, code, state } = req.query;

      if (!providerId || !tenantId || !code || !state) {
        res.status(400).json({
          success: false,
          error: 'providerId, tenantId, code, and state are required',
        });
        return;
      }

      const sso = getSSOService();
      const result = await sso.handleCallback({
        providerId: providerId as string,
        tenantId: tenantId as string,
        code: code as string,
        state: state as string,
      });

      // Issue JWT for the user
      const auth = getAuthService();
      const loginResult = await auth.loginWithUserId(
        result.userId,
        result.tenantId,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        data: {
          ...result,
          tokens: loginResult.tokens,
          user: loginResult.user,
          tenant: loginResult.tenant,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SSO callback failed';
      res.status(400).json({ success: false, error: message });
    }
  }
}
