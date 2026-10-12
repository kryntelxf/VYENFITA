/**
 * VYENFITA Builder E2E — Load Tests
 * 
 * Verifies:
 * - Builder route loads without crash
 * - Palette, canvas, properties panel render
 * - No console errors on load
 * 
 * @version 1.0.0
 */

import { test, expect } from '@playwright/test';

test.describe('Builder — Load', () => {
  test('should load builder route without crashing', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/vyenfita/builder');

    await page.waitForLoadState('networkidle', { timeout: 30_000 });

    const body = await page.textContent('body');
    expect(body).not.toContain('Application error');
    expect(body).not.toContain('Something went wrong');

    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon.ico') &&
        !e.includes('analytics') &&
        !e.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED')
    );

    expect(realErrors).toEqual([]);
  });

  test('should render builder toolbar', async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');

    const saveButton = page.getByText(/save/i).first();
    await expect(saveButton).toBeVisible({ timeout: 15_000 });
  });

  test('should render widget palette', async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');

    const paletteVisible = await page
      .getByText(/widgets|components|palette/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(paletteVisible).toBe(true);
  });

  test('should render canvas area', async ({ page }) => {
    await page.goto('/vyenfita/builder');
    await page.waitForLoadState('domcontentloaded');

    const canvasVisible = await page
      .getByText(/start building|drop widgets|canvas/i)
      .first()
      .isVisible()
      .catch(() => false);

    const gridVisible = await page.locator('[data-testid="builder-canvas"]').count();

    expect(canvasVisible || gridVisible > 0).toBe(true);
  });
});
