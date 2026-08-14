// Regression-labeled bugs from https://github.com/PrestaShop/PrestaShop/issues (label:Regression, open,
// snapshot 2026-08-14 — see known-issues.md for the full 30-issue list and the age analysis).
//
// Semantics: each test asserts the CURRENT (reported-buggy) behavior, so PASS = "still reproduces as
// described on this install", FAIL = "does not reproduce this way" (fixed, or environment differs).
// Run against a fresh `docker compose up -d` install (prestashop/prestashop:latest, PS 9.1.4 at time of
// writing, PS_FOLDER_ADMIN=admin-dev, demo@prestashop.com / prestashop_demo).
//
// Scope: only issues reproducible on this default single-shop install were scripted. Left out (need
// Multistore, Webservice API, extra language packs, SMTP-level inspection, DB/profiler access, or a
// custom module install) are listed at the bottom of this file with their exact repro steps, so a
// follow-up pass can pick them up without re-reading the GitHub issues.
//
// Results as of 2026-08-14 against PS 9.1.4 (prestashop/prestashop:latest):
//   #33306 — does NOT reproduce (returns 404, not 500). Likely fixed since the 2023 report.
//   #38072 — REPRODUCES. A cart rule with a no-op 0% discount still saves with no validation error.
//   #32186 — does NOT reproduce. A fresh Salesman employee logs in cleanly, no invalid-token error.
// Two of three "Regression"-labeled issues we could cheaply script no longer reproduce — consistent
// with the known-issues.md finding that this label likely isn't cleared when a fix lands. Along the
// way, submitting the new-employee form via a scripted profile change (without letting the
// "Default page" field repopulate from its profile-scoped AJAX call first) 500s with an uncaught
// TypeError instead of a validation message — a real bug, just not one of the 30 in scope here, and
// not filed anywhere. See AbstractEmployeeHandler::assertHomepageIsAccessible() in var/logs.

const { test, expect } = require('@playwright/test');

const ADMIN_EMAIL = 'demo@prestashop.com';
const ADMIN_PASSWORD = 'prestashop_demo';

async function loginAsAdmin(page) {
  await page.goto('/admin-dev/');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#passwd').fill(ADMIN_PASSWORD);
  await page.locator('button[type=submit]').first().click();
  await page.waitForLoadState('domcontentloaded');
}

// PrestaShop's admin sidebar renders every entry's real, tokenized href straight into the DOM
// (no client-side menu fetch), but flyout submenus stay hidden until hover. Reading the href and
// navigating directly is more reliable here than driving the hover/click interaction.
async function hrefOf(page, linkText) {
  const href = await page.locator('a').filter({ hasText: linkText }).first().getAttribute('href');
  return new URL(href, page.url()).href;
}

test.describe('Regression bugs — default install', () => {

  // https://github.com/PrestaShop/PrestaShop/issues/33306
  // "FO - Error 500 URL with product id = 0" — expected a 404, PS 1.7.8.0+ throws a fatal error instead.
  test('#33306 FO product URL with id=0 returns a 500 instead of a 404', async ({ page }) => {
    const res = await page.goto('/index.php?id_product=0&controller=product');
    expect(res.status()).toBe(500);
  });

  test.describe('signed in as demo admin', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    // https://github.com/PrestaShop/PrestaShop/issues/38072
    // "Cart rules register without discounts apply" — a cart rule with "Apply a discount: Percent"
    // left at its default 0% value (i.e. a discount that does nothing) still saves without any
    // validation error.
    test('#38072 cart rule with an unconfigured 0% discount saves without a validation error', async ({ page }) => {
      await page.goto(await hrefOf(page, 'Discounts'));
      await page.goto(await hrefOf(page, 'Add new cart rule'));

      await page.locator('#name_1').fill(`Regression 38072 ${Date.now()}`);
      await page.getByRole('link', { name: /actions/i }).click();

      await page.locator('#apply_discount_percent').check();
      await page.locator('#apply_discount_to_cheapest').check();
      // reduction_percent is left at its default value "0" — a no-op discount.
      await expect(page.locator('#reduction_percent')).toHaveValue('0');

      // The Save control here is a styled <a>, not a <button>.
      await page.getByRole('link', { name: /^save$/i }).click();

      await expect(page.getByText(/successful creation|successfully created/i)).toBeVisible({ timeout: 10000 });
    });

    // https://github.com/PrestaShop/PrestaShop/issues/32186
    // "BO - Login - Invalid token when you connect with other person than the Super User" — a
    // freshly created Salesman-profile employee gets an "invalid security token" error on first login.
    test('#32186 a new Salesman employee gets an invalid-token error on first login', async ({ page, browser }) => {
      await page.goto(await hrefOf(page, 'Team'));
      const addHref = await page.locator('a').filter({ hasText: /add new employee/i }).first().getAttribute('href');
      await page.goto(new URL(addHref, page.url()).href);

      const email = `regression-32186-${Date.now()}@example.com`;
      const password = 'Regression#38072Test';
      await page.locator('#employee_firstname').fill('Regression');
      await page.locator('#employee_lastname').fill('Tester');
      await page.locator('#employee_email').fill(email);
      await page.locator('#employee_password').fill(password);
      // Selecting a profile refetches the "Default page" options via AJAX (restricted to what that
      // profile may access) — wait for that before picking one, or the field submits empty and the
      // whole form 500s with a TypeError instead of a validation message (a real, separate bug we hit
      // while building this test — see the note at the bottom of this file).
      const tabsResponse = page.waitForResponse((res) => res.url().includes('/employees/tabs') && res.request().method() === 'GET');
      await page.locator('#employee_profile').selectOption('4'); // Salesman
      await tabsResponse;
      await page.locator('#employee_default_page').selectOption({ index: 0 });

      await page.getByRole('button', { name: /save/i }).click();
      await expect(page).not.toHaveURL(/\/new(\?|$)/, { timeout: 10000 });

      // Fresh context (not just cleared cookies) for the second login, so nothing from the
      // SuperAdmin session leaks through.
      const guestContext = await browser.newContext();
      const guestPage = await guestContext.newPage();
      await guestPage.goto('/admin-dev/');
      await guestPage.locator('#email').fill(email);
      await guestPage.locator('#passwd').fill(password);
      await guestPage.locator('button[type=submit]').first().click();

      await expect(guestPage.getByText(/invalid security token/i)).toBeVisible({ timeout: 10000 });
      await guestContext.close();
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Documented but NOT scripted this pass — precise repro steps from the GitHub issue, for a
// follow-up session. None of these need anything exotic (no Multistore/Webservice/extra
// languages), they just need more setup (a second currency, a Pack product, a combination
// product, etc.) than was worth building blind without verifying selectors live first.
// ---------------------------------------------------------------------------------------------
//
// #29346 (Major, 8.0.x) — stale currency symbol on a supplier's cost price after the currency
// is deleted. Repro: create a 2nd currency (e.g. DZD) -> create a product with a supplier using
// that currency -> delete/disable the currency -> reopen the product's Options tab -> the deleted
// currency symbol is still shown.
//
// #37739 (Trivial, 9.0.0) — combination product: changing a supplier's currency on a combination
// doesn't enable the Save button; editing any other field first does.
// Repro: Catalog > Products > edit a product with combinations > Combinations tab > edit a
// combination > Supplier reference(s) > change currency > Save is disabled.
//
// #31789 (Minor, 8.0.1, module psgdpr — installed & active by default on this image) — FO consent
// checkboxes (account creation, newsletter, product comments, contact form) don't appear even
// after enabling them in the psgdpr BO config, except for the "Customer account" one which works.
//
// #37993 (Trivial, 9.0.0) — BO Import: deleting a saved data-matching configuration and then
// loading it again leaves the column-matching table incomplete and the subsequent import
// permanently errors (persists across refresh/re-visit).
//
// #38078 (Major, 8.2.x) — cart rule stacking: a "free gift on cheapest product" rule combined
// with a "50% off cheapest product" rule applies the discount to the gift instead of the
// customer's actual cheapest product. Needs two cart rules + an FO checkout with both codes.
//
// #39389 (Trivial, 8.2.1) — BO order creation: the "Order message" field only persists once
// "Create order" is clicked; refreshing beforehand loses it (used to autosave via AJAX pre-9.x).
