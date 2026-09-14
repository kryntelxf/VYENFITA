#!/bin/bash
# ============================================================
# VYENFITA Regional Failover Script
# ============================================================
# Promotes secondary region to primary and updates DNS.
# 
# Usage:
#   ./failover.sh [--dry-run] [--force]
# 
# Environment variables:
#   PRIMARY_REGION       - Primary AWS region
#   SECONDARY_REGION     - Secondary AWS region
#   DB_PRIMARY_ID        - Primary RDS instance identifier
#   DB_REPLICA_ID        - Replica RDS instance identifier
#   HOSTED_ZONE_ID       - Route53 hosted zone ID
#   RECORD_NAME          - DNS record name (e.g., api.vyenfita.com)
#   SECONDARY_ENDPOINT   - Secondary region endpoint (ALB/NLB)
# ============================================================

set -euo pipefail

# Configuration
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-eu-west-1}"
DB_PRIMARY_ID="${DB_PRIMARY_ID:-vyenfita-db}"
DB_REPLICA_ID="${DB_REPLICA_ID:-vyenfita-db-replica}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
RECORD_NAME="${RECORD_NAME:-api.vyenfita.com}"
SECONDARY_ENDPOINT="${SECONDARY_ENDPOINT:-}"

DRY_RUN=false
FORCE=false

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --force)   FORCE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "==============================================="
echo "VYENFITA REGIONAL FAILOVER"
echo "==============================================="
echo "Primary region:   $PRIMARY_REGION"
echo "Secondary region: $SECONDARY_REGION"
echo "Database:         $DB_PRIMARY_ID → $DB_REPLICA_ID"
echo "DNS:              $RECORD_NAME"
echo "New endpoint:     $SECONDARY_ENDPOINT"
echo "Dry run:          $DRY_RUN"
echo "Force:            $FORCE"
echo "==============================================="

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "ERROR: HOSTED_ZONE_ID is required"
  exit 1
fi

if [ -z "$SECONDARY_ENDPOINT" ]; then
  echo "ERROR: SECONDARY_ENDPOINT is required"
  exit 1
fi

# ============================================================
# STEP 1: Verify primary is down (unless --force)
# ============================================================

echo ""
echo "[1/6] Checking primary region status..."

PRIMARY_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_PRIMARY_ID" \
  --region "$PRIMARY_REGION" \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

echo "Primary DB status: $PRIMARY_STATUS"

if [ "$PRIMARY_STATUS" == "available" ] && [ "$FORCE" != "true" ]; then
  echo ""
  echo "WARNING: Primary is still available."
  echo "Failover will cause split-brain. Use --force to override."
  exit 1
fi

# ============================================================
# STEP 2: Promote replica
# ============================================================

echo ""
echo "[2/6] Promoting RDS replica..."

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would promote: $DB_REPLICA_ID"
else
  aws rds promote-read-replica \
    --db-instance-identifier "$DB_REPLICA_ID" \
    --region "$SECONDARY_REGION"
  echo "  ✓ Promotion initiated"
fi

# ============================================================
# STEP 3: Wait for promotion
# ============================================================

echo ""
echo "[3/6] Waiting for replica to become primary..."

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would wait for: $DB_REPLICA_ID"
else
  aws rds wait db-instance-available \
    --db-instance-identifier "$DB_REPLICA_ID" \
    --region "$SECONDARY_REGION"
  echo "  ✓ Replica is now primary"
fi

# ============================================================
# STEP 4: Get new DB endpoint
# ============================================================

echo ""
echo "[4/6] Retrieving new database endpoint..."

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would retrieve new endpoint"
  NEW_DB_ENDPOINT="dry-run-endpoint"
else
  NEW_DB_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_REPLICA_ID" \
    --region "$SECONDARY_REGION" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)
  echo "  ✓ New DB endpoint: $NEW_DB_ENDPOINT"
fi

# ============================================================
# STEP 5: Update DNS
# ============================================================

echo ""
echo "[5/6] Updating Route53 DNS..."

CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$RECORD_NAME",
        "Type": "A",
        "TTL": 60,
        "AliasTarget": {
          "HostedZoneId": "Z1234567890ABC",
          "DNSName": "$SECONDARY_ENDPOINT",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
EOF
)

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would update DNS:"
  echo "$CHANGE_BATCH" | jq .
else
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "$CHANGE_BATCH"
  echo "  ✓ DNS updated"
fi

# ============================================================
# STEP 6: Notify and verify
# ============================================================

echo ""
echo "[6/6] Sending notification..."

if [ -n "${SLACK_WEBHOOK:-}" ]; then
  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"⚠️ VYENFITA regional failover completed. New primary: $SECONDARY_REGION\"}"
fi

echo ""
echo "==============================================="
echo "✓ FAILOVER COMPLETE"
echo "==============================================="
echo ""
echo "Next steps:"
echo "  1. Verify service health: curl https://$RECORD_NAME/health"
echo "  2. Update application secrets:"
echo "     kubectl create secret generic vyenfita-ai-secrets \\"
echo "       --from-literal=DATABASE_URL='postgresql://...@$NEW_DB_ENDPOINT:5432/vyenfita' \\"
echo "       --dry-run=client -o yaml | kubectl apply -f -"
echo "  3. Restart pods: kubectl rollout restart deployment/vyenfita-ai -n vyenfita"
echo ""
echo "==============================================="
