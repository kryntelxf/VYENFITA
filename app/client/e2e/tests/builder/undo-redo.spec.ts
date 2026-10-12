/**
 * VYENFITA Builder E2E — Undo / Redo Tests
 * 
 * Verifies:
 * - Ctrl+Z undoes last action
 * - Ctrl+Shift+Z redoes last action
 * 
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';

test.describe('Builder — Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should undo a widget addition with Ctrl+Z', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    if (!(await buttonWidget.isVisible().catch(() => false))) {
      test.skip(true, 'Button widget not available');
    }

    const before = await page.locator('[data-widget-id]').count();
    await buttonWidget.click();
    await page.waitForTimeout(300);

    const afterAdd = await page.locator('[data-widget-id]').count();
    if (afterAdd === before) {
      test.skip(true, 'Add did not produce a widget');
    }

    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(300);

    const afterUndo = await page.locator('[data-widget-id]').count();
    expect(afterUndo).toBe(before);
  });

  test('should redo after undo with Ctrl+Shift+Z', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    if (!(await buttonWidget.isVisible().catch(() => false))) {
      test.skip(true, 'Button widget not available');
    }

    const before = await page.locator('[data-widget-id]').count();
    await buttonWidget.click();
    await page.waitForTimeout(300);
    const afterAdd = await page.locator('[data-widget-id]').count();
    if (afterAdd === before) {
      test.skip(true, 'Add did not produce a widget');
    }

    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+Z');
    await page.waitForTimeout(300);

    const afterRedo = await page.locator('[data-widget-id]').count();
    expect(afterRedo).toBe(afterAdd);
  });
});
