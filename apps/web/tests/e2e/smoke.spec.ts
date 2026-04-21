import { test, expect } from '@playwright/test';

test('home page renders the marketing hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /seamless perioperative care/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /try the interactive demo/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /get consult/i }).first()).toBeVisible();
});
