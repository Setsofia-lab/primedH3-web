import { test, expect } from '@playwright/test';

test('home page renders the proof button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /design tokens loaded/i })).toBeVisible();
});
