# VYENFITA Incident Response Plan

**Classification:** Internal — Critical
**Owner:** VYENFITA SRE Team
**Last Updated:** 2026-09-15

---

## Quick Reference

| Severity | Definition | Response | Escalation |
|----------|-----------|----------|-----------|
| **SEV1** | Complete outage, data breach | 15 min | Immediate |
| **SEV2** | Partial outage, security incident | 30 min | Within 30 min |
| **SEV3** | Degraded service | 4 hours | Within 2 hours |
| **SEV4** | Minor issue | 1 day | Next business day |

**Emergency Contacts:**
- On-Call: PagerDuty
- Slack: #vyenfita-ops
- Email: ops@vyenfita.com

---

## Incident Response Phases

### Phase 1: Detection & Triage (0-15 min)

**Actions:**
1. Acknowledge alert (PagerDuty)
2. Join incident Slack channel (#inc-YYYYMMDD-XXX)
3. Assess severity using matrix
4. Declare incident if SEV1/SEV2
5. Assign roles (see below)

**Detection Sources:**
- Automated alerts (Prometheus, PagerDuty)
- User reports (support tickets)
- Manual observation (on-call monitoring)
- External reports (social media, status page)

### Phase 2: Containment (15-30 min)

**Goals:**
- Stop the bleeding
- Prevent spread
- Preserve evidence

**Actions:**
1. Isolate affected components
2. Apply temporary mitigations
3. Scale down if DoS
4. Rollback if recent change

### Phase 3: Diagnosis (30-60 min)

**Actions:**
1. Review recent changes (git, deployments)
2. Check logs and metrics
3. Reproduce in staging
4. Identify root cause

**Key Questions:**
- What changed recently?
- What's the blast radius?
- What's the timeline?
- What's the impact?

### Phase 4: Fix (60-90 min)

**Actions:**
1. Implement fix in staging
2. Test thoroughly
3. Deploy to production
4. Monitor for regression

**Rollback Decision Tree:**
