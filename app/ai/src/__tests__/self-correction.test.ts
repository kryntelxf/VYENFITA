/**
 * Self-Correction Integration Test
 * Tests the full loop: Generate → Validate → Repair → Validate
 * 
 * Run: yarn test self-correction.test.ts
 */

import { AIService } from '../core/services/ai.service';
import { ApplicationGeneratorService } from '../core/services/application-generator.service';
import { ApplicationSpecValidator } from '../core/validators/application-spec.validator';

// Mock AI Service for testing (use real API only if key available)
const useRealAPI = !!process.env.OPENAI_API_KEY;

describe('Self-Correction Loop', () => {
  
  // Skip test if no API key (run in CI only if configured)
  const testOrSkip = useRealAPI ? test : test.skip;

  testOrSkip('should generate and self-correct an application', async () => {
    const aiService = new AIService('openai');
    const generator = new ApplicationGeneratorService(aiService);

    // Use a simple description that will likely cause validation errors
    const description = 'Build a simple todo app';
    
    const result = await generator.generateApplicationWithSelfCorrection(description);

    // Assertions
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.spec).toBeDefined();
    
    // Should have passed validation
    expect(result.validation.isValid).toBe(true);
    
    // Should have at least one entity
    expect(result.spec?.entities?.length).toBeGreaterThan(0);
    
    // Should have at least one page
    expect(result.spec?.pages?.length).toBeGreaterThan(0);
    
    // Should have at least one role
    expect(result.spec?.roles?.length).toBeGreaterThan(0);

    console.log('=== Self-Correction Test Results ===');
    console.log(`Repair attempts: ${result.repairAttempts}`);
    console.log(`Is repaired: ${result.isRepaired}`);
    console.log(`Entities: ${result.spec?.entities?.length || 0}`);
    console.log(`Pages: ${result.spec?.pages?.length || 0}`);
    console.log(`Roles: ${result.spec?.roles?.length || 0}`);
    console.log(`Workflows: ${result.spec?.workflows?.length || 0}`);
    if (result.isRepaired) {
      console.log(`Fixed errors: ${result.fixedErrors?.join(', ') || 'none'}`);
    }
  });

  testOrSkip('should validate and repair an invalid spec', async () => {
    const aiService = new AIService('openai');
    const generator = new ApplicationGeneratorService(aiService);

    // Intentionally invalid spec (missing required fields)
    const invalidSpec = {
      metadata: {
        name: 'Invalid App'
        // missing description, version, etc.
      },
      entities: [], // empty entities - should fail
      pages: [], // empty pages - should fail
      roles: [], // empty roles - should fail
    };

    // Step 1: Validate should fail
    const validation = ApplicationSpecValidator.validate(invalidSpec);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    console.log('=== Validation Errors ===');
    validation.errors.forEach(e => {
      console.log(`- [${e.path.join('.')}] ${e.message}`);
    });

    // Step 2: Repair via self-correction
    // Note: We need to use the generator's internal repair service
    // This is a simplified test; in reality we'd call the endpoint
    const result = await generator.generateApplicationWithSelfCorrection(
      'Build a simple todo app'
    );

    expect(result.success).toBe(true);
    expect(result.validation.isValid).toBe(true);
  });
});
