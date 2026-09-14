
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
```

Is fix < 15 min away?
├─ Yes → Fix forward
└─ No → Rollback
└─ Is rollback safe?
├─ Yes → Rollback
└─ No → Fix forward

```

### Phase 5: Recovery (90-120 min)

**Actions:**
1. Verify service restored
2. Run smoke tests
3. Monitor for stability
4. Communicate resolution
5. Schedule PIR

---

## Roles

### Incident Commander (IC)

**Responsibilities:**
- Declare severity
- Assign roles
- Make decisions
- Own communication

**Must:**
- Stay calm
- Think out loud
- Delegate effectively
- Document everything

### Communications Lead (CL)

**Responsibilities:**
- Status page updates
- Stakeholder notifications
- External communication

**Cadence:**
- SEV1: Every 15 min
- SEV2: Every 30 min
- SEV3: Every hour

### Operations Lead (OL)

**Responsibilities:**
- Execute recovery procedures
- Coordinate technical work
- Report progress to IC

### Scribe

**Responsibilities:**
- Document timeline
- Record decisions
- Capture action items

---

## Communication Templates

### Initial Notification (SEV1)

```

[INVESTIGATING] We are aware of an issue affecting VYENFITA services.
Our team is actively investigating. Next update in 15 minutes.

Started: 2026-09-15 10:30 UTC
Affected: API, Dashboard
Impact: Elevated error rates

```

### Update

```

[UPDATE] Investigation ongoing. We have identified the issue and are
implementing a fix. Next update in 30 minutes.

```

### Resolution

```

[RESOLVED] The issue has been resolved. All services are operational.
We will publish a post-mortem within 48 hours.

Duration: 45 minutes
Root cause: Database connection pool exhaustion

```

---

## Incident Log Template

```markdown
# Incident Log: INC-20260915-001

**Date:** 2026-09-15
**Severity:** SEV1
**IC:** Alice
**Scribe:** Bob

## Timeline

| Time (UTC) | Event |
|-----------|-------|
| 10:30 | Alert fired: high error rate |
| 10:32 | On-call acknowledged |
| 10:35 | Incident declared |
| 10:40 | CL posted status page update |
| 10:45 | Root cause identified (connection pool) |
| 10:50 | Fix implemented in staging |
| 11:00 | Fix deployed to production |
| 11:10 | Service restored |
| 11:15 | Status page updated to RESOLVED |

## Actions Taken

1. Scaled up connection pool
2. Restarted affected pods
3. Verified health checks

## Action Items

- [ ] Increase default connection pool size (@alice, 2026-09-20)
- [ ] Add proactive alert for connection pool > 70% (@bob, 2026-09-22)
- [ ] Update runbook (@charlie, 2026-09-18)
```

---

Post-Incident Review

Timeline:

· SEV1: Within 48 hours
· SEV2: Within 5 business days
· SEV3: Optional

Attendees:

· Incident Commander
· Responders
· Engineering Manager
· Product Owner (if customer-facing)
· Executive Sponsor (SEV1)

Output:

· Written PIR document
· Action items with owners + deadlines
· Lessons learned
· Process improvements

---

Severity Classification Guide

SEV1 Criteria

· Complete service outage
· Data loss or corruption
· Security breach confirmed
· Major customer impact (>50% affected)
· Revenue impact > $10k/hour

SEV2 Criteria

· Partial service degradation
· Single major feature unavailable
· Security concern (unconfirmed)
· Moderate customer impact (10-50%)
· Revenue impact $1k-10k/hour

SEV3 Criteria

· Minor feature degraded
· Performance below SLO but functional
· Low customer impact (<10%)
· Revenue impact < $1k/hour

SEV4 Criteria

· Cosmetic issues
· Documentation problems
· Feature requests
· Internal-only issues

---

Common Incident Playbooks

Playbook: High Error Rate

1. Assess scope — single tenant or all?
2. Check recent changes — deployments, config
3. Review logs — error patterns
4. Check dependencies — DB, AI providers, external APIs
5. Mitigation options:
   · Rollback recent deploy
   · Disable failing feature (feature flag)
   · Scale up resources
   · Route traffic to healthy region

Playbook: Database Unavailable

1. Verify DB status — AWS console, CLI
2. Check connection pool — active vs max
3. Check network — security groups, VPC
4. Mitigation:
   · Restart DB if safe
   · Failover to replica
   · Restore from snapshot (last resort)

Playbook: AI Provider Down

1. Verify provider status — status.openai.com
2. Check circuit breaker — is it open?
3. Check fallback provider — is it configured?
4. Mitigation:
   · Failover to backup provider
   · Disable AI features temporarily
   · Queue requests for retry

Playbook: Security Incident

1. Isolate — disconnect affected systems
2. Preserve — snapshot volumes, save logs
3. Notify — security team, legal, exec
4. Investigate — determine scope and vector
5. Contain — block attacker, rotate credentials
6. Eradicate — remove threat
7. Recover — restore from clean state
8. Communicate — customers, regulators (if required)

---

Training & Drills

Onboarding

New SREs must:

· Read this document
· Complete incident response training
· Shadow 2 incidents
· Lead 1 incident (with backup)

Regular Drills

Drill Frequency Duration
Tabletop exercise Monthly 1 hour
Live incident simulation Quarterly 2 hours
Full DR drill Semi-annual 8 hours

Drill Scenarios

1. Database failure — RDS goes down, failover required
2. Security breach — credential leak detected
3. Regional outage — primary region unavailable
4. DDoS attack — traffic spike 100x normal
5. Data corruption — PITR required

---

Metrics & KPIs

Incident Metrics

Metric Target Current
MTTD (Mean Time to Detect) < 5 min ?
MTTA (Mean Time to Acknowledge) < 10 min ?
MTTM (Mean Time to Mitigate) < 30 min ?
MTTR (Mean Time to Resolve) < 2 hours ?
Incident recurrence rate < 5% ?

SLO Tracking

Service SLO Current
Availability 99.9% ?
Latency (p95) < 500ms ?
Error rate < 0.1% ?

---

Continuous Improvement

After every incident:

1. ✅ Conduct PIR
2. ✅ Document action items
3. ✅ Implement improvements
4. ✅ Update runbooks
5. ✅ Share learnings

Blameless culture: Focus on systems, not people.

---

References

· Runbook — Operational procedures
· Disaster Recovery — DR plan
· Architecture — System overview

---

This document is a living artifact. Update it after every incident.
