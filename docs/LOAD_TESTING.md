# Load Testing

VYENFITA uses [k6](https://k6.io/) for load and stress testing.

---

## Quick Start

```bash
# Install k6
brew install k6

# Start API service
cd app/ai && yarn dev

# Run smoke test (1 min)
cd app/ai/load-tests
k6 run scenarios/smoke.js
```

---

## Scenarios

| Scenario | Purpose | Duration |
|----------|---------|----------|
| smoke | Verify system works | 1 min |
| load | Simulate normal traffic | 5 min |
| stress | Find breaking point | 9 min |
| spike | Test resilience to bursts | 1 min |

See `app/ai/load-tests/README.md` for details.

---

## SLO Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Availability | 99.9% | Industry standard SaaS |
| p95 latency (read) | < 300ms | Snappy UX |
| p95 latency (write) | < 800ms | Acceptable |
| Error rate (steady) | < 0.5% | Production-grade |
| Concurrent users | 1000+ | Target scale |

---

## CI Integration

Load tests run manually via `.github/workflows/load-test.yml`.

**Why manual?**

- Takes 5-15 min per run — CI budget killer
- Needs a reachable target (staging or prod)
- Should be run before major releases, not every push

**Recommended flow:**

1. Merge to `vyenfita-development` → CI runs unit + integration tests
2. Before release: run `load` scenario against staging
3. If passing, tag release → production deploy

---

## Interpreting Results

k6 outputs:

```
checks.........................: 100.00% ✓ 1234 ✗ 0
http_req_duration..............: avg=245ms min=98ms med=220ms max=1.2s p(90)=380ms p(95)=450ms
http_req_failed................: 0.00%   ✓ 0      ✗ 1234
vus............................: 50      min=1    max=50
```

**Key lines:**

- `http_req_failed` — should be < threshold
- `http_req_duration p(95)` — should be < threshold
- `checks` — should be 100%

---

## Troubleshooting

**Tests fail with connection refused:**

```bash
curl $BASE_URL/health
```

**Rate limiting triggers:**

Increase rate limit for test env:

```bash
AI_RATE_LIMIT_MAX_REQUESTS=10000
```

**High latency:**

1. Check database connection pool
2. Look for `Slow query detected` in logs
3. Check AI provider latency

---

## Baseline

Document results after first successful run:

| Date | Scenario | VUs | RPS | p95 | p99 | Errors |
|------|----------|-----|-----|-----|-----|--------|
| (pending) | | | | | | |

---

## See Also

- `app/ai/load-tests/README.md`
- k6 docs: https://k6.io/docs/
- `docs/TRACING.md` — diagnose slow paths with traces
