
# VYENFITA Launch Runbook

**Day of Launch — Hour by Hour**

---

## T-2 Hours: Pre-Launch

### 08:00 UTC — Team Assembly

**All-hands check-in:**
- Engineering: Ready
- SRE: Ready
- Product: Ready
- Support: Ready

**Verify:**
```bash
# Confirm production health
curl https://api.vyenfita.com/health
# Expected: {"status":"healthy"}

# Confirm all pods running
kubectl get pods -n vyenfita
# Expected: All Running

# Confirm monitoring active
curl https://prometheus.vyenfita.com/api/v1/targets | jq '.data.activeTargets | length'
# Expected: > 5
```

08:30 UTC — Final Deployment

```bash
# Deploy release
helm upgrade --install vyenfita deploy/helm/vyenfita \
  --namespace vyenfita \
  --set ai.image.tag=3.0.0 \
  --wait --timeout 10m

# Verify
kubectl rollout status deployment/vyenfita-ai -n vyenfita
```

09:00 UTC — Smoke Test

```bash
# Health
curl -f https://api.vyenfita.com/health

# Register test user
curl -X POST https://api.vyenfita.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-'$(date +%s)'@test.com","password":"TestPass123","name":"Smoke Test"}'

# Verify login works
# Verify AI generation works
# Verify workflow execution works
```

---

T-1 Hour: Launch Prep

09:00 UTC — Stakeholder Briefing

Email to stakeholders:

```
Subject: VYENFITA Launch — T-1 Hour

Team,

We are 1 hour from launch.

Status: All systems green
Team: Standing by
Plan: Enable invite-only registration at 10:00 UTC

War room: #vyenfita-launch on Slack
Status page: https://status.vyenfita.com

Next update: 10:00 UTC
```

09:30 UTC — Team Standby

· Engineering lead: Ready
· SRE: Ready
· Support: Ready
· Product: Ready

---

T-0: Launch!

10:00 UTC — Enable Registration

```bash
# Enable invite-only signup
kubectl set env deployment/appsmith -n vyenfita \
  APPSMITH_SIGNUP_DISABLED=false

# Verify
curl https://api.vyenfita.com/api/v1/auth/register \
  -X POST \
  -d '{"email":"launch-'$(date +%s)'@test.com","password":"TestPass123","name":"Launch Test"}'
```

10:05 UTC — Announce to Team

Slack #general:

```
🚀 VYENFITA IS LIVE!

Registration enabled at 10:00 UTC.

War room: #vyenfita-launch
Status: https://status.vyenfita.com
Dashboards: https://grafana.vyenfita.com

Monitoring closely. Updates every 30 min.
```

10:10 UTC — Initial Monitoring

Check every dashboard:

Dashboard URL Status
Health status.vyenfita.com 🟢
Grafana grafana.vyenfita.com 🟢
Prometheus prometheus.vyenfita.com 🟢
Logs loki.vyenfita.com 🟢

Key metrics to watch:

```bash
# Request rate
curl -s 'https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_requests_total[5m]))'

# Error rate
curl -s 'https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_errors_total[5m]))/sum(rate(vyenfita_http_requests_total[5m]))'

# Latency
curl -s 'https://prometheus.vyenfita.com/api/v1/query?query=histogram_quantile(0.95,sum(rate(vyenfita_http_request_duration_ms_bucket[5m]))by(le))'
```

---

T+1 to T+8: Active Monitoring

Every 30 minutes:

Automated check:

```bash
#!/bin/bash
# launch-monitor.sh

echo "=== LAUNCH MONITOR ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Health
HEALTH=$(curl -s https://api.vyenfita.com/health | jq -r '.status')
echo "Health: $HEALTH"

# Pods
PODS=$(kubectl get pods -n vyenfita --no-headers | wc -l)
RUNNING=$(kubectl get pods -n vyenfita --no-headers | grep Running | wc -l)
echo "Pods: $RUNNING/$PODS running"

# Error rate
ERROR_RATE=$(curl -s 'https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_errors_total[5m]))' | jq -r '.data.result[0].value[1] // "0"')
echo "Error rate: $ERROR_RATE/s"

# Requests
REQ_RATE=$(curl -s 'https://prometheus.vyenfita.com/api/v1/query?query=sum(rate(vyenfita_http_requests_total[5m]))' | jq -r '.data.result[0].value[1] // "0"')
echo "Request rate: $REQ_RATE/s"

# Active tenants
TENANTS=$(kubectl exec -n vyenfita deployment/vyenfita-ai -- \
  node -e "const {prisma}=require('./dist/lib/database/client');prisma.tenant.count().then(n=>console.log(n)).finally(()=>process.exit(0))" 2>/dev/null || echo "N/A")
echo "Active tenants: $TENANTS"

echo ""
```

Run every 30 minutes:

```bash
while true; do
  ./launch-monitor.sh
  sleep 1800
done
```

At each checkpoint, post in #vyenfita-launch:

```
🟢 T+30 min checkpoint
- Health: healthy
- Pods: 3/3 running
- Error rate: <0.1%
- Request rate: 12 req/s
- Active tenants: 5

No issues. Monitoring continues.
```

---

T+8 to T+24: Passive Monitoring

Handoff at T+8

Handoff checklist:

☐ Review all metrics
☐ Document any issues
☐ Brief on-call team
☐ Update status page
☐ Send day-1 summary

Overnight Watch

· On-call: Standard rotation
· Alerts: Configured for anomalies
· Escalation: Automatic to senior engineer

---

T+24: Day 1 Review

10:00 UTC (Next Day) — Day 1 Retrospective

Review:

Metric Target Actual
Uptime 99.5% 
Error rate <1% 
P95 latency <500ms 
Active tenants 10+ 
Support tickets <5 
Critical bugs 0 

Decisions:

· Continue invite-only?
· Ready for public launch?
· Any rollbacks needed?

---

T+7: Week 1 Review

Metrics Review

Category Metric Week 1 Goal Actual
Growth New tenants 20 
Engagement Active users 100 
Quality Bug reports <10 
Performance Uptime 99.5% 
Business Cost/user <$1 

Decision Point

If all targets met:

· ✅ Proceed to public launch
· Announce publicly
· Scale infrastructure

If some targets missed:

· 🟡 Continue soft launch
· Fix issues
· Re-evaluate next week

If critical failures:

· 🔴 Pause launch
· Rollback if needed
· Post-mortem
· Retry later

---

Contingency Plans

If Error Rate Spikes (>5%)

1. Diagnose (5 min):
   ```bash
   kubectl logs -n vyenfita deployment/vyenfita-ai --tail=200 | grep ERROR
   ```
2. Mitigate:
   · If code issue: rollback
   · If capacity issue: scale up
   · If dependency issue: failover
3. Communicate:
   · Status page: "Investigating"
   · Team: Slack update
   · Stakeholders: email

If AI Provider Down

1. Automatic: Circuit breaker opens, falls back to alternate provider
2. Verify: Check /health shows degraded provider
3. Communicate: Status page update
4. Monitor: Wait for provider recovery

If Database Unreachable

1. Automatic: Circuit breaker + retry
2. If persistent: Failover to replica
3. Worst case: PITR restore

If DDoS Detected

1. Automatic: Rate limiting kicks in
2. Escalate: Enable Cloudflare protection
3. Communicate: Status page
4. Analyze: Post-incident

---

War Room Protocol

Channels

· Slack: #vyenfita-launch (main)
· Voice: Zoom room (link in #launch)
· Status: status.vyenfita.com

Roles

· Launch Commander: Owns decisions
· Comms Lead: Updates stakeholders
· Tech Lead: Executes fixes
· Scribe: Documents everything

Cadence

· Hour 0-2: Check every 15 min
· Hour 2-8: Check every 30 min
· Hour 8-24: Check hourly
· Day 2-7: Check twice daily

---

Communication Templates

Status Page — Investigating

```
[INVESTIGATING] We are investigating reports of [issue].
Started: [time]
Impact: [scope]
Next update: [time + 15 min]
```

Status Page — Identified

```
[IDENTIFIED] We have identified the cause of [issue].
Cause: [brief description]
Action: [what we're doing]
Next update: [time + 30 min]
```

Status Page — Monitoring

```
[MONITORING] A fix has been applied. We are monitoring for stability.
Next update: [time + 1 hour]
```

Status Page — Resolved

```
[RESOLVED] The issue has been resolved. All services are operational.
Duration: [X minutes]
Root cause: [brief description]
Post-mortem: [link, to be published in 48h]
```

---

Success Definition

Launch is successful when:

· ✅ Uptime > 99% for first 7 days
· ✅ Error rate < 1%
· ✅ P95 latency < 500ms
· ✅ 20+ active tenants
· ✅ <10 support tickets
· ✅ No critical bugs
· ✅ Positive user feedback
· ✅ Team morale high

If achieved → Public launch
If not → Iterate and retry

---

This runbook is a contract. Follow it exactly.

Last updated: 2026-09-16
