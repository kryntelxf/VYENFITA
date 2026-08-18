import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import { createAIRouter } from './routes';
import { AuthMiddleware } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

// Setup logger
const logger = winston.createLogger({
  level: process.env.AI_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Initialize authentication
const apiKeys = process.env.AI_API_KEYS?.split(',') || [];
AuthMiddleware.initialize(apiKeys);

// Create Express app
const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001');
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// Routes
app.use('/api/v1/ai', createAIRouter());

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = app.listen(port, host, () => {
  logger.info(`🚀 VYENFITA AI Service started`);
  logger.info(`📍 URL: http://${host}:${port}`);
  logger.info(`💚 Health check: http://${host}:${port}/api/v1/ai/health`);
  logger.info(`🔑 Authentication: ${apiKeys.length > 0 ? 'Enabled' : 'Disabled (dev mode)'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server };
