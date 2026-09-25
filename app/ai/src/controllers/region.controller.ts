/**
 * VYENFITA Region Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getRegionRegistry } from '../lib/regions/region-registry';
import { GeoRoutingService } from '../lib/regions/geo-routing.service';
import { RegionHealthService } from '../lib/regions/region-health.service';
import { FailoverService } from '../lib/regions/failover.service';
import { RegionError } from '../lib/regions/region.types';

export class RegionController {
  /**
   * List all regions
   * GET /api/v1/regions
   */
  async listRegions(_req: Request, res: Response): Promise<void> {
    try {
      const registry = getRegionRegistry();
      const regions = registry.list();

      res.json({ success: true, data: regions, count: regions.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a specific region
   * GET /api/v1/regions/:code
   */
  async getRegion(req: Request, res: Response): Promise<void> {
    try {
      const registry = getRegionRegistry();
      const region = registry.getOrThrow(req.params.code as any);

      res.json({ success: true, data: region });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get region health status
   * GET /api/v1/regions/health
   */
  async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = RegionHealthService.getAllHealth();
      res.json({ success: true, data: health, count: health.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get health for a specific region
   * GET /api/v1/regions/:code/health
   */
  async getRegionHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await RegionHealthService.checkRegion(req.params.code as any);
      res.json({ success: true, data: health });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Determine best region for a user
   * POST /api/v1/regions/route
   */
  async route(req: Request, res: Response): Promise<void> {
    try {
      const { ipAddress, country, preferRegion } = req.body;
      const tenantId = req.user?.tenantId;

      const decision = await GeoRoutingService.route({
        tenantId,
        ipAddress,
        country,
        preferRegion,
      });

      res.json({ success: true, data: decision });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get data residency policy for tenant
   * GET /api/v1/regions/residency
   */
  async getResidencyPolicy(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const policy = await GeoRoutingService.getDataResidencyPolicy(req.user.tenantId);
      res.json({ success: true, data: policy });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Set data residency policy
   * POST /api/v1/regions/residency
   */
  async setResidencyPolicy(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { allowedRegions, primaryRegion, strict } = req.body;

      const policy = await GeoRoutingService.setDataResidencyPolicy({
        tenantId: req.user.tenantId,
        allowedRegions,
        primaryRegion,
        strict: strict || false,
      });

      res.json({ success: true, data: policy });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Trigger failover (admin only)
   * POST /api/v1/regions/failover
   */
  async triggerFailover(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { fromRegion, toRegion, reason } = req.body;

      const result = await FailoverService.failover({
        fromRegion,
        toRegion,
        tenantId: req.user.tenantId,
        reason,
        approvedBy: req.user.userId,
      });

      res.json({ success: result.success, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get failover history
   * GET /api/v1/regions/failover/history
   */
  async getFailoverHistory(_req: Request, res: Response): Promise<void> {
    try {
      const history = FailoverService.getHistory();
      res.json({ success: true, data: history });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Start region monitoring
   * POST /api/v1/regions/monitoring/start
   */
  async startMonitoring(_req: Request, res: Response): Promise<void> {
    try {
      RegionHealthService.startMonitoring();
      res.json({ success: true, message: 'Monitoring started' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Stop region monitoring
   * POST /api/v1/regions/monitoring/stop
   */
  async stopMonitoring(_req: Request, res: Response): Promise<void> {
    try {
      RegionHealthService.stopMonitoring();
      res.json({ success: true, message: 'Monitoring stopped' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  private handleError(error: unknown, res: Response): void {
    if (error instanceof RegionError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
    }
