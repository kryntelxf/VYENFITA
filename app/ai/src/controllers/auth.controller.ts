/**
 * VYENFITA Auth Controller
 * 
 * Authentication endpoints
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AuthService } from '../lib/auth/auth.service';

export class AuthController {
  /**
   * Register
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, tenantName } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({
          success: false,
          error: 'email, password, and name are required',
        });
        return;
      }

      const result = await AuthService.register({
        email,
        password,
        name,
        tenantName,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';

      // Don't leak internal errors
      const isUserError =
        message.includes('already exists') ||
        message.includes('Invalid') ||
        message.includes('validation failed');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Registration failed',
      });
    }
  }

  /**
   * Login
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, tenantId } = req.body;

      if (!email || !password || !tenantId) {
        res.status(400).json({
          success: false,
          error: 'email, password, and tenantId are required',
        });
        return;
      }

      const result = await AuthService.login({
        email,
        password,
        tenantId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      // Always return generic message to prevent user enumeration
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }
  }

  /**
   * Logout
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const token = req.headers.authorization!.split(' ')[1];

      await AuthService.logout(token, req.user.userId, req.user.tenantId);

      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Logout failed' });
    }
  }

  /**
   * Refresh token
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'refreshToken is required',
        });
        return;
      }

      const tokens = await AuthService.refresh(
        refreshToken,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    res.json({
      success: true,
      data: {
        userId: req.user.userId,
        email: req.user.email,
        tenantId: req.user.tenantId,
        roleId: req.user.roleId,
        permissions: req.user.permissions,
      },
    });
  }

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'currentPassword and newPassword are required',
        });
        return;
      }

      await AuthService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        message: 'Password changed successfully. All sessions have been revoked.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      const isUserError = message.includes('incorrect') || message.includes('validation');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Password change failed',
      });
    }
  }
        }
