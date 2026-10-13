# VYENFITA P2 Roadmap

**Created:** 2026-10-11
**Last updated:** 2026-10-13
**Status:** Active roadmap for P2 (Important) and P3 (Polish) work.

---

## P2 — Important (Production Readiness)

### ✅ P2.1 — Handoff Document Update

- **Status:** DONE (2026-10-11)

### ✅ P2.2 — Data Export API (GDPR)

- **Status:** DONE (2026-10-12)
- **Deliverables:**
  - `GET /api/v1/users/me/export`
  - `GET /api/v1/tenants/me/export` (admin)
  - `DELETE /api/v1/users/me` (30-day grace)
  - `POST /api/v1/users/me/deletion/cancel`
  - Unit tests (~30)
  - `docs/GDPR.md`

### ✅ P2.3 — Data Retention Automated Cleanup

- **Status:** DONE (2026-10-12)
- **Deliverables:**
  - `RetentionService` (6 cleanup tasks)
  - `RetentionScheduler` (daily 03:00 UTC)
  - Metrics: `vyenfita_retention_deleted_total`
  - Unit tests (~25)
  - `docs/DATA_RETENTION.md`

### ✅ P2.4 — Frontend Builder E2E Test (Playwright)

- **Status:** DONE (2026-10-13)
- **Deliverables:**
  - Playwright config + 5 spec files
  - CI workflow `.github/workflows/e2e-builder.yml`
  - `docs/E2E_TESTING.md` + `app/client/e2e/README.md`

### ✅ P2.5 — Job Queue (BullMQ)

- **Status:** DONE (2026-10-13)
- **Deliverables:**
  - `QueueService` (4 queues)
  - `WorkerService` (per-queue concurrency)
  - 4 handlers + tests
  - Feature flag `USE_BULLMQ=true`
  - `docs/JOB_QUEUE.md`

### ✅ P2.6 — Distributed Tracing (Jaeger)

- **Status:** DONE (2026-10-13)
- **Deliverables:**
  - OpenTelemetry SDK + auto-instrumentation
  - Custom `withSpan()` helper + VYENFITA attribute conventions
  - `enrichTracingContext` middleware
  - Jaeger all-in-one docker-compose
  - `docs/TRACING.md`
- **Note:** Opt-in via `OTEL_ENABLED=true`; no-op when disabled

### 🟡 P2.7 — Load Testing (k6) — READY, NOT VERIFIED

- **Status:** READY (2026-10-13) — awaiting staging deployment
- **Deliverables:**
  - 4 k6 scenarios (smoke, load, stress, spike)
  - CI workflow `.github/workflows/load-test.yml` (manual only)
  - `docs/LOAD_TESTING.md` + `app/ai/load-tests/README.md`
- **Blocker:** needs reachable staging target
- **Note:** Not run in CI default (wasteful); manual via `workflow_dispatch`

### ⏸ P2.8 — Penetration Testing

- **Status:** Not started
- **Why:** Security validation before production.
- **Deliverables:**
  - OWASP ZAP scan against staging
  - Manual review (auth, tenant isolation, SQL injection, SSRF, prompt injection)
  - Report + remediation plan
- **Dependencies:** External pentester OR OWASP ZAP
- **Estimate:** 4-8 hours + external time

---

## P3 — Polish

### ⏸ P3.1 — Documentation Update

- Update `docs/ARCHITECTURE.md` with Phase 20–25 modules
- Update `docs/BACKEND_API.md` with new endpoints
- Update `docs/DATABASE.md` with Phase 22–25 schema

### ⏸ P3.2 — Grafana Dashboard

- Deploy dashboards in `deploy/observability/`
- Verify Prometheus scrape
- Add alerts (Slack/email)

### ⏸ P3.3 — Marketing Site

- Landing page, feature pages, pricing

### ⏸ P3.4 — Sales Tools

- Demo environment, sales deck, case studies

### ⏸ P3.5 — Team Onboarding Docs

- Dev environment setup, contribution guide, code review checklist

---

## Cloud-Dependent Work (Blocked on User)

| Item | Blocker |
|------|---------|
| AWS ECS real verification | AWS account + cluster |
| GCP Cloud Run real verification | GCP project + SA |
| Vercel real verification | Vercel token |
| SSO with Okta/Azure AD | IdP account |
| SCIM with Okta/Azure AD | IdP account |
| Stripe integration | Stripe account |
| Multi-region deployment | AWS/GCP accounts |
| DR drill | Cloud infra |

---

## Definition of Done for P2

A P2 item is DONE when:

- [ ] Code implemented (no mocks in production path)
- [ ] Unit tests passing (≥70% coverage)
- [ ] Integration tests passing (if applicable)
- [ ] CI GREEN
- [ ] Documentation updated
- [ ] Committed with semantic message
- [ ] Handoff updated

---

## Progress Summary

| Item | Status | Date |
|------|--------|------|
| P2.1 Handoff | ✅ DONE | 2026-10-11 |
| P2.2 GDPR Export | ✅ DONE | 2026-10-12 |
| P2.3 Retention | ✅ DONE | 2026-10-12 |
| P2.4 Playwright E2E | ✅ DONE | 2026-10-13 |
| P2.5 BullMQ | ✅ DONE | 2026-10-13 |
| P2.6 Jaeger Tracing | ✅ DONE | 2026-10-13 |
| P2.7 k6 Load Test | 🟡 READY | 2026-10-13 |
| P2.8 Pentest | ⏸ | — |
| P3.1 Docs Update | ⏸ | — |
| P3.2 Grafana | ⏸ | — |
| P3.3 Marketing | ⏸ | — |
| P3.4 Sales | ⏸ | — |
| P3.5 Onboarding | ⏸ | — |

---

## Priority Order

1. **P2.7 Load Testing** ← READY, need staging
2. **P2.8 Penetration Testing**
3. **P3.1 Documentation Update**
4. **P3.2–P3.5 Polish items**

---

*Roadmap maintained in `docs/P2_ROADMAP.md`. Update as items complete.*
