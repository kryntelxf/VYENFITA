/**
 * VYENFITA FinOps Budget Unit Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant } from '../helpers/test-factory';
import { BudgetService } from '../../lib/finops/budget.service';

describe('BudgetService', () => {
  it('should create a budget', async () => {
    const tenant = await createTestTenant('budget-create');

    const budget = await BudgetService.create({
      tenantId: tenant.tenantId,
      limit: 1000,
      currency: 'USD',
      period: 'monthly',
      createdBy: tenant.userId,
    });

    expect(budget.id).toBeDefined();
    expect(budget.limit).toBe(1000);
    expect(budget.spent).toBe(0);
    expect(budget.period).toBe('monthly');
  });

  it('should add spend to budget', async () => {
    const tenant = await createTestTenant('budget-spend');

    const budget = await BudgetService.create({
      tenantId: tenant.tenantId,
      limit: 1000,
      period: 'monthly',
      createdBy: tenant.userId,
    });

    await BudgetService.addSpend(tenant.tenantId, 'ai_openai', 100);

    const status = await BudgetService.getStatus(budget.id, tenant.tenantId);
    expect(status).toBeDefined();
    expect(status!.budget.spent).toBe(100);
    expect(status!.utilization).toBe(10);
  });

  it('should check allowance (soft budget)', async () => {
    const tenant = await createTestTenant('budget-soft');

    await BudgetService.create({
      tenantId: tenant.tenantId,
      limit: 100,
      period: 'monthly',
      enforce: false,
      createdBy: tenant.userId,
    });

    await BudgetService.addSpend(tenant.tenantId, 'ai_openai', 150);

    const result = await BudgetService.checkAllowance(tenant.tenantId, 'ai_openai');
    expect(result.allowed).toBe(true); // soft budget allows
  });

  it('should check allowance (hard budget)', async () => {
    const tenant = await createTestTenant('budget-hard');

    await BudgetService.create({
      tenantId: tenant.tenantId,
      limit: 100,
      period: 'monthly',
      enforce: true,
      createdBy: tenant.userId,
    });

    await BudgetService.addSpend(tenant.tenantId, 'ai_openai', 150);

    const result = await BudgetService.checkAllowance(tenant.tenantId, 'ai_openai');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exceeded');
  });

  it('should list budgets for tenant', async () => {
    const tenant = await createTestTenant('budget-list');

    await BudgetService.create({
      tenantId: tenant.tenantId,
      service: 'ai_openai',
      limit: 500,
      period: 'monthly',
      createdBy: tenant.userId,
    });

    await BudgetService.create({
      tenantId: tenant.tenantId,
      service: 'compute',
      limit: 300,
      period: 'monthly',
      createdBy: tenant.userId,
    });

    const budgets = await BudgetService.list(tenant.tenantId);
    expect(budgets.length).toBe(2);
  });

  it('should not allow budget to be applied to other tenant', async () => {
    const tenantA = await createTestTenant('budget-iso-a');
    const tenantB = await createTestTenant('budget-iso-b');

    const budget = await BudgetService.create({
      tenantId: tenantA.tenantId,
      limit: 1000,
      period: 'monthly',
      createdBy: tenantA.userId,
    });

    // Tenant B tries to access Tenant A's budget
    const fetched = await BudgetService.get(budget.id, tenantB.tenantId);
    expect(fetched).toBeNull();
  });
});
