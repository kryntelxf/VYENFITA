
# VYENFITA Go-Live Checklist

**Purpose:** Step-by-step checklist for production launch
**Owner:** Release Manager
**Duration:** 2-3 hours
**Date:** _____

---

## Pre-Launch (T-7 days)

### Engineering

- [ ] All tests passing in CI
- [ ] All PRs merged and reviewed
- [ ] Version tagged (`git tag v3.0.0`)
- [ ] Release notes drafted
- [ ] Rollback plan documented

### Security

- [ ] Security audit complete
- [ ] No critical vulnerabilities
- [ ] All secrets rotated
- [ ] Penetration test scheduled (if not done)

### Operations

- [ ] Production infrastructure provisioned
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] Backup verification complete
- [ ] DR drill passed

### Product

- [ ] Feature freeze announced
- [ ] User documentation ready
- [ ] Support team trained
- [ ] Marketing materials ready

### Business

- [ ] Pricing finalized
- [ ] Terms of service ready
- [ ] Privacy policy ready
- [ ] Customer support ready

---

## Pre-Launch (T-1 day)

### Final Verification

- [ ] Production deployment successful
- [ ] Smoke tests passing
- [ ] Health checks green
- [ ] Key features work manually
- [ ] No errors in logs (last 6 hours)

### Team Readiness

- [ ] On-call schedule confirmed
- [ ] Communication channels ready
- [ ] Escalation paths documented
- [ ] Rollback procedure reviewed

### Communication

- [ ] Internal announcement drafted
- [ ] Status page prepared
- [ ] Launch message ready
- [ ] Stakeholder notification sent

---

## Launch Day (T-0)

### Hour 0: Pre-Launch

- [ ] All team members online
- [ ] Standup to confirm readiness
- [ ] Final production deployment
- [ ] Verify service health
- [ ] Enable registration (invite-only)

### Hour 1: Initial Watch

- [ ] First 10 users onboarded
- [ ] No errors in logs
- [ ] Response times normal
- [ ] AI generation working
- [ ] Workflows executing

### Hour 2-8: Active Monitoring

- [ ] Check dashboards every 30 min
- [ ] Review error rates
- [ ] Monitor cost
- [ ] Address any issues immediately
- [ ] Document everything

### Hour 8-24: Passive Monitoring

- [ ] Handoff to on-call
- [ ] Review first-day metrics
- [ ] Prepare day-2 report
- [ ] Respond to feedback

---

## Post-Launch (T+1 to T+7)

### Daily

- [ ] Review metrics (morning)
- [ ] Address user feedback
- [ ] Fix bugs (prioritized)
- [ ] Update docs
- [ ] Internal standup

### Weekly

- [ ] Week 1 report
- [ ] Retrospective
- [ ] Adjust priorities
- [ ] Plan Week 2

---

## Rollback Trigger

Rollback if:

- [ ] Critical bug affecting >50% users
- [ ] Data loss/corruption detected
- [ ] Security breach confirmed
- [ ] Cost runaway (>5x expected)
- [ ] >30% error rate for >15 min

**Rollback Procedure:**

```bash
# 1. Announce rollback
echo "Initiating rollback to v2.9.x"

# 2. Rollback via Helm
helm rollback vyenfita -n vyenfita

# 3. Verify
kubectl rollout status deployment/vyenfita-ai -n vyenfita
curl https://api.vyenfita.com/health

# 4. Notify
# - Internal team
# - Stakeholders
# - Users (status page)
```

---

Launch Command

Execute in order:

```bash
# 1. Final deployment
helm upgrade --install vyenfita deploy/helm/vyenfita \
  --namespace vyenfita \
  --set ai.image.tag=3.0.0 \
  --wait

# 2. Verify deployment
kubectl get pods -n vyenfita
curl https://api.vyenfita.com/health

# 3. Enable registration
kubectl set env deployment/appsmith -n vyenfita APPSMITH_SIGNUP_DISABLED=false

# 4. Announce
# - Slack #general
# - Email to stakeholders
```

---

Success Criteria

After 7 days:

☐ Uptime > 99.5%
☐ Error rate < 1%
☐ P95 latency < 500ms
☐ 10+ active tenants
☐ No critical bugs
☐ Positive user feedback

If all checked → Public launch
If not → Iterate

---

Sign-off:

Role Name Time
Release Manager  
Engineering Lead  
Product Lead  

---

This checklist is a contract. Follow it.
