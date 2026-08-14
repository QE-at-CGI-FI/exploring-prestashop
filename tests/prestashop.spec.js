const { test, expect } = require('@playwright/test');

let context;
let page;

test.beforeEach(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await context.close();
});

test('storefront home page loads', async () => {
  const response = await page.goto('/');
  expect(response.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/.+/);
});

test('admin login page loads', async () => {
  const response = await page.goto('/admin-dev/');
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('#email')).toBeVisible();
});
