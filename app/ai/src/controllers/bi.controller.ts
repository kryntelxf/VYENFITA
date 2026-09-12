/**
 * VYENFITA Business Intelligence Controller
 * 
 * @version 2.0.0
 */

import { Request, Response } from 'express';
import { getBIService } from '../lib/bi/bi.service';
import { SchemaDiscoveryService } from '../lib/bi/schema-discovery.service';
import { SecretService } from '../lib/security/secret.service';
import { SQLSafetyValidator } from '../lib/bi/sql-safety.validator';
import { AnomalyDetector } from '../lib/bi/anomaly-detector.service';
import { ChartRecommender } from '../lib/bi/chart-recommender.service';
import { prisma } from '../lib/database/client';

const biService = getBIService();
const secretService = new SecretService();

export class BusinessIntelligenceController {
  /**
   * Ask a business question
   * POST /api/v1/bi/ask
   */
  async ask(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { dataSourceId, question, context, detectAnomalies } = req.body;

      if (!dataSourceId || !question) {
        res.status(400).json({
          success: false,
          error: 'dataSourceId and question are required',
        });
        return;
      }

      if (question.length < 5 || question.length > 1000) {
        res.status(400).json({
          success: false,
          error: 'question must be between 5 and 1000 characters',
        });
        return;
      }

      const result = await biService.ask({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        dataSourceId,
        question,
        context,
        detectAnomalies,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query failed';
      const isUserError =
        message.includes('not found') ||
        message.includes('unsafe') ||
        message.includes('must be') ||
        message.includes('Cannot');

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: isUserError ? message : 'Query failed',
      });
    }
  }

  /**
   * Discover schema for a data source
   * GET /api/v1/bi/data-sources/:id/schema
   */
  async discoverSchema(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const dataSource = await prisma.secret.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user.tenantId,
          deletedAt: null,
        },
      });

      if (!dataSource) {
        res.status(404).json({ success: false, error: 'Data source not found' });
        return;
      }

      const metadata = dataSource.metadata as any;
      const config = {
        id: dataSource.id,
        tenantId: dataSource.tenantId,
        name: dataSource.name,
        type: metadata.type || 'postgresql',
        host: metadata.host,
        port: metadata.port,
        database: metadata.database,
        username: metadata.username,
        passwordEncrypted: dataSource.vaultPath || metadata.passwordEncrypted,
        sslEnabled: metadata.sslEnabled !== false,
        connectionTimeoutMs: metadata.connectionTimeoutMs || 10000,
        createdAt: dataSource.createdAt,
        updatedAt: dataSource.updatedAt,
      } as any;

      const schemas = await SchemaDiscoveryService.discover(config, secretService);

      res.json({
        success: true,
        data: schemas,
        count: schemas.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Discovery failed';
      res.status(message.includes('not found') ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Validate a SQL query
   * POST /api/v1/bi/validate-sql
   */
  async validateSQL(req: Request, res: Response): Promise<void> {
    try {
      const { sql } = req.body;

      if (!sql || typeof sql !== 'string') {
        res.status(400).json({
          success: false,
          error: 'sql is required',
        });
        return;
      }

      const result = SQLSafetyValidator.validate(sql);
      const tables = SQLSafetyValidator.extractTableNames(sql);

      res.json({
        success: true,
        data: {
          ...result,
          tablesReferenced: tables,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  }

  /**
   * Detect anomalies in a numeric array
   * POST /api/v1/bi/anomalies
   */
  async detectAnomalies(req: Request, res: Response): Promise<void> {
    try {
      const { values, method, threshold } = req.body;

      if (!Array.isArray(values)) {
        res.status(400).json({
          success: false,
          error: 'values must be an array of numbers',
        });
        return;
      }

      const numericValues = values.map((v: any) => Number(v));
      if (numericValues.some((v) => isNaN(v))) {
        res.status(400).json({
          success: false,
          error: 'all values must be numeric',
        });
        return;
      }

      const result = AnomalyDetector.detect(numericValues, {
        method,
        threshold,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Detection failed',
      });
    }
  }

  /**
   * Recommend chart for a dataset
   * POST /api/v1/bi/recommend-chart
   */
  async recommendChart(req: Request, res: Response): Promise<void> {
    try {
      const { columns, rows } = req.body;

      if (!Array.isArray(columns) || !Array.isArray(rows)) {
        res.status(400).json({
          success: false,
          error: 'columns and rows must be arrays',
        });
        return;
      }

      const recommendation = ChartRecommender.recommend({
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: 0,
        truncated: false,
      });

      res.json({
        success: true,
        data: recommendation,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Recommendation failed',
      });
    }
  }
        }
