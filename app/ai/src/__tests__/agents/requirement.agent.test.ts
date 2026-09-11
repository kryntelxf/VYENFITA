/**
 * VYENFITA Requirement Agent Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { RequirementAgent } from '../../lib/agents/requirement.agent';
import { createTestTenant } from '../helpers/test-factory';

describe('Requirement Agent', () => {
  let agent: RequirementAgent;
  let tenant: any;

  beforeAll(async () => {
    agent = new RequirementAgent();
    tenant = await createTestTenant('req-agent');
  });

  it('should reject short input', () => {
    const result = agent.validate({ description: 'short' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject missing input', () => {
    const result = agent.validate({} as any);
    expect(result.valid).toBe(false);
  });

  it('should accept valid input', () => {
    const result = agent.validate({
      description: 'Build a customer support platform for 50 agents.',
    });
    expect(result.valid).toBe(true);
  });

  it('should have correct capabilities', () => {
    expect(agent.capabilities.length).toBeGreaterThan(0);
    expect(agent.capabilities[0].name).toBe('analyze_requirements');
    expect(agent.capabilities[0].destructive).toBe(false);
  });

  // Integration test with AI provider (only runs if API key exists)
  const testWithAI = process.env.OPENAI_API_KEY ? it : it.skip;

  testWithAI(
    'should generate requirements from description',
    async () => {
      const result = await agent.execute({
        agent: 'requirement',
        input: {
          description:
            'Build a simple todo application where users can create, complete, and delete tasks.',
        },
        context: {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: 'test-request-1',
        },
      });

      expect(result.agent).toBe('requirement');
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output?.users).toBeDefined();
      expect(result.output?.features).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.tokensUsed).toBeGreaterThan(0);
    },
    60000
  );
});
