import { test, expect } from '@playwright/test';

test('landing → intake → chat redirect', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Tell us about your NGO/i)).toBeVisible();

  await page.getByPlaceholder(/yourngo\.org/).fill('https://www.tech4dev.org');
  await page.getByPlaceholder(/KoboToolbox/).fill('We use KoboToolbox and Excel');
  await page.getByRole('button', { name: /Survey\/field data/i }).click();

  await page.getByRole('button', { name: /Start discovery/i }).click();

  await page.waitForURL(/\/chat\//, { timeout: 15_000 });

  // The chat page is client-rendered behind a progress indicator; just verify either
  // the progress text or the input field appears.
  await expect(
    page.getByText(/Learning about your NGO|Ask anything about Dalgo/i)
  ).toBeVisible({ timeout: 15_000 });
});

test('privacy page renders', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/Privacy notice/i)).toBeVisible();
});
