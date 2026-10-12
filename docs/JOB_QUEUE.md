# Job Queue

VYENFITA uses [BullMQ](https://docs.bullmq.io/) (Redis-backed) for background jobs. This provides:

- **Persistence** — jobs survive process restarts
- **Retries** — exponential backoff with configurable attempts
- **Dead letter queue** — failed jobs are stored for inspection
- **Horizontal scaling** — multiple workers can process jobs in parallel
- **Observability** — metrics + queue stats exposed

---

## Feature Flag

The queue is **opt-in** via environment variable:

```bash
USE_BULLMQ=true
REDIS_URL=redis://localhost:6379
QUEUE_CONCURRENCY=5      # optional, default 5
```

If `USE_BULLMQ` is not set (or false), VYENFITA falls back to the legacy
`setInterval`-based scheduler (`scheduler.service.ts` + `retention.scheduler.ts`).

Migration path: Run both in parallel for a transition period, then remove
the legacy schedulers once the queue is proven stable.

---

## Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `workflow-execute` | Execute a workflow | 5 |
| `agent-run` | Run an AI agent | 3 |
| `retention-cleanup` | Daily data retention | 1 (serial) |
| `report-generate` | Generate scheduled reports | 5 |

---

## Enqueueing Jobs

```typescript
import { getQueueService, isQueueEnabled } from './lib/queue/queue.service';

if (isQueueEnabled()) {
  const queue = getQueueService();

  const jobId = await queue.enqueueWorkflowExecute({
    workflowId: 'wf-1',
    executionId: 'exec-1',
    tenantId: 'tenant-1',
    triggerType: 'manual',
    input: { foo: 'bar' },
  });

  await queue.enqueueAgentRun({
    agentId: 'agent-1',
    runId: 'run-1',
    tenantId: 'tenant-1',
    objective: 'Analyze Q3 revenue',
  });

  await queue.enqueueRetentionCleanup({ dryRun: false });

  await queue.enqueueReportGenerate({
    reportId: 'rep-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    format: 'pdf',
  });
}
```

---

## Job Options

Default options:

```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
}
```

Override per job:

```typescript
await queue.enqueue('workflow-execute', payload, {
  delay: 60_000,
  priority: 1,
  attempts: 5,
  jobId: 'my-custom-id',
});
```

---

## Scheduled (Repeatable) Jobs

```typescript
await queue.enqueueRetentionCleanup(
  { dryRun: false },
  { repeat: { pattern: '0 3 * * *' } }
);
```

---

## Monitoring

```typescript
const stats = await queue.getQueueStats('workflow-execute');
const allStats = await queue.getAllStats();
const jobStatus = await queue.getJobStatus('workflow-execute', jobId);
```

### Prometheus Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `vyenfita_queue_jobs_total` | Counter | `queue`, `status` |
| `vyenfita_queue_job_duration_ms` | Histogram | `queue` |

### Health Check

```typescript
const health = await queue.healthCheck();
// { healthy: true, latencyMs: 2 }
```

---

## Operational Commands

```typescript
await queue.pauseQueue('workflow-execute');
await queue.resumeQueue('workflow-execute');
await queue.cleanQueue('workflow-execute', 24 * 3600 * 1000);
await queue.drainQueue('workflow-execute'); // DANGER
```

---

## Local Development

```bash
docker run -d --name vyenfita-redis -p 6379:6379 redis:7-alpine
```

Or add to `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data

volumes:
  redis-data:
```

---

## Testing

```bash
yarn jest src/__tests__/unit/queue/ --verbose
```

All tests use mocked Redis — no actual Redis instance required.

---

## See Also

- `docs/DATA_RETENTION.md`
- `docs/ARCHITECTURE.md`
- BullMQ docs: https://docs.bullmq.io/
