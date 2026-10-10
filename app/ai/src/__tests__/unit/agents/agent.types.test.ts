/**
 * VYENFITA Agent Types Unit Tests
 * 
 * Verifies:
 * - Error classes and their properties
 * - Risk level ordering
 * - Default config values
 * - Type constants
 * 
 * @version 1.0.0
 */

import {
  AgentError,
  AgentNotFoundError,
  AgentCapabilityError,
  AgentApprovalRequiredError,
  AgentLimitExceededError,
  AgentTimeoutError,
  DEFAULT_AGENT_CONFIG,
  RISK_LEVEL_ORDER,
} from '../../../lib/agents/agent.types';

describe('Agent Types', () => {
  describe('AgentError', () => {
    it('should construct with message, code, statusCode, retryable', () => {
      const error = new AgentError('Test error', 'TEST_CODE', 400, true);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('AgentError');
    });

    it('should default statusCode to 400 and retryable to false', () => {
      const error = new AgentError('Test', 'CODE');

      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('should be instanceof Error', () => {
      const error = new AgentError('Test', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AgentNotFoundError', () => {
    it('should have correct code and status', () => {
      const error = new AgentNotFoundError('agent-123');

      expect(error.message).toContain('agent-123');
      expect(error.code).toBe('AGENT_NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('AgentCapabilityError', () => {
    it('should have correct code and status', () => {
      const error = new AgentCapabilityError('execute:shell');

      expect(error.message).toContain('execute:shell');
      expect(error.code).toBe('CAPABILITY_DENIED');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('AgentApprovalRequiredError', () => {
    it('should include stepId and reason', () => {
      const error = new AgentApprovalRequiredError('step-1', 'Destructive action');

      expect(error.message).toContain('step-1');
      expect(error.message).toContain('Destructive action');
      expect(error.code).toBe('APPROVAL_REQUIRED');
      expect(error.statusCode).toBe(202);
    });
  });

  describe('AgentLimitExceededError', () => {
    it('should include limit name and value', () => {
      const error = new AgentLimitExceededError('maxTokens', 100000);

      expect(error.message).toContain('maxTokens');
      expect(error.message).toContain('100000');
      expect(error.code).toBe('LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
    });
  });

  describe('AgentTimeoutError', () => {
    it('should include timeout seconds', () => {
      const error = new AgentTimeoutError(300);

      expect(error.message).toContain('300');
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(408);
    });
  });

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_AGENT_CONFIG.model).toBeDefined();
      expect(DEFAULT_AGENT_CONFIG.temperature).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_AGENT_CONFIG.temperature).toBeLessThanOrEqual(1);
      expect(DEFAULT_AGENT_CONFIG.maxSteps).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.maxTokensPerRun).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.maxDurationSeconds).toBeGreaterThan(0);
      expect(DEFAULT_AGENT_CONFIG.requiresApproval).toBe(true);
      expect(DEFAULT_AGENT_CONFIG.approvalThreshold).toBe('high');
    });

    it('should have maxSteps default of 20', () => {
      expect(DEFAULT_AGENT_CONFIG.maxSteps).toBe(20);
    });

    it('should have maxDuration of 300 seconds (5 min)', () => {
      expect(DEFAULT_AGENT_CONFIG.maxDurationSeconds).toBe(300);
    });
  });

  describe('RISK_LEVEL_ORDER', () => {
    it('should order risk levels correctly', () => {
      expect(RISK_LEVEL_ORDER.low).toBeLessThan(RISK_LEVEL_ORDER.medium);
      expect(RISK_LEVEL_ORDER.medium).toBeLessThan(RISK_LEVEL_ORDER.high);
      expect(RISK_LEVEL_ORDER.high).toBeLessThan(RISK_LEVEL_ORDER.critical);
    });

    it('should have all 4 levels', () => {
      expect(Object.keys(RISK_LEVEL_ORDER)).toEqual(
        expect.arrayContaining(['low', 'medium', 'high', 'critical'])
      );
      expect(Object.keys(RISK_LEVEL_ORDER).length).toBe(4);
    });
  });
});
