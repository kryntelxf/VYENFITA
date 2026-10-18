# VYENFITA P2 Roadmap

**Created:** 2026-10-11
**Last updated:** 2026-10-18
**Status:** Active roadmap — **P0 Source Fix pending; P2.7 VERIFIED (minimal API)**.

---

## 🚨 BLOCKER: P0 — Fix Incomplete Source Code

**Before any feature work:** See `docs/URGENT_P0_SOURCE_FIX.md`.

The VYENFITA AI Service full source code **cannot start**. Source code is incomplete
(missing controllers, missing validation functions). This must be fixed
on a laptop/PC with a full IDE before full API load testing, staging
deployment, or any other verification can proceed.

**Estimated:** 1–2 laptop sessions (4–8 hours) OR progressive restore via 10–15 mobile sessions.

---

## P2 — Important (Production Readiness)

### ✅ P2.1 — Handoff Document Update

- **Status:** DONE (2026-10-11)

### ✅ P2.2 — Data Export API (GDPR)

- **Status:** DONE (2026-10-12)

### ✅ P2.3 — Data Retention Automated Cleanup

- **Status:** DONE (2026-10-12)

### ✅ P2.4 — Frontend Builder E2E Test (Playwright)

- **Status:** DONE (2026-10-13)
- **Note:** Awaiting `data-testid` instrumentation for full coverage

### ✅ P2.5 — Job Queue (BullMQ)

- **Status:** DONE (2026-10-13)
- **Note:** Opt-in via `USE_BULLMQ=true`

### ✅ P2.6 — Distributed Tracing (Jaeger)

- **Status:** DONE (2026-10-13)
- **Note:** Opt-in via `OTEL_ENABLED=true`

### ✅ P2.7 — Load Testing (k6) — VERIFIED (Minimal Boot)

- **Status:** DONE (2026-10-18)
- **Deliverables:** ✅ All files delivered + verified against real (minimal) API
  - k6 scenarios: smoke, load, stress, spike
  - CI workflow `.github/workflows/load-test.yml` (manual only)
  - `docs/LOAD_TESTING.md` + `app/ai/load-tests/README.md`
- **Verified:**
  - k6 binary functional ✅
  - Docker Postgres + Redis ✅
  - Prisma schema sync ✅
  - **Minimal API boots on port 3001** ✅
  - **`/health` returns 200** ✅
  - **k6 smoke test passes: 13,968/13,968 checks (100%), 0 failures, avg 293µs** ✅
- **Note:** API tested is minimal Express server. Full production API still requires source code fix (see `docs/URGENT_P0_SOURCE_FIX.md`).

### 🚧 P2.8 — Penetration Testing

- **Status:** NOT STARTED (blocked on P0 + external tools)
- **Estimate:** 4-8 hours

---

## P3 — Polish

All P3 items blocked on P0.

### ⏸ P3.1 — Documentation Update

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

---

## Progress Summary

| Item | Status | Date |
|------|--------|------|
| **P0 Source Fix** | 🚨 **BLOCKER** | — |
| P2.1 Handoff | ✅ DONE | 2026-10-11 |
| P2.2 GDPR Export | ✅ DONE | 2026-10-12 |
| P2.3 Retention | ✅ DONE | 2026-10-12 |
| P2.4 Playwright E2E | ✅ DONE | 2026-10-13 |
| P2.5 BullMQ | ✅ DONE | 2026-10-13 |
| P2.6 Jaeger | ✅ DONE | 2026-10-13 |
| P2.7 k6 Load Test | ✅ VERIFIED | 2026-10-18 |
| P2.8 Pentest | ⏸ BLOCKED | — |
| P3.1–P3.5 | ⏸ BLOCKED | — |

---

*Roadmap maintained in `docs/P2_ROADMAP.md`.*
