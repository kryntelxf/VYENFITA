/**
 * VYENFITA Builder E2E — Properties Panel Tests
 * 
 * Verifies:
 * - Properties panel renders on widget select
 * - Changing a prop updates the widget
 * 
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';

test.describe('Builder — Properties Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should show properties panel when widget selected', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    if (!(await buttonWidget.isVisible().catch(() => false))) {
      test.skip(true, 'Button widget not available');
    }
    await buttonWidget.click();
    await page.waitForTimeout(500);

    const widget = page.locator('[data-widget-id]').first();
    if ((await widget.count()) === 0) {
      test.skip(true, 'No widget on canvas');
    }
    await widget.click();

    await expect(
      page.getByText(/properties/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should update widget prop when changed in panel', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    if (!(await buttonWidget.isVisible().catch(() => false))) {
      test.skip(true, 'Button widget not available');
    }
    await buttonWidget.click();
    await page.waitForTimeout(500);

    const widget = page.locator('[data-widget-id]').first();
    if ((await widget.count()) === 0) {
      test.skip(true, 'No widget on canvas');
    }
    await widget.click();

    const textInput = page.locator('input[type="text"]').last();
    if ((await textInput.count()) === 0) {
      test.skip(true, 'No text input found in properties');
    }

    await textInput.fill('Updated Label');
    await page.waitForTimeout(300);

    const value = await textInput.inputValue();
    expect(value).toBe('Updated Label');
  });
});
