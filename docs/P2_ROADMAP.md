# VYENFITA P2 Roadmap

**Created:** 2026-10-11
**Last updated:** 2026-10-13
**Status:** Active roadmap for P2 (Important) and P3 (Polish) work.

---

## P2 — Important (Production Readiness)

Items below can be done **without cloud accounts**.

### ✅ P2.1 — Handoff Document Update

- **Status:** DONE (2026-10-11)
- **File:** `docs/HANDOVER_UPDATE_2026-10-11.md`

### ✅ P2.2 — Data Export API (GDPR)

- **Status:** DONE (2026-10-12)
- **Deliverables:**
  - `GET /api/v1/users/me/export`
  - `GET /api/v1/tenants/me/export` (admin)
  - `DELETE /api/v1/users/me` (with 30-day grace)
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
  - Playwright config + 5 spec files (load, drag-drop, properties, undo-redo, templates)
  - CI workflow `.github/workflows/e2e-builder.yml`
  - `docs/E2E_TESTING.md` + `app/client/e2e/README.md`
  - Screenshots + traces auto-uploaded on failure
- **Note:** Full coverage awaits `data-testid` instrumentation

### ✅ P2.5 — Job Queue (BullMQ)

- **Status:** DONE (2026-10-13)
- **Deliverables:**
  - `QueueService` (4 queues: workflow, agent, retention, report)
  - `WorkerService` (with per-queue concurrency)
  - 4 handlers + tests
  - Feature flag `USE_BULLMQ=true` (legacy fallback preserved)
  - `docs/JOB_QUEUE.md`
  - Metrics + health check
- **Note:** Redis required when enabled; local dev can keep `USE_BULLMQ=false`

### 🚧 P2.6 — Distributed Tracing (Jaeger)

- **Status:** NEXT
- **Why:** Debug production issues across services.

- **Deliverables:**
  - OpenTelemetry SDK
  - Export to Jaeger collector
  - Trace propagation through middleware
  - Span creation for:
    - HTTP requests
    - DB queries
    - AI provider calls
    - Workflow steps
  - Docker compose addition for local Jaeger

- **Dependencies:** Jaeger (self-hosted)
- **Estimate:** 2-3 hours

### ⏸ P2.7 — Load Testing (k6)

- **Why:** Verify the platform handles production load.

- **Deliverables:**
  - k6 scripts for:
    - Auth flow
    - Application CRUD
    - Workflow execution
    - AI generation
  - Test with 1000 concurrent users
  - Baseline metrics documented
  - CI job `.github/workflows/load-test.yml` (manual only)

- **Dependencies:** k6 install
- **Estimate:** 2-3 hours

### ⏸ P2.8 — Penetration Testing

- **Why:** Security validation before production.

- **Deliverables:**
  - OWASP ZAP scan against staging
  - Manual review of:
    - Auth flows
    - Tenant isolation
    - SQL injection (BI module)
    - SSRF (integration module)
    - Prompt injection (AI module)
  - Report + remediation plan

- **Dependencies:** External pentester (recommended) OR OWASP ZAP
- **Estimate:** 4-8 hours + external time

---

## P3 — Polish

Items that improve quality but aren't blockers.

### ⏸ P3.1 — Documentation Update

- Update `docs/ARCHITECTURE.md` with Phase 20–25 modules
- Update `docs/BACKEND_API.md` with new endpoints
- Update `docs/DATABASE.md` with Phase 22–25 schema
- Add `docs/P2_ROADMAP.md` (this file)

### ⏸ P3.2 — Grafana Dashboard

- Deploy dashboards defined in `deploy/observability/`
- Verify Prometheus scrape works
- Add alerts (Slack/email)

### ⏸ P3.3 — Marketing Site

- Landing page for `vyenfita.com`
- Feature pages
- Pricing page

### ⏸ P3.4 — Sales Tools

- Demo environment
- Sales deck
- Case studies

### ⏸ P3.5 — Team Onboarding Docs

- Dev environment setup
- Contribution guide
- Code review checklist

---

## Cloud-Dependent Work (Blocked on User)

Items below cannot be done without user-provided cloud credentials.

| Item | Blocker | When Unblocked |
|------|---------|----------------|
| AWS ECS real verification | AWS account + cluster | Run `cloud-driver-manual-test.yml` with driver=aws-ecs |
| GCP Cloud Run real verification | GCP project + SA | Run `cloud-driver-manual-test.yml` with driver=gcp-cloud-run |
| Vercel real verification | Vercel token | Run `cloud-driver-manual-test.yml` with driver=vercel |
| SSO with Okta/Azure AD | IdP account | Test SSO flow end-to-end |
| SCIM with Okta/Azure AD | IdP account | Test user provisioning |
| Stripe integration | Stripe account | Complete marketplace payment flow |
| Multi-region deployment | AWS/GCP accounts | Deploy to 2+ regions |
| DR drill | Cloud infra | Run `dr-drill.yml` |

**Trigger:** As soon as user provides credentials, run the manual
workflows and mark items as VERIFIED.

---

## Definition of Done for P2

A P2 item is DONE when:

- [ ] Code implemented (no mocks in production path)
- [ ] Unit tests passing (≥70% coverage for the module)
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
| P2.6 Jaeger | 🚧 NEXT | — |
| P2.7 k6 Load Test | ⏸ | — |
| P2.8 Pentest | ⏸ | — |
| P3.1 Docs Update | ⏸ | — |
| P3.2 Grafana | ⏸ | — |
| P3.3 Marketing | ⏸ | — |
| P3.4 Sales | ⏸ | — |
| P3.5 Onboarding | ⏸ | — |

---

## Priority Order (Agent-Decided)

Based on impact vs effort:

1. **P2.1 Handoff** ← DONE
2. **P2.2 Data Export API** ← DONE
3. **P2.3 Retention Cleanup** ← DONE
4. **P2.4 Frontend Builder E2E** ← DONE
5. **P2.5 Job Queue (BullMQ)** ← DONE
6. **P2.6 Distributed Tracing** ← NEXT
7. **P2.7 Load Testing**
8. **P2.8 Penetration Testing**
9. **P3.1 Documentation Update**
10. **P3.2–P3.5 Polish items**

---

*Roadmap maintained in `docs/P2_ROADMAP.md`. Update as items complete.*
