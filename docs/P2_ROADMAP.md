# VYENFITA P2 Roadmap

**Created:** 2026-10-11
**Last updated:** 2026-10-16
**Status:** Active roadmap for P2 (Important) and P3 (Polish) work.

---

## P2 — Important (Production Readiness)

### ✅ P2.1 — Handoff Document Update

- **Status:** DONE (2026-10-11)

### ✅ P2.2 — Data Export API (GDPR)

- **Status:** DONE (2026-10-12)
- **Deliverables:** 4 endpoints + tests + `docs/GDPR.md`

### ✅ P2.3 — Data Retention Automated Cleanup

- **Status:** DONE (2026-10-12)
- **Deliverables:** `RetentionService` + scheduler + `docs/DATA_RETENTION.md`

### ✅ P2.4 — Frontend Builder E2E Test (Playwright)

- **Status:** DONE (2026-10-13)
- **Note:** Awaiting `data-testid` instrumentation for full coverage

### ✅ P2.5 — Job Queue (BullMQ)

- **Status:** DONE (2026-10-13)
- **Note:** Opt-in via `USE_BULLMQ=true`

### ✅ P2.6 — Distributed Tracing (Jaeger)

- **Status:** DONE (2026-10-13)
- **Note:** Opt-in via `OTEL_ENABLED=true`; no-op when disabled

### ⚠️ P2.7 — Load Testing (k6) — READY (BLOCKED)

- **Status:** PARTIALLY VERIFIED (2026-10-16)
- **Deliverables:** ✅ All files delivered
  - k6 scenarios: smoke, load, stress, spike
  - CI workflow `.github/workflows/load-test.yml` (manual only)
  - `docs/LOAD_TESTING.md` + `app/ai/load-tests/README.md`
- **Verified:** k6 binary functional, Docker Postgres + Redis, Prisma schema sync, `.env` setup
- **Blocked:** VYENFITA AI Service fails to start in Codespaces (mobile)
  - `yarn dev` exit code 1
  - Root cause needs laptop debug
- **To unblock:** Run on laptop, inspect `yarn dev` error, fix, then:
  ```bash
  BASE_URL=http://localhost:3001 k6 run app/ai/load-tests/scenarios/smoke.js
  ```

### 🚧 P2.8 — Penetration Testing

- **Status:** NOT STARTED (blocked — needs external tools/reviewer)
- **Estimate:** 4-8 hours

---

## P3 — Polish

### ⏸ P3.1 — Documentation Update

- Update `docs/ARCHITECTURE.md` with Phase 20–25 modules
- Update `docs/BACKEND_API.md` with new endpoints
- Update `docs/DATABASE.md` with Phase 22–25 schema

### ⏸ P3.2 — Grafana Dashboard

### ⏸ P3.3 — Marketing Site

### ⏸ P3.4 — Sales Tools

### ⏸ P3.5 — Team Onboarding Docs

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

- [ ] Code implemented
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
| P2.6 Jaeger | ✅ DONE | 2026-10-13 |
| P2.7 k6 Load Test | ⚠️ READY (BLOCKED) | 2026-10-16 |
| P2.8 Pentest | 🚧 NEXT (BLOCKED) | — |
| P3.1 Docs Update | ⏸ | — |
| P3.2 Grafana | ⏸ | — |
| P3.3 Marketing | ⏸ | — |
| P3.4 Sales | ⏸ | — |
| P3.5 Onboarding | ⏸ | — |

---

*Roadmap maintained in `docs/P2_ROADMAP.md`.*
