
#!/bin/bash
# ============================================================
# VYENFITA Launch Monitor
# ============================================================
# Runs during launch week, checks all critical metrics.
# 
# Usage:
#   ./launch-monitor.sh [--continuous]
# ============================================================

set -euo pipefail

CONTINUOUS=false
INTERVAL=1800  # 30 minutes

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --continuous) CONTINUOUS=true; shift ;;
    --interval) INTERVAL=$2; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

run_check() {
  echo "=============================================="
  echo "VYENFITA LAUNCH MONITOR"
  echo "=============================================="
  echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""

  # --------------------------------------------
  # 1. Health check
  # --------------------------------------------
  echo "[1/7] Service health..."
  HEALTH=$(curl -sf https://api.vyenfita.com/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "UNREACHABLE")
  if [ "$HEALTH" == "healthy" ]; then
    echo "  🟢 Health: $HEALTH"
  else
    echo "  🔴 Health: $HEALTH"
  fi

  # --------------------------------------------
  # 2. Pod status
  # --------------------------------------------
  echo "[2/7] Kubernetes pods..."
  PODS=$(kubectl get pods -n vyenfita --no-headers 2>/dev/null || echo "")
  if [ -z "$PODS" ]; then
    echo "  ⚠️ Cannot list pods"
  else
    TOTAL=$(echo "$PODS" | wc -l)
    RUNNING=$(echo "$PODS" | grep -c "Running" || echo "0")
    if [ "$TOTAL" -eq "$RUNNING" ]; then
      echo "  🟢 Pods: $RUNNING/$TOTAL running"
    else
      echo "  🟡 Pods: $RUNNING/$TOTAL running"
      echo "$PODS" | grep -v "Running" | sed 's/^/    /'
    fi
  fi

  # --------------------------------------------
  # 3. Error rate
  # --------------------------------------------
  echo "[3/7] Error rate..."
  ERRORS=$(curl -sf "https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_errors_total[5m]))" 2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "N/A")
  REQUESTS=$(curl -sf "https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_requests_total[5m]))" 2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "N/A")
  
  if [ "$ERRORS" != "N/A" ] && [ "$REQUESTS" != "N/A" ]; then
    if [ "$REQUESTS" != "0" ]; then
      RATE=$(echo "scale=4; $ERRORS / $REQUESTS * 100" | bc 2>/dev/null || echo "0")
    else
      RATE="0"
    fi
    echo "  Errors: $ERRORS/s"
    echo "  Requests: $REQUESTS/s"
    echo "  Error rate: ${RATE}%"
  else
    echo "  ⚠️ Cannot fetch metrics"
  fi

  # --------------------------------------------
  # 4. Latency
  # --------------------------------------------
  echo "[4/7] Latency (p95)..."
  P95=$(curl -sf "https://prometheus.vyenfita.com/api/v1/query?query=histogram_quantile(0.95,sum(rate(vyenfita_http_request_duration_ms_bucket[5m]))by(le))" 2>/dev/null | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
  if [ "$P95" != "N/A" ]; then
    P95_ROUNDED=$(printf "%.0f" "$P95" 2>/dev/null || echo "$P95")
    if [ "$P95_ROUNDED" -lt 500 ]; then
      echo "  🟢 P95: ${P95_ROUNDED}ms"
    else
      echo "  🟡 P95: ${P95_ROUNDED}ms (target < 500ms)"
    fi
  else
    echo "  ⚠️ Cannot fetch latency"
  fi

  # --------------------------------------------
  # 5. Active tenants
  # --------------------------------------------
  echo "[5/7] Active tenants..."
  TENANTS=$(kubectl exec -n vyenfita deployment/vyenfita-ai -- \
    node -e "
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      p.tenant.count().then(n => console.log(n)).finally(() => p.\$disconnect());
    " 2>/dev/null | tail -1 || echo "N/A")
  echo "  Tenants: $TENANTS"

  # --------------------------------------------
  # 6. AI provider status
  # --------------------------------------------
  echo "[6/7] AI providers..."
  PROVIDERS=$(curl -sf https://api.vyenfita.com/health 2>/dev/null | jq -r '.checks[] | select(.name | startswith("ai_")) | "\(.name): \(.status)"' 2>/dev/null || echo "N/A")
  if [ "$PROVIDERS" != "N/A" ] && [ -n "$PROVIDERS" ]; then
    echo "$PROVIDERS" | sed 's/^/  /'
  else
    echo "  ⚠️ Cannot fetch provider status"
  fi

  # --------------------------------------------
  # 7. Cost (last hour)
  # --------------------------------------------
  echo "[7/7] Cost (last hour)..."
  COST=$(curl -sf "https://prometheus.vyenfita.com/api/v1/query?query=sum(increase(vyenfita_cost_total_usd[1h]))" 2>/dev/null | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
  if [ "$COST" != "N/A" ]; then
    echo "  Last hour: \$$COST"
  else
    echo "  ⚠️ Cannot fetch cost"
  fi

  echo ""
  echo "=============================================="
}

# Main
if [ "$CONTINUOUS" == "true" ]; then
  echo "Starting continuous monitoring (interval: ${INTERVAL}s)"
  echo "Press Ctrl+C to stop"
  echo ""
  
  while true; do
    run_check
    echo "Next check in ${INTERVAL}s..."
    sleep "$INTERVAL"
  done
else
  run_check
fi
