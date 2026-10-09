# VYENFITA Deployment Layer

Deployment orchestration for VYENFITA applications across multiple platforms.

---

## Architecture

```
DeploymentService.deploy() → BuildService.build() → DriverRegistry.get(type) → Driver.deploy() → healthCheck()
```

---

## Drivers

| Driver | Type Key | Status | Verified By | Notes |
|--------|----------|--------|-------------|-------|
| Docker | `docker` | ✅ **VERIFIED** | Unit test + CI Docker run | Always available |
| Kubernetes | `kubernetes` | ✅ **VERIFIED** | Integration test with `kind` cluster in CI | Requires `K8S_NAMESPACE` or `KUBERNETES_SERVICE_HOST` |
| AWS ECS | `aws-ecs` | 🟡 **NOT VERIFIED** | Unit test only | Manual test ready; needs AWS account |
| GCP Cloud Run | `gcp-cloud-run` | 🟡 **NOT VERIFIED** | Unit test only | Manual test ready; needs GCP account |
| Vercel | `vercel` | 🟡 **NOT VERIFIED** | Unit test only | Manual test ready; needs Vercel account |

**Legend:**
- ✅ **VERIFIED** — Tested against real environment (CI or production)
- 🟡 **NOT VERIFIED** — Code exists and has unit tests, but not yet tested against real cloud
- 🔴 **BROKEN** — Known issue, do not use

---

## Conditional Registration

Drivers are registered **only** when their required environment variables are present:

| Driver | Required Env Vars |
|--------|-------------------|
| `docker` | (none) |
| `kubernetes` | `K8S_NAMESPACE` OR `KUBERNETES_SERVICE_HOST` |
| `aws-ecs` | `AWS_ACCESS_KEY_ID` + `AWS_ECS_CLUSTER` |
| `gcp-cloud-run` | `GCP_PROJECT_ID` |
| `vercel` | `VERCEL_TOKEN` |

Missing env vars cause graceful skip (log warning, no crash).

---

## Testing

### Unit Tests

Location: `src/__tests__/unit/deployment/`

```bash
yarn jest src/__tests__/unit/deployment/ --verbose
```

Covers:
- driver-registry.test.ts — conditional registration, graceful degradation
- docker.driver.test.ts — config validation, URL parsing
- kubernetes.driver.test.ts — config validation, health check parsing
- aws-ecs.driver.test.ts — config validation, API error handling
- gcp-cloud-run.driver.test.ts — config validation, auth handling
- vercel.driver.test.ts — config validation, HTTP error handling
- deployment-service.test.ts — input validation

### Integration Tests

**Kubernetes (real cluster via kind):**

```bash
K8S_INTEGRATION_TEST=true \
KUBECONFIG_BASE64=<base64-kubeconfig> \
K8S_NAMESPACE=vyenfita-test \
yarn jest src/__tests__/integration/deployment/kubernetes.driver.integration.test.ts
```

**Cloud drivers (real AWS/GCP/Vercel):**

```bash
# Runs manually via .github/workflows/cloud-driver-manual-test.yml
# Requires credentials in GitHub Secrets
# See docs/CLOUD_DRIVER_VERIFICATION.md
```

Skipped by default in local dev and CI.

---

## Adding a New Driver

1. Create `src/lib/deployment/drivers/my-driver.driver.ts` implementing `DeploymentDriver`
2. Add config interface (extend the Config type pattern)
3. Register in `src/lib/deployment/driver-registry.ts` with env var guard
4. Add unit test in `src/__tests__/unit/deployment/my-driver.driver.test.ts`
5. Add integration test in `src/__tests__/integration/deployment/` (skip by default)
6. Update this README's status table

---

## Roadmap

- [x] Docker driver
- [x] Kubernetes driver (kind verification)
- [x] AWS ECS driver (unit tests)
- [x] GCP Cloud Run driver (unit tests)
- [x] Vercel driver (unit tests)
- [ ] Verify AWS ECS against real account
- [ ] Verify GCP Cloud Run against real account
- [ ] Verify Vercel against real account
- [ ] Add Azure Container Instances driver
- [ ] Add DigitalOcean App Platform driver
- [ ] Add Fly.io driver
- [ ] Support custom driver plugins (loaded from filesystem)

---

## See Also

- `docs/CLOUD_DRIVER_VERIFICATION.md` — Manual verification guide
- `docs/DEPLOYMENT.md` — Full deployment documentation
- `docs/RUNBOOK.md` — Operational runbook
