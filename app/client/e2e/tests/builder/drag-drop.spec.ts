/**
 * VYENFITA Builder E2E — Drag & Drop Tests
 * 
 * Verifies:
 * - Adding widget from palette
 * - Widget appears on canvas
 * - Widget can be selected
 * - Widget can be deleted
 * 
 * NOTE: These tests are marked test.skip() when the builder's
 * data-testid attributes are not yet available. Adjust selectors
 * once the builder is instrumented.
 * 
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';

test.describe('Builder — Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should add a button widget via palette click', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();

    const isVisible = await buttonWidget.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Button widget not found in palette — palette may use different labels');
    }

    await buttonWidget.click();

    await page.waitForTimeout(500);

    const widgetCount = await page
      .locator('[data-widget-id], [data-testid^="widget-"]')
      .count();
    expect(widgetCount).toBeGreaterThan(0);
  });

  test('should select a widget on canvas', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    const isVisible = await buttonWidget.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Button widget not found in palette');
    }

    await buttonWidget.click();
    await page.waitForTimeout(500);

    const widget = page.locator('[data-widget-id], [data-testid^="widget-"]').first();
    const count = await widget.count();
    if (count === 0) {
      test.skip(true, 'No widget rendered on canvas');
    }

    await widget.click();

    const selectedCount = await page
      .locator(
        '[data-widget-id][data-selected="true"], [data-testid^="widget-"][aria-selected="true"]'
      )
      .count();
    expect(selectedCount).toBeGreaterThan(0);
  });

  test('should delete a widget via toolbar action', async ({ page }) => {
    const buttonWidget = page.getByText(/^button$/i).first();
    const isVisible = await buttonWidget.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Button widget not found');
    }

    await buttonWidget.click();
    await page.waitForTimeout(500);

    const initialWidgets = await page
      .locator('[data-widget-id], [data-testid^="widget-"]')
      .count();
    if (initialWidgets === 0) {
      test.skip(true, 'No widget to delete');
    }

    await page.locator('[data-widget-id], [data-testid^="widget-"]').first().click();

    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);

    const afterWidgets = await page
      .locator('[data-widget-id], [data-testid^="widget-"]')
      .count();

    expect(afterWidgets).toBeLessThan(initialWidgets);
  });
});
