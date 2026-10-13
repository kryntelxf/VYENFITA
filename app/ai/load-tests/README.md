# VYENFITA Load Tests (k6)

Performance tests using [k6](https://k6.io/).

---

## Install k6

**macOS:**
```bash
brew install k6
```

**Docker:**
```bash
docker run --rm -i grafana/k6 run - < script.js
```

---

## Prerequisites

- VYENFITA AI Service running (default: http://localhost:3001)
- Database with test data

Start the service:

```bash
cd app/ai
yarn dev
```

---

## Scenarios

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| `smoke.js` | 1 | 1 min | Sanity check (fast) |
| `load.js` | up to 50 | 5 min | Normal load |
| `stress.js` | up to 200 | 9 min | Find breaking point |
| `spike.js` | up to 500 | 1 min | Resilience |

---

## Running

### Against local

```bash
cd app/ai/load-tests
k6 run scenarios/smoke.js
```

### Against staging

```bash
BASE_URL=https://staging-api.vyenfita.com \
  k6 run scenarios/load.js
```

### With custom output

```bash
k6 run --out json=results.json scenarios/load.js
k6 run --out influxdb=http://localhost:8086/k6 scenarios/load.js
```

---

## Thresholds

**Smoke:**

- `http_req_failed < 1%`
- `http_req_duration p95 < 500ms`

**Load:**

- `http_req_failed < 2%`
- `http_req_duration p95 < 800ms, p99 < 1500ms`

**Stress:**

- `http_req_failed < 5%`
- `http_req_duration p95 < 2000ms`

**Spike:**

- `http_req_failed < 10%` (allowed higher — this is a spike)

---

## CI

Load tests are manual only via `.github/workflows/load-test.yml`
(workflow_dispatch). They are not run automatically on push/PR because:

1. They take 5-15 min (wastes CI budget)
2. They need a real environment

---

## Baseline Results

Document baseline after first run. Example format:

| Date | Scenario | VUs | p95 | p99 | RPS | Error Rate |
|------|----------|-----|-----|-----|-----|------------|
| (pending first run) | | | | | | |

---

## See Also

- k6 docs: https://k6.io/docs/
- `docs/LOAD_TESTING.md`
