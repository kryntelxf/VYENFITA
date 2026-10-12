# Data Retention Policy

VYENFITA automatically cleans up aged data to:

- Comply with GDPR storage limitation (Article 5(1)(e))
- Reduce database size and cost
- Improve query performance

---

## Retention Schedule

Automated cleanup runs **daily at 03:00 UTC** (via `RetentionScheduler`).

| Data Type | Default Retention | Action |
|-----------|-------------------|--------|
| Audit events | 90 days | Delete |
| Workflow executions | 30 days | Delete |
| Agent steps (runs > 90 days) | 90 days | Delete |
| Sessions (expired) | +30 days after expiry | Delete |
| OAuth states (expired) | +60 minutes after expiry | Delete |
| Soft-deleted user accounts | +30 days after deletion | Anonymize |

---

## Configuration

Override defaults via environment variables:

```bash
RETENTION_ENABLED=true                    # default; set to false to disable
RETENTION_AUDIT_EVENTS_DAYS=90
RETENTION_WORKFLOW_EXECUTIONS_DAYS=30
RETENTION_AGENT_STEPS_DAYS=90
RETENTION_SESSIONS_GRACE_DAYS=30
RETENTION_OAUTH_STATES_GRACE_MINUTES=60
RETENTION_DELETED_USERS_GRACE_DAYS=30
```

Or at runtime via `RetentionService.setConfig()`.

---

## Manual Run

For testing or incident response, an admin can trigger cleanup manually:

```typescript
import { RetentionService } from './lib/retention/retention.service';

// Dry run: count only, don't delete
const report = await RetentionService.runCleanup({ dryRun: true });
console.log(report);

// Real run
const report = await RetentionService.runCleanup();
```

---

## Metrics

Cleanup exposes Prometheus metrics:

```
# Total items deleted by entity
vyenfita_retention_deleted_total{entity="audit_events"} 1234
vyenfita_retention_deleted_total{entity="sessions"} 567
```

Query in Grafana:

```
rate(vyenfita_retention_deleted_total[1d])
```

---

## Report Structure

Each cleanup run produces a `RetentionReport`:

```json
{
  "startedAt": "2026-10-12T03:00:00.000Z",
  "completedAt": "2026-10-12T03:00:15.000Z",
  "durationMs": 15000,
  "dryRun": false,
  "results": [
    {
      "entity": "audit_events",
      "retentionDays": 90,
      "deleted": 1234,
      "durationMs": 2000
    }
  ],
  "totalDeleted": 5000,
  "errors": []
}
```

---

## Error Handling

- Each cleanup task runs independently
- If one task fails, others continue
- Errors are reported in `report.errors[]`
- Failed tasks are logged with `logger.error()`
- Metrics are recorded even for partial success

---

## Safety

- **Idempotent**: Running twice has no side effects
- **Non-blocking**: Runs in background; API unaffected
- **Prevents concurrency**: Only one cleanup at a time
- **Dry-run mode**: Count only, no data loss

---

## Audit Trail

Retention cleanup events are logged:

| Action | When |
|--------|------|
| `retention.cleanup_started` | Every run |
| `retention.cleanup_completed` | On success |
| `retention.cleanup_error` | On partial failure |

---

## See Also

- `docs/GDPR.md` — Data export and deletion
- `docs/SECURITY.md` — Security policies
