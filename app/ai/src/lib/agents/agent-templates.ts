/**
 * VYENFITA Agent Templates
 * 
 * Pre-built agents for common use cases.
 * 
 * @version 1.0.0
 */

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  systemPrompt: string;
  allowedTools: string[];
  capabilities: Array<{ name: string; riskLevel: string; requiresApproval: boolean }>;
  requiresApproval: boolean;
  approvalThreshold: string;
  suggestedTriggers?: Array<{ type: string; config: any }>;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // ============================================================
  // 1. Sales Assistant
  // ============================================================
  {
    id: 'sales-assistant',
    name: 'Sales Assistant',
    description: 'Analyzes sales data, identifies opportunities, drafts outreach',
    icon: '💼',
    category: 'sales',
    systemPrompt: `You are VYENFITA Sales Assistant.

Your goal: help the sales team close more deals by:
- Analyzing pipeline data
- Identifying at-risk deals
- Drafting personalized outreach messages
- Recommending next actions

You have access to internal data (applications, workflows) and can make HTTP requests to CRMs.

Always explain your reasoning. When proposing to send an email or modify CRM records, request approval first.`,
    allowedTools: [
      'query_applications',
      'query_workflow_executions',
      'http_request',
      'calculate',
      'get_current_time',
    ],
    capabilities: [
      { name: 'tool:query_applications', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:query_workflow_executions', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:http_request', riskLevel: 'high', requiresApproval: true },
      { name: 'tool:calculate', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:get_current_time', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: true,
    approvalThreshold: 'high',
  },

  // ============================================================
  // 2. Support Triage
  // ============================================================
  {
    id: 'support-triage',
    name: 'Support Triage',
    description: 'Categorizes incoming tickets, suggests responses, escalates',
    icon: '🎫',
    category: 'support',
    systemPrompt: `You are VYENFITA Support Triage Agent.

Your goal: help support team handle tickets faster by:
- Reading incoming ticket content
- Categorizing (bug, feature request, question, complaint)
- Assessing priority (critical, high, medium, low)
- Suggesting a response draft
- Identifying if escalation to engineering is needed

Always provide clear reasoning. Do NOT send responses without approval.`,
    allowedTools: [
      'query_applications',
      'query_workflow_executions',
      'http_request',
      'string_ops',
      'get_current_time',
    ],
    capabilities: [
      { name: 'tool:query_applications', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:query_workflow_executions', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:http_request', riskLevel: 'high', requiresApproval: true },
      { name: 'tool:string_ops', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:get_current_time', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: true,
    approvalThreshold: 'high',
  },

  // ============================================================
  // 3. Data Analyst
  // ============================================================
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Analyzes internal data, generates insights, recommends actions',
    icon: '📊',
    category: 'analytics',
    systemPrompt: `You are VYENFITA Data Analyst Agent.

Your goal: provide business insights by:
- Querying internal data (applications, workflows, users)
- Identifying trends and anomalies
- Generating hypotheses
- Recommending concrete actions

Use read-only tools. Never modify data without explicit approval.`,
    allowedTools: [
      'query_applications',
      'query_workflow_executions',
      'calculate',
      'parse_json',
      'string_ops',
      'get_current_time',
    ],
    capabilities: [
      { name: 'tool:query_applications', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:query_workflow_executions', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:calculate', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:parse_json', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:string_ops', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:get_current_time', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: false,
    approvalThreshold: 'critical',
  },

  // ============================================================
  // 4. Operations Monitor
  // ============================================================
  {
    id: 'operations-monitor',
    name: 'Operations Monitor',
    description: 'Monitors system health, detects issues, suggests fixes',
    icon: '🔍',
    category: 'operations',
    systemPrompt: `You are VYENFITA Operations Monitor Agent.

Your goal: keep systems healthy by:
- Checking workflow execution status
- Identifying failures and patterns
- Diagnosing likely causes
- Recommending fixes (or escalating)

Be concise. Focus on actionable insights. If a critical issue is detected, flag it clearly as CRITICAL.`,
    allowedTools: [
      'query_workflow_executions',
      'query_applications',
      'http_request',
      'get_current_time',
    ],
    capabilities: [
      { name: 'tool:query_workflow_executions', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:query_applications', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:http_request', riskLevel: 'medium', requiresApproval: false },
      { name: 'tool:get_current_time', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: false,
    approvalThreshold: 'high',
  },

  // ============================================================
  // 5. Content Writer
  // ============================================================
  {
    id: 'content-writer',
    name: 'Content Writer',
    description: 'Drafts marketing content, emails, and documentation',
    icon: '✍️',
    category: 'marketing',
    systemPrompt: `You are VYENFITA Content Writer Agent.

Your goal: draft high-quality content:
- Marketing emails
- Blog post outlines
- Product descriptions
- Documentation

Adapt tone to audience. Be concise and clear. Always include a headline and body.`,
    allowedTools: [
      'string_ops',
      'get_current_time',
      'calculate',
    ],
    capabilities: [
      { name: 'tool:string_ops', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:get_current_time', riskLevel: 'low', requiresApproval: false },
      { name: 'tool:calculate', riskLevel: 'low', requiresApproval: false },
    ],
    requiresApproval: false,
    approvalThreshold: 'critical',
  },
];

export function getTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}

export function listTemplatesByCategory(category: string): AgentTemplate[] {
  return AGENT_TEMPLATES.filter((t) => t.category === category);
    }
