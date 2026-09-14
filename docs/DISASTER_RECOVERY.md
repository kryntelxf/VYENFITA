# VYENFITA Disaster Recovery Plan

**Classification:** Internal — Critical
**Owner:** VYENFITA SRE Team
**Last Updated:** 2026-09-15
**Next Review:** 2026-12-15

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [RPO / RTO Targets](#rpo--rto-targets)
- [Architecture Overview](#architecture-overview)
- [Failure Scenarios](#failure-scenarios)
- [Recovery Procedures](#recovery-procedures)
- [Testing Schedule](#testing-schedule)
- [Roles & Responsibilities](#roles--responsibilities)
- [Communication Plan](#communication-plan)
- [Post-Incident Review](#post-incident-review)

---

## Executive Summary

VYENFITA operates a multi-region, highly available platform with automated failover for critical components. This document defines:

- **Recovery Point Objective (RPO):** Maximum acceptable data loss
- **Recovery Time Objective (RTO):** Maximum acceptable downtime
- **Failover procedures:** Automated and manual
- **Testing cadence:** Monthly DR drills
- **Communication:** Status page + stakeholder notifications

**Target Availability:** 99.9% (43 minutes downtime per month)

---

## RPO / RTO Targets

| Component | RPO | RTO | Strategy |
|-----------|-----|-----|----------|
| **PostgreSQL (Primary DB)** | 5 min | 15 min | Streaming replication + automated failover |
| **Redis (Cache)** | 1 min | 5 min | Multi-AZ with automatic failover |
| **VYENFITA AI Service** | 0 (stateless) | 2 min | Multi-region deployment + DNS failover |
| **Appsmith Server** | 0 (stateless) | 5 min | Multi-region deployment |
| **S3 Artifacts** | 0 (versioned) | 0 min | Cross-region replication |
| **Secrets/Vault** | 0 | 1 min | Multi-region replication |
| **DNS** | 0 | 1 min | Multi-provider (Route53 + Cloudflare) |

### Failure Domain Definitions

| Failure | Impact | RTO Target |
|---------|--------|-----------|
| Single pod crash | None (K8s self-heals) | 30 sec |
| Single node failure | None (rescheduled) | 1 min |
| Single AZ failure | Degraded | 5 min |
| Primary region failure | Major | 15 min |
| Database corruption | Critical | 1 hour (PITR) |
| Complete data loss | Catastrophic | 4 hours (restore from backup) |
| Ransomware / malicious | Catastrophic | 8 hours (immutable backup restore) |

---

## Architecture Overview

### Multi-Region Topology

```

┌──────────────────────────────────────────────────────────┐
│                     Global DNS (Route53)                 │
│               Failover routing: primary → secondary       │
└──────────────────────┬───────────────────────────────────┘
│
┌────────────┴────────────┐
│                         │
▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│   PRIMARY REGION    │   │  SECONDARY REGION   │
│   us-east-1         │   │   eu-west-1         │
│                     │   │                     │
│  ┌──────────────┐   │   │  ┌──────────────┐   │
│  │ EKS Cluster  │   │   │  │ EKS Cluster  │   │
│  │ (Active)     │   │   │  │ (Standby)    │   │
│  └──────────────┘   │   │  └──────────────┘   │
│                     │   │                     │
│  ┌──────────────┐   │   │  ┌──────────────┐   │
│  │ RDS Primary  │───┼───┼─▶│ RDS Replica  │   │
│  │ (Writable)   │   │   │  │ (Read-only)  │   │
│  └──────────────┘   │   │  └──────────────┘   │
│                     │   │                     │
│  ┌──────────────┐   │   │  ┌──────────────┐   │
│  │ ElastiCache  │   │   │  │ ElastiCache  │   │
│  │ (Primary)    │   │   │  │ (Replica)    │   │
│  └──────────────┘   │   │  └──────────────┘   │
│                     │   │                     │
│  ┌──────────────┐   │   │  ┌──────────────┐   │
│  │ S3 Bucket    │───┼───┼─▶│ S3 Replica   │   │
│  │ (Versioned)  │   │   │  │ (CRR)        │   │
│  └──────────────┘   │   │  └──────────────┘   │
└─────────────────────┘   └─────────────────────┘
│                         │
└────────────┬────────────┘
│
┌────▼─────┐
│ Route53  │
│ Health   │
│ Check    │
└──────────┘

```

### Data Replication

| Data | Replication | Lag | Notes |
|------|-------------|-----|-------|
| RDS PostgreSQL | Streaming (async) | <5 sec | Cross-region read replica |
| RDS Snapshots | Automated | 24h | Copied to secondary region |
| S3 Artifacts | CRR | <15 min | Versioning enabled both regions |
| ElastiCache | Global Datastore | <1 sec | Active-passive |
| Secrets | Replicated | <1 min | Encrypted with regional KMS |

---

## Failure Scenarios

### Scenario 1: Single Pod Crash

**Probability:** High (weekly)
**Impact:** None
**Detection:** K8s liveness probe
**Recovery:** Automatic (K8s restarts pod)
**RTO:** 30 seconds

**Procedure:**
```

None — automated by Kubernetes.
Monitor: kubectl get pods -n vyenfita -w

```

---

### Scenario 2: Single Node Failure

**Probability:** Medium (monthly)
**Impact:** None
**Detection:** Node NotReady status
**Recovery:** Automatic (K8s reschedules pods)
**RTO:** 1 minute

**Procedure:**
```bash
# Verify reschedule
kubectl get pods -n vyenfita -o wide
kubectl describe node <failed-node>
```

---

Scenario 3: Single AZ Failure

Probability: Low (yearly)
Impact: Degraded (50% capacity)
Detection: CloudWatch alarm
Recovery: Semi-automatic (HPA scales, RDS failover)
RTO: 5 minutes

Procedure:

1. Verify RDS multi-AZ failover:
   ```bash
   aws rds describe-db-instances --db-instance-identifier vyenfita-db \
     --query 'DBInstances[0].MultiAZ'
   ```
2. HPA scales pods in remaining AZs:
   ```bash
   kubectl get hpa -n vyenfita
   ```
3. Monitor application health:
   ```bash
   curl https://api.vyenfita.com/health
   ```

---

Scenario 4: Primary Region Failure

Probability: Very Low (once per few years)
Impact: Critical
Detection: Route53 health check fails
Recovery: Automated failover
RTO: 15 minutes

Automated Procedure:

1. Route53 detects health check failure (3 consecutive failures over 30s)
2. DNS failover triggers → traffic to secondary region
3. Secondary RDS replica promoted to primary
4. Secondary EKS cluster scales up
5. Verify services

Manual Override (if automation fails):

```bash
# 1. Promote RDS replica
aws rds promote-read-replica \
  --db-instance-identifier vyenfita-db-replica \
  --region eu-west-1

# 2. Update DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://failover-dns.json

# 3. Scale up secondary EKS
kubectl --context secondary scale deployment/vyenfita-ai -n vyenfita --replicas=5

# 4. Verify
curl https://api.vyenfita.com/health
```

---

Scenario 5: Database Corruption

Probability: Very Low
Impact: Critical (data loss potential)
Detection: Application errors + DB logs
Recovery: Point-in-Time Recovery (PITR)
RTO: 1 hour
RPO: 5 minutes

Procedure:

```bash
# 1. Identify corruption time
# Review logs, identify last known good time

# 2. Create PITR snapshot
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vyenfita-db \
  --target-db-instance-identifier vyenfita-db-pitr \
  --restore-time 2026-09-15T10:30:00Z

# 3. Verify restored data
psql -h vyenfita-db-pitr.xxx.rds.amazonaws.com -U vyenfita -d vyenfita -c "SELECT COUNT(*) FROM users"

# 4. Switch application to PITR instance
# Update secret / connection string
kubectl edit secret vyenfita-ai-secrets -n vyenfita

# 5. Restart pods
kubectl rollout restart deployment/vyenfita-ai -n vyenfita
```

---

Scenario 6: Ransomware / Malicious Data Deletion

Probability: Very Low
Impact: Catastrophic
Detection: Audit alerts, unauthorized access
Recovery: Restore from immutable backup
RTO: 8 hours
RPO: 24 hours (immutable backup frequency)

Procedure:

1. ISOLATE — disconnect from network
2. PRESERVE EVIDENCE — snapshot all volumes
3. NOTIFY — security team + legal
4. RESTORE — from immutable S3 backups (Object Lock)
5. FORENSICS — investigate breach vector
6. REBUILD — with hardened configuration

```bash
# Restore from immutable backup
aws s3 cp s3://vyenfita-immutable-backups/vyenfita_20260914_030000.sql.gz .

# Restore to new RDS instance
createdb vyenfita_restored
gunzip -c vyenfita_20260914_030000.sql.gz | psql vyenfita_restored
```

---

Recovery Procedures

Database Failover (Manual)

```bash
#!/bin/bash
# Failover script: primary → secondary

set -e

PRIMARY_REGION="us-east-1"
SECONDARY_REGION="eu-west-1"
DB_IDENTIFIER="vyenfita-db-replica"

echo "=== VYENFITA DATABASE FAILOVER ==="
echo "Primary: $PRIMARY_REGION"
echo "Secondary: $SECONDARY_REGION"

# 1. Confirm primary is down
echo "[1/5] Checking primary status..."
if aws rds describe-db-instances \
    --db-instance-identifier vyenfita-db \
    --region $PRIMARY_REGION \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>/dev/null | grep -q "available"; then
  echo "WARNING: Primary is still available. Abort? (Ctrl+C to cancel)"
  sleep 10
fi

# 2. Promote replica
echo "[2/5] Promoting replica..."
aws rds promote-read-replica \
  --db-instance-identifier $DB_IDENTIFIER \
  --region $SECONDARY_REGION

# 3. Wait for promotion
echo "[3/5] Waiting for promotion..."
aws rds wait db-instance-available \
  --db-instance-identifier $DB_IDENTIFIER \
  --region $SECONDARY_REGION

# 4. Update DNS
echo "[4/5] Updating DNS..."
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $DB_IDENTIFIER \
  --region $SECONDARY_REGION \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "New endpoint: $NEW_ENDPOINT"

# 5. Update secret
echo "[5/5] Updating Kubernetes secret..."
kubectl create secret generic vyenfita-ai-secrets \
  --from-literal=DATABASE_URL="postgresql://vyenfita:PASSWORD@${NEW_ENDPOINT}:5432/vyenfita?sslmode=require" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/vyenfita-ai -n vyenfita

echo "=== FAILOVER COMPLETE ==="
```

Regional Failover (Automated)

Managed by Route53 health checks + Lambda:

```python
# lambda_function.py — Route53 failover handler
import boto3
import os

route53 = boto3.client('route53')
rds = boto3.client('rds', region_name='eu-west-1')

HOSTED_ZONE_ID = os.environ['HOSTED_ZONE_ID']
RECORD_NAME = os.environ['RECORD_NAME']
SECONDARY_ENDPOINT = os.environ['SECONDARY_ENDPOINT']

def handler(event, context):
    """
    Triggered by CloudWatch alarm when primary region is unhealthy.
    """
    print(f"Failover triggered: {event}")
    
    # 1. Promote RDS replica
    rds.promote_read_replica(
        DBInstanceIdentifier='vyenfita-db-replica'
    )
    print("RDS replica promoted")
    
    # 2. Update Route53
    route53.change_resource_record_sets(
        HostedZoneId=HOSTED_ZONE_ID,
        ChangeBatch={
            'Changes': [{
                'Action': 'UPSERT',
                'ResourceRecordSet': {
                    'Name': RECORD_NAME,
                    'Type': 'A',
                    'TTL': 60,
                    'ResourceRecords': [{'Value': SECONDARY_ENDPOINT}]
                }
            }]
        }
    )
    print(f"DNS updated to {SECONDARY_ENDPOINT}")
    
    return {'status': 'success'}
```

Point-in-Time Recovery

```bash
#!/bin/bash
# PITR restore script

RESTORE_TIME="${1:-}"  # Format: 2026-09-15T10:30:00Z

if [ -z "$RESTORE_TIME" ]; then
  echo "Usage: $0 2026-09-15T10:30:00Z"
  exit 1
fi

echo "Restoring to: $RESTORE_TIME"

# Create new instance from PITR
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vyenfita-db \
  --target-db-instance-identifier vyenfita-db-pitr-$(date +%Y%m%d) \
  --restore-time $RESTORE_TIME \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible

# Wait
aws rds wait db-instance-available \
  --db-instance-identifier vyenfita-db-pitr-$(date +%Y%m%d)

echo "✓ PITR instance ready"
echo "Next: verify data and update connection string"
```

---

Testing Schedule

DR Drills

Test Frequency Duration Environment
Backup restore Weekly (Sunday 2 AM) 30 min Staging
Database failover Monthly (first Sunday) 30 min Staging
Regional failover Quarterly 2 hours Staging
Full DR simulation Semi-annual 8 hours Staging + Prod (low traffic)
Chaos engineering Continuous Ongoing Staging

Automated Weekly Restore Test

```yaml
# .github/workflows/dr-test.yml
name: DR — Weekly Restore Test

on:
  schedule:
    - cron: '0 2 * * 0'  # Sunday 2 AM UTC
  workflow_dispatch:

jobs:
  restore-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download latest backup
        run: |
          aws s3 cp s3://vyenfita-backups/$(aws s3 ls s3://vyenfita-backups/ | sort | tail -1 | awk '{print $4}') backup.sql.gz
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Spin up test PostgreSQL
        run: |
          docker run -d --name test-pg \
            -e POSTGRES_PASSWORD=test \
            -e POSTGRES_DB=vyenfita_test \
            -p 5432:5432 postgres:16

      - name: Restore backup
        run: |
          sleep 10
          gunzip -c backup.sql.gz | PGPASSWORD=test psql -h localhost -U postgres -d vyenfita_test

      - name: Verify data integrity
        run: |
          COUNT=$(PGPASSWORD=test psql -h localhost -U postgres -d vyenfita_test -t -c "SELECT COUNT(*) FROM users")
          echo "Users in restored DB: $COUNT"
          if [ "$COUNT" -lt 1 ]; then
            echo "FAILED: No users found"
            exit 1
          fi

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: '🔴 DR restore test FAILED'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

Roles & Responsibilities

Role Person Responsibility
Incident Commander On-call SRE Owns incident, decisions
Communications Lead On-call PM Status updates, stakeholder comms
Operations Lead On-call Engineer Executes recovery procedures
Scribe Designated Documents timeline, actions
Executive Sponsor CTO Escalation, external comms

On-Call Rotation

· Primary: 24/7 coverage, week-long shifts
· Secondary: Backup, same rotation
· Escalation: Engineering Manager after 30 min SEV1

---

Communication Plan

Notification Matrix

Severity Customers Internal Executives
SEV1 Immediate status page + email Slack + PagerDuty SMS + call
SEV2 Status page within 30 min Slack Email
SEV3 Status page within 2h Slack -
SEV4 - Slack -

Status Page

URL: https://status.vyenfita.com

Notification Templates

Initial (SEV1):

```
[INVESTIGATING] We are aware of an issue affecting VYENFITA services.
Our team is actively investigating. Next update in 15 minutes.

Started: 2026-09-15 10:30 UTC
Affected: API, Dashboard
Impact: Elevated error rates
```

Update:

```
[UPDATE] Investigation ongoing. We have identified the issue and are
implementing a fix. Next update in 30 minutes.
```

Resolution:

```
[RESOLVED] The issue has been resolved. All services are operational.
We will publish a post-mortem within 48 hours.

Duration: 45 minutes
Root cause: Database connection pool exhaustion
```

---

Post-Incident Review

PIR Template

```markdown
# Post-Incident Review: [INCIDENT-ID]

**Date:** 2026-09-15
**Severity:** SEV1
**Duration:** 45 minutes (10:30 - 11:15 UTC)
**Author:** [Name]

## Summary
Brief description of what happened.

## Timeline
- 10:30 UTC — Alert fired
- 10:32 UTC — On-call acknowledged
- 10:35 UTC — Incident declared
- 10:45 UTC — Root cause identified
- 11:10 UTC — Fix deployed
- 11:15 UTC — Service restored

## Root Cause
Detailed technical explanation.

## Impact
- Users affected: ~500
- Requests failed: ~10,000
- Revenue impact: $X

## Detection
How was it detected? How long did it take?

## Response
What went well? What went poorly?

## Action Items
- [ ] Add monitoring for X (@owner, by YYYY-MM-DD)
- [ ] Update runbook for Y (@owner, by YYYY-MM-DD)
- [ ] Implement safeguard Z (@owner, by YYYY-MM-DD)

## Lessons Learned
Key takeaways for the team.
```

PIR Cadence

· SEV1: Within 48 hours
· SEV2: Within 5 business days
· SEV3: Optional, within 10 days

---

Appendix A: Contact Information

Role Contact Backup
On-Call SRE PagerDuty Slack #vyenfita-ops
Security security@vyenfita.com +1-XXX-XXX-XXXX
Legal legal@vyenfita.com -
AWS Support Enterprise plan TAM

Appendix B: External Dependencies

Service Criticality Alternative
AWS Critical GCP (partial)
OpenAI High Anthropic
Anthropic High OpenAI
Cloudflare High Route53
GitHub Medium GitLab

Appendix C: Recovery Order

When recovering from total loss, restore in this order:

1. DNS — point to recovery region
2. Secrets — restore from Vault
3. Database — restore from backup
4. Cache — warm from cold start
5. Application — deploy VYENFITA AI
6. Appsmith — deploy core
7. Observability — enable monitoring
8. Backups — resume schedule
9. Verify — run smoke tests
10. Communicate — all-clear

---

This document is a living artifact. Update it after every incident.

```

---
