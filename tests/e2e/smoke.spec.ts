import { test, expect } from '@playwright/test';

test('home page renders the marketing hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /perioperative coordination made/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /book a meeting/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /see a demo/i })).toBeVisible();
});
