/**
 * VYENFITA SCIM Controller
 * 
 * RFC 7643/7644 compliant SCIM 2.0 endpoints.
 * 
 * All endpoints require a SCIM bearer token (configured per tenant).
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getSCIMService } from '../lib/sso/scim.service';

export class SCIMController {
  /**
   * List users
   * GET /api/v1/scim/v2/Users
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const { filter, startIndex, count } = req.query;

      const scim = getSCIMService();
      const result = await scim.listUsers(req.user.tenantId, {
        filter: filter as string,
        startIndex: startIndex ? parseInt(startIndex as string, 10) : undefined,
        count: count ? parseInt(count as string, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      this.scimError(res, 500, error instanceof Error ? error.message : 'Failed');
    }
  }

  /**
   * Create user
   * POST /api/v1/scim/v2/Users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const scim = getSCIMService();
      const user = await scim.createUser(req.user.tenantId, req.body);

      res.status(201).json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const status = message.includes('already exists') ? 409 : 400;
      this.scimError(res, status, message, message.includes('exists') ? 'uniqueness' : undefined);
    }
  }

  /**
   * Get user
   * GET /api/v1/scim/v2/Users/:id
   */
  async getUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const scim = getSCIMService();
      const user = await scim.getUser(req.user.tenantId, req.params.id);

      if (!user) {
        this.scimError(res, 404, 'User not found');
        return;
      }

      res.json(user);
    } catch (error) {
      this.scimError(res, 500, error instanceof Error ? error.message : 'Failed');
    }
  }

  /**
   * Update user (PUT)
   * PUT /api/v1/scim/v2/Users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const scim = getSCIMService();
      const user = await scim.updateUser(req.user.tenantId, req.params.id, req.body);

      res.json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const status = message.includes('not found') ? 404 : 400;
      this.scimError(res, status, message);
    }
  }

  /**
   * Delete (deactivate) user
   * DELETE /api/v1/scim/v2/Users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const scim = getSCIMService();
      await scim.deleteUser(req.user.tenantId, req.params.id);

      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const status = message.includes('not found') ? 404 : 400;
      this.scimError(res, status, message);
    }
  }

  /**
   * List groups
   * GET /api/v1/scim/v2/Groups
   */
  async listGroups(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.scimError(res, 401, 'Not authenticated');
        return;
      }

      const { startIndex, count } = req.query;

      const scim = getSCIMService();
      const result = await scim.listGroups(req.user.tenantId, {
        startIndex: startIndex ? parseInt(startIndex as string, 10) : undefined,
        count: count ? parseInt(count as string, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      this.scimError(res, 500, error instanceof Error ? error.message : 'Failed');
    }
  }

  /**
   * Service Provider Configuration (SCIM discovery)
   * GET /api/v1/scim/v2/ServiceProviderConfig
   */
  async serviceProviderConfig(_req: Request, res: Response): Promise<void> {
    res.json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.vyenfita.com/scim',
      patch: { supported: false },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 1000 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Token Standard',
        },
      ],
    });
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private scimError(
    res: Response,
    status: number,
    detail: string,
    scimType?: string
  ): void {
    res.status(status).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail,
      status: String(status),
      scimType,
    });
  }
    }
