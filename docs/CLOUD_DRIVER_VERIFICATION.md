# Cloud Driver Verification Guide

This document explains how to verify VYENFITA cloud deployment drivers (AWS ECS, GCP Cloud Run, Vercel) against real cloud environments.

---

## Status

| Driver | Status | Last Verified | Notes |
|--------|--------|---------------|-------|
| Docker | ✅ VERIFIED | CI (every push) | Runs in `test.yml` |
| Kubernetes | ✅ VERIFIED | CI (kind cluster) | Runs in `k8s-driver-test.yml` |
| AWS ECS | 🟡 NOT VERIFIED | — | Manual test workflow ready; needs AWS credentials |
| GCP Cloud Run | 🟡 NOT VERIFIED | — | Manual test workflow ready; needs GCP credentials |
| Vercel | 🟡 NOT VERIFIED | — | Manual test workflow ready; needs Vercel token |

---

## Prerequisites

- GitHub repository admin access (to set Secrets and Environments)
- Active account on the target cloud provider
- Cloud credentials with permission to:
  - Create/update/delete deployments
  - Create IAM roles (for ECS task execution)
  - Create service accounts (for GCP Cloud Run)

---

## GitHub Environment Setup (One-time)

1. Go to **Settings → Environments → New environment**
2. Name: `cloud-verification`
3. Add **Required reviewers** (at least yourself)
4. Save

This ensures every cloud test run requires manual approval.

---

## GitHub Secrets Setup

Go to **Settings → Secrets and variables → Actions → New repository secret**.

### Required for AWS ECS

| Secret | Example | Notes |
|--------|---------|-------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM user with ECS permissions |
| `AWS_SECRET_ACCESS_KEY` | `...` | IAM user secret |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ECS_CLUSTER` | `vyenfita-staging` | Pre-created ECS cluster |
| `AWS_SUBNETS` | `subnet-abc,subnet-def` | Comma-separated subnet IDs |
| `AWS_SECURITY_GROUPS` | `sg-abc` | Comma-separated SG IDs |
| `AWS_EXECUTION_ROLE_ARN` | `arn:aws:iam::123:role/ecsTaskExecutionRole` | ECS task execution role |
| `AWS_TASK_ROLE_ARN` | `arn:aws:iam::123:role/ecsTaskRole` | Optional task role |
| `AWS_LOG_GROUP` | `/ecs/vyenfita` | Optional CloudWatch log group |

### Required for GCP Cloud Run

| Secret | Example | Notes |
|--------|---------|-------|
| `GCP_PROJECT_ID` | `my-project-123` | GCP project ID |
| `GCP_REGION` | `us-central1` | GCP region |
| `GCP_ACCESS_TOKEN` | `ya29...` | Short-lived OAuth token (expires in 1h) |
| `GCP_SERVICE_ACCOUNT_BASE64` | `eyJ...` | Base64-encoded service account JSON |

**Note:** `GCP_ACCESS_TOKEN` expires quickly. For long-running use, prefer `GCP_SERVICE_ACCOUNT_BASE64`.

To generate service account JSON:

```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=SA_EMAIL@PROJECT.iam.gserviceaccount.com
base64 -w0 key.json
