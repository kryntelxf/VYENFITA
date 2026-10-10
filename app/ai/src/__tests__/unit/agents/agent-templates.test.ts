/**
 * VYENFITA Agent Templates Unit Tests
 * 
 * Verifies:
 * - Template catalog
 * - getTemplate() lookup
 * - listTemplatesByCategory()
 * - Template structure validity
 * 
 * @version 1.0.0
 */

import {
  AGENT_TEMPLATES,
  getTemplate,
  listTemplatesByCategory,
} from '../../../lib/agents/agent-templates';

describe('Agent Templates', () => {
  describe('AGENT_TEMPLATES catalog', () => {
    it('should have at least 5 templates', () => {
      expect(AGENT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it('should include sales-assistant', () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === 'sales-assistant');
      expect(t).toBeDefined();
      expect(t?.category).toBe('sales');
    });

    it('should include support-triage', () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === 'support-triage');
      expect(t).toBeDefined();
      expect(t?.category).toBe('support');
    });

    it('should include data-analyst', () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === 'data-analyst');
      expect(t).toBeDefined();
      expect(t?.category).toBe('analytics');
    });

    it('should include operations-monitor', () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === 'operations-monitor');
      expect(t).toBeDefined();
      expect(t?.category).toBe('operations');
    });

    it('should include content-writer', () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === 'content-writer');
      expect(t).toBeDefined();
      expect(t?.category).toBe('marketing');
    });

    it('every template should have required fields', () => {
      for (const t of AGENT_TEMPLATES) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.systemPrompt).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(Array.isArray(t.allowedTools)).toBe(true);
        expect(Array.isArray(t.capabilities)).toBe(true);
      }
    });

    it('every template should have unique id', () => {
      const ids = AGENT_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('every template should have at least one allowed tool', () => {
      for (const t of AGENT_TEMPLATES) {
        expect(t.allowedTools.length).toBeGreaterThan(0);
      }
    });

    it('every template capability should have name and riskLevel', () => {
      for (const t of AGENT_TEMPLATES) {
        for (const cap of t.capabilities) {
          expect(cap.name).toBeTruthy();
          expect(['low', 'medium', 'high', 'critical']).toContain(cap.riskLevel);
          expect(typeof cap.requiresApproval).toBe('boolean');
        }
      }
    });

    it('every template should have a valid approvalThreshold', () => {
      for (const t of AGENT_TEMPLATES) {
        expect(['low', 'medium', 'high', 'critical']).toContain(t.approvalThreshold);
      }
    });
  });

  describe('getTemplate()', () => {
    it('should return template by id', () => {
      const t = getTemplate('sales-assistant');
      expect(t).toBeDefined();
      expect(t?.id).toBe('sales-assistant');
    });

    it('should return undefined for unknown id', () => {
      const t = getTemplate('nonexistent-template');
      expect(t).toBeUndefined();
    });

    it('should return same object as catalog', () => {
      const fromCatalog = AGENT_TEMPLATES.find((t) => t.id === 'data-analyst');
      const fromFunction = getTemplate('data-analyst');
      expect(fromFunction).toBe(fromCatalog);
    });
  });

  describe('listTemplatesByCategory()', () => {
    it('should return only templates of given category', () => {
      const sales = listTemplatesByCategory('sales');
      expect(sales.length).toBeGreaterThan(0);
      expect(sales.every((t) => t.category === 'sales')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const result = listTemplatesByCategory('nonexistent-category');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = listTemplatesByCategory('');
      expect(result).toEqual([]);
    });

    it('should include all templates for their respective categories', () => {
      const allTemplates = AGENT_TEMPLATES;
      for (const t of allTemplates) {
        const inCategory = listTemplatesByCategory(t.category);
        expect(inCategory).toContain(t);
      }
    });
  });
});
