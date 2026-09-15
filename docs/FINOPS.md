# VYENFITA FinOps Guide

**Classification:** Internal — Operations
**Owner:** VYENFITA Finance + Engineering
**Last Updated:** 2026-09-15

---

## Overview

VYENFITA's FinOps system provides:

1. **Full cost attribution** — every cost has a tenant, user, service, operation
2. **Budget management** — soft alerts and hard limits
3. **Optimization recommendations** — actionable savings based on real data
4. **Anomaly detection** — catch runaway costs before they explode
5. **Customer showback** — tenants see their own costs

---

## Cost Model

### Cost Categories

| Category | Description | Typical % of Total |
|----------|-------------|-------------------|
| `ai_openai` | OpenAI API calls | 40-60% |
| `ai_anthropic` | Anthropic API calls | 5-15% |
| `compute` | EKS node hours | 15-25% |
| `database` | RDS instance + storage | 10-15% |
| `cache` | ElastiCache | 3-5% |
| `storage` | S3 + EBS | 2-5% |
| `network` | Data transfer | 2-5% |

### Cost Attribution

Every cost event has:

```

{
tenantId: "uuid",
userId: "uuid",         // who triggered it
service: "ai_openai",   // which service
operation: "generate_application", // what operation
quantity: 1234,         // how much
unit: "tokens",
unitCost: 0.00001,     // per unit
totalCost: 0.01234,    // total
currency: "USD",
metadata: { ... }       // extra context
}

```

---

## Budgets

### Creating a Budget

```bash
curl -X POST https://api.vyenfita.com/api/v1/finops/budgets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "ai_openai",
    "limit": 1000,
    "currency": "USD",
    "period": "monthly",
    "alertThresholds": [50, 80, 100],
    "enforce": true
  }'
```

Budget Behaviors

Behavior Without enforce With enforce
Exceed budget Warning + alert Request blocked
Threshold reached Email notification Email notification
Auto-reset Yes, per period Yes, per period

Recommended Budget Structure

For a typical tenant:

Service Period Limit Enforce
all Monthly $5000 false (soft)
ai_openai Monthly $3000 true (hard)
ai_anthropic Monthly $1000 true
compute Monthly $800 false

---

Optimization Recommendations

Categories

1. Caching — enable response caching for repeated operations
2. Model Selection — downgrade models for simple tasks
3. Batching — combine requests
4. Cleanup — remove unused resources
5. Architecture — redesign for cost efficiency

Priority Scoring

Score Meaning Action
9-10 Critical Fix immediately
7-8 High Fix within a week
5-6 Medium Fix within a month
1-4 Low Consider for future

Example Recommendation

```json
{
  "title": "Reduce high-cost AI requests",
  "description": "Detected 47 AI requests that cost 5x the average...",
  "estimatedMonthlySavings": 234.50,
  "estimatedSavingsPercentage": 12.3,
  "effort": "medium",
  "impact": "high",
  "priority": 9,
  "category": "model_selection",
  "actionRequired": "Review high-cost requests and identify which can use cheaper models"
}
```

---

Anomaly Detection

Detection Types

Type Trigger Severity
spike Daily cost > 2 std dev above mean medium-high
drift Gradual increase over 7 days low-medium
unexpected_service Service not used before medium
runaway Single event > 5 std dev critical

Handling Anomalies

Critical anomalies trigger:

· Immediate Slack alert
· PagerDuty page (SEV2)
· Auto-pause of non-essential operations (if configured)

Investigation workflow:

1. Check tenant's recent activity
2. Verify legitimate business spike vs. attack/bug
3. If attack — apply rate limit / block
4. If bug — file ticket and mitigate
5. If legitimate — adjust budget

---

Showback & Chargeback

Showback (Internal)

Each tenant sees:

· Their cost breakdown
· Budget status
· Optimization recommendations
· Historical trends

Accessible via /api/v1/finops/summary and VYENFITA UI.

Chargeback (Billing)

For paid plans, monthly cost is used to:

· Calculate usage-based charges
· Generate invoices
· Detect overage

Integration with billing system:

· Daily export to Stripe via webhook
· Monthly reconciliation
· Audit trail for every charge

---

Cost Dashboard

Internal Dashboard

Metrics:

· Total platform cost
· Cost by tenant (top 10)
· Cost by service
· Cost trends (7d, 30d, 90d)
· Budget health across all tenants
· Anomaly count
· Optimization opportunities

Access: Grafana → VYENFITA FinOps dashboard

Customer Dashboard

Available in VYENFITA UI:

· Current month cost
· Budget utilization
· Top services
· Historical trend chart
· Recommendations

---

Operations

Daily Tasks

☐ Review overnight anomalies
☐ Check budget alerts
☐ Verify cost attribution working

Weekly Tasks

☐ Review top spenders
☐ Check for anomalies in trends
☐ Process optimization recommendations

Monthly Tasks

☐ Reconcile costs with AWS bill
☐ Update budgets based on actual spend
☐ Generate showback reports

Quarterly Tasks

☐ Review pricing model
☐ Analyze cost trends
☐ Update optimization strategy

---

Cost Reduction Playbook

Tier 1: Quick Wins (Low effort, high impact)

Action Typical Savings
Enable response caching 15-30%
Downgrade simple tasks to smaller models 10-20%
Set hard budgets Prevents overruns
Clean up old artifacts 5-10%

Tier 2: Medium Effort

Action Typical Savings
Batch AI requests 10-20%
Optimize database queries 5-15%
Move cold storage to S3-IA 3-8%
Right-size EKS nodes 10-20%

Tier 3: Architectural

Action Typical Savings
Multi-provider AI routing 15-30%
Self-hosted LLM for simple tasks 30-50%
Regional cost optimization 10-20%
Reserved instances 30-40%

---

Troubleshooting

Cost Attribution Not Working

Check:

1. CostAttributionService.record() is called
2. Database connection is up
3. usage_records table has entries
4. cost_records table has entries

Budget Not Triggering

Check:

1. Budget is not soft (enforce = true)
2. BudgetService.addSpend() is called after each cost
3. Budget spent field is updating
4. Thresholds are reasonable

Anomaly False Positives

Tune:

· Increase stdDev threshold (default 2)
· Extend lookback period
· Add service whitelist
· Adjust per-tenant sensitivity

---

Metrics

Key FinOps metrics:

Metric Target
Cost attribution coverage 100%
Budget alert delivery < 5 min
Anomaly detection latency < 1 hour
Optimization recommendation accuracy 80%
Customer showback freshness < 24h

---

References

· Architecture
· Database Schema
· Incident Response

---

This document is a living artifact. Update it as the FinOps system evolves.
