import { test, expect } from '@playwright/test'

// Requires the seeded demo data (python seed.py): demo patient john@example.com
// plus approved doctors with available slots. Direct (browse) booking is NOT
// consent-gated, so this exercises the booking surfaces deterministically.
test('patient can reach the booking surfaces', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#login-email').fill('john@example.com')
  await page.locator('#login-password').fill('Patient@1234')
  await page.locator('button[type="submit"]').click()

  // Doctor directory lists seeded specialists.
  await page.goto('/doctors')
  await expect(
    page.getByText(/Cardiology|Neurology|Orthopedics|General Medicine/).first(),
  ).toBeVisible()

  // My Appointments page loads.
  await page.goto('/appointments')
  await expect(page).toHaveURL(/appointments/)
})
