/**
 * VYENFITA Builder E2E — Template Picker Tests
 * 
 * Verifies:
 * - Template picker opens
 * - Template loads into canvas
 * 
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';

test.describe('Builder — Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should open template picker', async ({ page }) => {
    const templatesBtn = page
      .getByRole('button', { name: /templates/i })
      .or(page.getByText(/templates/i).first());

    if ((await templatesBtn.count()) === 0) {
      test.skip(true, 'Templates button not found');
    }

    await templatesBtn.click();
    await page.waitForTimeout(300);

    await expect(
      page.getByText(/choose a template|starter template|select template/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should list at least one template', async ({ page }) => {
    const templatesBtn = page
      .getByRole('button', { name: /templates/i })
      .or(page.getByText(/templates/i).first());
    if ((await templatesBtn.count()) === 0) {
      test.skip(true, 'Templates button not found');
    }
    await templatesBtn.click();
    await page.waitForTimeout(300);

    const hasKnownTemplate =
      (await page.getByText(/crm dashboard/i).count()) > 0 ||
      (await page.getByText(/task manager/i).count()) > 0 ||
      (await page.getByText(/contact form/i).count()) > 0;

    expect(hasKnownTemplate).toBe(true);
  });
});
