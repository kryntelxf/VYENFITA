# VYENFITA Runbook

Operational guide for VYENFITA production.

---

## Table of Contents

- [Service Overview](#service-overview)
- [Common Operations](#common-operations)
- [Incident Response](#incident-response)
- [Monitoring & Alerts](#monitoring--alerts)
- [Backup & Recovery](#backup--recovery)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

---

## Service Overview

| Component | Technology | Port | Replicas |
|-----------|-----------|------|----------|
| VYENFITA AI | Node.js | 3001 | 2-10 (HPA) |
| Appsmith | Java | 8080 | 1-2 |
| PostgreSQL | Managed | 5432 | External |
| Redis | Managed | 6379 | External |

### Health Endpoints

- `GET /health` — full health (DB + AI providers)
- `GET /health/liveness` — process alive
- `GET /health/readiness` — ready for traffic
- `GET /metrics` — Prometheus metrics

---

## Common Operations

### Deploy New Version

```bash
# Build and push image
git tag v3.0.1
git push origin v3.0.1

# GitHub Actions will:
# 1. Build image
# 2. Push to ghcr.io
# 3. Deploy via Helm
# 4. Run smoke tests
