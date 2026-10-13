/**
 * VYENFITA Tracing Initialization
 * 
 * Must be imported BEFORE any other module that uses OpenTelemetry
 * instrumentation (Express, Prisma, etc). In practice, this means
 * importing it first in `src/index.ts`.
 * 
 * Uses the OpenTelemetry NodeSDK with auto-instrumentation.
 * 
 * @version 1.0.0
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry SDK.
 * 
 * Idempotent — calling multiple times has no effect after the first call.
 * 
 * Returns `true` if initialized, `false` if disabled via env.
 */
export function initTracing(): boolean {
  if (process.env.OTEL_ENABLED !== 'true') {
    // eslint-disable-next-line no-console
    console.log('[Tracing] Disabled (OTEL_ENABLED != true)');
    return false;
  }

  if (sdk) {
    // eslint-disable-next-line no-console
    console.log('[Tracing] Already initialized');
    return true;
  }

  // Optional: enable verbose OTel diagnostics
  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'vyenfita-ai';
  const serviceVersion = process.env.SERVICE_VERSION || '4.0.0';
  const environment = process.env.NODE_ENV || 'development';
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduce noise: disable fs instrumentation (very chatty)
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Only trace HTTP if enabled
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          // Ignore health-check noise
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || '';
            return (
              url === '/health' ||
              url === '/health/liveness' ||
              url === '/health/readiness' ||
              url === '/metrics'
            );
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log('[Tracing] Initialized', {
      serviceName,
      serviceVersion,
      environment,
      otlpEndpoint,
    });
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Tracing] Failed to initialize', error);
    sdk = undefined;
    return false;
  }
}

/**
 * Gracefully shut down the tracing SDK (flush pending spans).
 * Call this on SIGTERM/SIGINT.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    // eslint-disable-next-line no-console
    console.log('[Tracing] Shutdown complete');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Tracing] Shutdown error', error);
  } finally {
    sdk = undefined;
  }
              }
