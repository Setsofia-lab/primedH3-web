/**
 * Primary-journey smoke specs (Constitution §11 P1.3).
 *
 * One test per primary user journey. They run against the local dev
 * server in mock-auth mode (NEXT_PUBLIC_DEV_AUTH=1, set in the
 * playwright.config.ts webServer env) so no Cognito round-trips are
 * required. The /role picker is the entry point for assuming a role
 * identity; subsequent navigation works because the session is
 * persisted in localStorage by the role picker click.
 *
 * These specs intentionally don't deeply assert content shape —
 * they're regression smoke tests that catch route-level breakage
 * during UT iteration. Add deeper specs per journey as the journeys
 * stabilize.
 */
import { test, expect, type Page } from '@playwright/test';

async function pickRole(page: Page, label: string): Promise<void> {
  await page.goto('/role');
  // Each role tile is a button; the label appears on a heading inside.
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
}

test.describe('Primary journeys (mock-auth)', () => {
  test('marketing hero renders and CTAs are clickable', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /seamless perioperative care/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /try the interactive demo/i }).first(),
    ).toBeVisible();
  });

  test('admin can reach the admin home', async ({ page }) => {
    await pickRole(page, 'health-center admin');
    await page.waitForURL(/\/app\/admin/);
    // Admin home should display *some* heading; we don't pin the text
    // because the dashboard copy will iterate during UT.
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('surgeon lands on cases cockpit', async ({ page }) => {
    await pickRole(page, 'surgeon');
    await page.waitForURL(/\/app\/surgeon/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('anesthesia lands on the queue', async ({ page }) => {
    await pickRole(page, 'anesthesia');
    await page.waitForURL(/\/app\/anesthesia/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('coordinator lands on the kanban board', async ({ page }) => {
    await pickRole(page, 'coordinator');
    await page.waitForURL(/\/app\/coordinator/);
    // Kanban columns mirror Constitution §3.4 — at least 4 should
    // render (Referral / Workup / Clearance / Pre-hab).
    await expect(page.getByText(/referral/i).first()).toBeVisible();
    await expect(page.getByText(/workup/i).first()).toBeVisible();
    await expect(page.getByText(/clearance/i).first()).toBeVisible();
  });

  test('patient lands on PWA home and can open day-of checklist', async ({ page }) => {
    await pickRole(page, 'patient');
    await page.waitForURL(/\/app\/patient/);
    // Day-of CTA tile we added in P1.1.
    const dayOfLink = page.getByRole('link', { name: /day-of checklist/i });
    await expect(dayOfLink).toBeVisible();
    await dayOfLink.click();
    await page.waitForURL(/\/app\/patient\/day-of/);
    await expect(page.getByRole('heading', { name: /day-of/i })).toBeVisible();
    // Section titles from the procedure-aware checklist.
    await expect(page.getByRole('heading', { name: /eating/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /what to bring/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /getting home/i })).toBeVisible();
  });
});
