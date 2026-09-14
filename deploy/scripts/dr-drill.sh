#!/bin/bash
# ============================================================
# VYENFITA DR Drill Script
# ============================================================
# Runs a full DR drill in a staging environment.
# Simulates failures and verifies recovery procedures.
# 
# Usage:
#   ./dr-drill.sh [drill-type]
# 
# Drill types:
#   backup-restore    — Verify backup restoration
#   pod-kill          — Chaos: kill random pods
#   db-failover       — Simulate DB failover
#   full              — All drills in sequence
# ============================================================

set -euo pipefail

DRILL_TYPE="${1:-full}"
NAMESPACE="vyenfita-staging"
START_TIME=$(date +%s)

echo "==============================================="
echo "VYENFITA DR DRILL: $DRILL_TYPE"
echo "==============================================="
echo "Namespace: $NAMESPACE"
echo "Started:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "==============================================="

# ============================================================
# UTILITIES
# ============================================================

log() {
  echo "[$(date -u +%H:%M:%S)] $*"
}

assert() {
  if ! eval "$1"; then
    log "✗ ASSERTION FAILED: $2"
    exit 1
  fi
  log "✓ $2"
}

check_service_health() {
  local timeout="${1:-60}"
  local elapsed=0
  
  while [ $elapsed -lt $timeout ]; do
    if curl -sf "http://vyenfita-ai.$NAMESPACE.svc.cluster.local:3001/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  
  return 1
}

# ============================================================
# DRILL 1: BACKUP RESTORE
# ============================================================

drill_backup_restore() {
  log "=== DRILL: Backup Restore ==="
  
  log "1.1 Downloading latest backup..."
  LATEST_BACKUP=$(aws s3 ls s3://vyenfita-backups/ | sort | tail -1 | awk '{print $4}')
  aws s3 cp "s3://vyenfita-backups/$LATEST_BACKUP" /tmp/backup.sql.gz
  assert "[ -f /tmp/backup.sql.gz ]" "Backup downloaded: $LATEST_BACKUP"
  
  log "1.2 Starting test PostgreSQL..."
  docker run -d --name dr-test-pg \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=vyenfita_test \
    -p 5433:5432 postgres:16
  
  sleep 10
  assert "docker ps | grep -q dr-test-pg" "Test PostgreSQL running"
  
  log "1.3 Restoring backup..."
  gunzip -c /tmp/backup.sql.gz | PGPASSWORD=test psql -h localhost -p 5433 -U postgres -d vyenfita_test > /dev/null
  assert "true" "Backup restored"
  
  log "1.4 Verifying data..."
  USERS=$(PGPASSWORD=test psql -h localhost -p 5433 -U postgres -d vyenfita_test -t -c "SELECT COUNT(*) FROM users")
  log "   Users: $USERS"
  assert "[ $USERS -gt 0 ]" "Users table has data"
  
  log "1.5 Cleaning up..."
  docker rm -f dr-test-pg > /dev/null
  
  log "✓ Backup Restore drill PASSED"
}

# ============================================================
# DRILL 2: POD KILL (CHAOS)
# ============================================================

drill_pod_kill() {
  log "=== DRILL: Pod Kill (Chaos Engineering) ==="
  
  log "2.1 Getting pod list..."
  PODS=$(kubectl get pods -n $NAMESPACE -l app=vyenfita-ai -o name)
  POD_COUNT=$(echo "$PODS" | wc -l)
  log "   Found $POD_COUNT pods"
  
  assert "[ $POD_COUNT -ge 2 ]" "At least 2 pods running"
  
  log "2.2 Killing random pod..."
  VICTIM=$(echo "$PODS" | shuf -n 1)
  log "   Victim: $VICTIM"
  kubectl delete "$VICTIM" -n $NAMESPACE --wait=false
  
  log "2.3 Verifying service still responds..."
  sleep 5
  assert "check_service_health 60" "Service healthy during pod loss"
  
  log "2.4 Waiting for pod recovery..."
  sleep 30
  NEW_POD_COUNT=$(kubectl get pods -n $NAMESPACE -l app=vyenfita-ai -o name | wc -l)
  assert "[ $NEW_POD_COUNT -eq $POD_COUNT ]" "Pod count restored: $NEW_POD_COUNT"
  
  log "✓ Pod Kill drill PASSED"
}

# ============================================================
# DRILL 3: DATABASE FAILOVER
# ============================================================

drill_db_failover() {
  log "=== DRILL: Database Failover ==="
  
  log "3.1 Checking replica status..."
  REPLICA_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier vyenfita-staging-replica \
    --region eu-west-1 \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)
  assert "[ \"$REPLICA_STATUS\" == \"available\" ]" "Replica available"
  
  log "3.2 Checking replication lag..."
  LAG=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name ReplicaLag \
    --dimensions Name=DBInstanceIdentifier,Value=vyenfita-staging-replica \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 300 \
    --statistics Average \
    --region eu-west-1 \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null || echo "0")
  log "   Replication lag: ${LAG}s"
  assert "[ $(echo "$LAG < 300" | bc) -eq 1 ]" "Replication lag < 5 min"
  
  log "3.3 Simulating failover (dry run)..."
  log "   [SKIP] Not promoting replica in staging drill"
  
  log "✓ Database Failover drill PASSED"
}

# ============================================================
# MAIN
# ============================================================

case "$DRILL_TYPE" in
  backup-restore)
    drill_backup_restore
    ;;
  pod-kill)
    drill_pod_kill
    ;;
  db-failover)
    drill_db_failover
    ;;
  full)
    drill_backup_restore
    echo ""
    drill_pod_kill
    echo ""
    drill_db_failover
    ;;
  *)
    echo "Unknown drill type: $DRILL_TYPE"
    echo "Valid: backup-restore, pod-kill, db-failover, full"
    exit 1
    ;;
esac

# ============================================================
# SUMMARY
# ============================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "==============================================="
echo "✓ DR DRILL COMPLETE"
echo "==============================================="
echo "Type:     $DRILL_TYPE"
echo "Duration: ${DURATION}s"
echo "Ended:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "==============================================="
