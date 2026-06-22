import { test, expect } from '@playwright/test'

test('guest landing renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /right doctor/i })).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Welcome to CuraLine')).toBeVisible()
})
