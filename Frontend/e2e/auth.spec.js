import { test, expect } from '@playwright/test'

// Critical path (no LLM, no seed needed): a new patient registers, is gated by
// the medical-disclaimer consent, accepts it, and the triage chat unlocks.
test('register -> consent gate -> chat unlocks', async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`

  await page.goto('/register')
  await page.getByPlaceholder('John Doe').fill('E2E Tester')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('Min. 8 characters').fill('securepass1')
  await page.locator('button[type="submit"]').click()

  // Auto-login lands on the chat, which is blocked by the consent gate.
  await expect(page.getByText('Before we begin')).toBeVisible()

  await page.getByRole('button', { name: /i understand and agree/i }).click()

  // Disclaimer accepted -> the triage input is now available.
  await expect(page.getByPlaceholder(/describe your symptoms/i)).toBeVisible()
})
