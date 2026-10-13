# Distributed Tracing

VYENFITA uses [OpenTelemetry](https://opentelemetry.io/) for distributed tracing, exported to [Jaeger](https://www.jaegertracing.io/).

Traces let you:

- See the full timing breakdown of a request (HTTP → auth → DB → AI → response)
- Correlate logs and traces via the same trace ID
- Diagnose slow requests, N+1 queries, and AI provider latency

---

## Feature Flag

Tracing is **opt-in** via environment variable:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=vyenfita-ai
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_DEBUG=false
```

If `OTEL_ENABLED` is not set (or false), OpenTelemetry uses the NoopTracer
— zero overhead, zero exported spans.

---

## Local Setup

### 1. Start Jaeger

```bash
docker compose -f deploy/observability/docker-compose.jaeger.yml up -d
```

This starts:

- Jaeger UI at http://localhost:16686
- OTLP HTTP endpoint at http://localhost:4318
- Redis at localhost:6379 (for BullMQ, if enabled)

### 2. Enable tracing in your `.env`

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### 3. Restart the AI service

```bash
cd app/ai && yarn dev
```

You should see `[Tracing] Initialized` on startup.

### 4. Make a request and inspect

Then open http://localhost:16686, select service `vyenfita-ai` and click **Find Traces**.

---

## What Gets Traced

| Layer | Instrumented | Notes |
|-------|--------------|-------|
| HTTP (incoming) | ✅ | Health endpoints excluded |
| Express routes | ✅ | Route template captured |
| IORedis | ✅ | BullMQ ops |
| HTTP (outgoing) | ✅ | AI provider calls, webhooks |
| fs | ❌ | Disabled (too noisy) |
| Prisma | ❌ | Requires manual instrumentation |

---

## Adding a Span

```typescript
import { withSpan } from './lib/tracing/tracing.service';
import { SpanAttrs } from './lib/tracing/tracing.types';

const result = await withSpan(
  'application.generate',
  async (span) => {
    setSpanAttribute(SpanAttrs.AI_PROVIDER, 'openai');
    setSpanAttribute(SpanAttrs.AI_MODEL, 'gpt-4o');
    setSpanAttribute(SpanAttrs.AI_TOKENS, response.usage.totalTokens);

    return generateApplication(description);
  },
  { attributes: { 'vyenfita.tenant_id': tenantId } }
);
```

---

## Production Deployment

In K8s:

```yaml
env:
  - name: OTEL_ENABLED
    value: "true"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://jaeger-collector.observability.svc:4318"
  - name: OTEL_SERVICE_NAME
    value: "vyenfita-ai"
```

---

## Troubleshooting

**Traces not appearing in Jaeger:**

1. Verify `OTEL_ENABLED=true`
2. Check startup log: `[Tracing] Initialized`
3. Check Jaeger is reachable: `curl http://localhost:4318/v1/traces`
4. Enable `OTEL_DEBUG=true` for verbose logs

---

## Testing

```bash
cd app/ai
yarn jest src/__tests__/unit/tracing/ --verbose
```

Tests use the NoopTracer — no Jaeger instance required.

---

## See Also

- `docs/JOB_QUEUE.md`
- OpenTelemetry docs: https://opentelemetry.io/docs/
- Jaeger docs: https://www.jaegertracing.io/docs/
