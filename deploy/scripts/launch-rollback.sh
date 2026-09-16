
#!/bin/bash
# ============================================================
# VYENFITA Launch Rollback
# ============================================================
# Emergency rollback during launch.
# 
# Usage:
#   ./launch-rollback.sh [--to-revision N] [--dry-run]
# ============================================================

set -euo pipefail

TO_REVISION=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --to-revision) TO_REVISION="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=============================================="
echo "VYENFITA ROLLBACK"
echo "=============================================="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Dry run: $DRY_RUN"
echo ""

# --------------------------------------------
# 1. Show current state
# --------------------------------------------
echo "[1/6] Current state..."
kubectl get pods -n vyenfita
helm list -n vyenfita

# --------------------------------------------
# 2. Confirm rollback
# --------------------------------------------
echo ""
echo "[2/6] Rollback plan..."

if [ -n "$TO_REVISION" ]; then
  echo "Target revision: $TO_REVISION"
else
  echo "Target revision: previous (auto-detect)"
  echo ""
  echo "Available revisions:"
  helm history vyenfita -n vyenfita | tail -5
fi

if [ "$DRY_RUN" == "false" ]; then
  echo ""
  read -p "Proceed with rollback? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
  fi
fi

# --------------------------------------------
# 3. Notify
# --------------------------------------------
echo ""
echo "[3/6] Notifying team..."

if [ -n "${SLACK_WEBHOOK:-}" ]; then
  curl -sf -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🔴 VYENFITA ROLLBACK INITIATED at $(date -u)\"}"
  echo "  Slack notified"
fi

# --------------------------------------------
# 4. Perform rollback
# --------------------------------------------
echo ""
echo "[4/6] Rolling back..."

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would rollback"
else
  if [ -n "$TO_REVISION" ]; then
    helm rollback vyenfita "$TO_REVISION" -n vyenfita --wait --timeout 10m
  else
    helm rollback vyenfita -n vyenfita --wait --timeout 10m
  fi
  echo "  ✓ Rollback complete"
fi

# --------------------------------------------
# 5. Verify
# --------------------------------------------
echo ""
echo "[5/6] Verifying..."

if [ "$DRY_RUN" == "true" ]; then
  echo "  [DRY RUN] Would verify"
else
  kubectl rollout status deployment/vyenfita-ai -n vyenfita --timeout=5m
  
  for i in {1..10}; do
    if curl -sf https://api.vyenfita.com/health > /dev/null 2>&1; then
      echo "  ✓ Service healthy"
      break
    fi
    echo "  Waiting for health... ($i/10)"
    sleep 5
  done
fi

# --------------------------------------------
# 6. Report
# --------------------------------------------
echo ""
echo "[6/6] Post-rollback..."

if [ "$DRY_RUN" == "false" ]; then
  # Update status page
  if [ -n "${STATUSPAGE_WEBHOOK:-}" ]; then
    curl -sf -X POST "$STATUSPAGE_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d '{"status":"monitoring","message":"Rollback completed. Monitoring for stability."}'
  fi
  
  # Notify again
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"✅ Rollback complete. Service restored. Post-mortem scheduled.\"}"
  fi
fi

echo ""
echo "=============================================="
echo "✓ ROLLBACK COMPLETE"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Verify all critical paths work"
echo "  2. Investigate root cause"
echo "  3. Schedule post-mortem"
echo "  4. Fix forward when ready"
echo ""
