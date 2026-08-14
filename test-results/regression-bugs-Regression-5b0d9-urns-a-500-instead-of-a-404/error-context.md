# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression-bugs.spec.js >> Regression bugs — default install >> #33306 FO product URL with id=0 returns a 500 instead of a 404
- Location: tests/regression-bugs.spec.js:50:3

# Error details

```
Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:8080/index.php?id_product=0&controller=product
Call log:
  - navigating to "http://localhost:8080/index.php?id_product=0&controller=product", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This localhost page can’t be found" [level=1] [ref=e7]
    - paragraph [ref=e9]:
      - text: "No webpage was found for the web address:"
      - strong [ref=e10]: http://localhost:8080/index.php?id_product=0&controller=product
    - generic [ref=e11]: HTTP ERROR 404
  - button "Reload" [ref=e14] [cursor=pointer]
```

# Test source

```ts
  1   | // Regression-labeled bugs from https://github.com/PrestaShop/PrestaShop/issues (label:Regression, open,
  2   | // snapshot 2026-08-14 — see known-issues.md for the full 30-issue list and the age analysis).
  3   | //
  4   | // Semantics: each test asserts the CURRENT (reported-buggy) behavior, so PASS = "still reproduces as
  5   | // described on this install", FAIL = "does not reproduce this way" (fixed, or environment differs).
  6   | // Run against a fresh `docker compose up -d` install (prestashop/prestashop:latest, PS 9.1.4 at time of
  7   | // writing, PS_FOLDER_ADMIN=admin-dev, demo@prestashop.com / prestashop_demo).
  8   | //
  9   | // Scope: only issues reproducible on this default single-shop install were scripted. Left out (need
  10  | // Multistore, Webservice API, extra language packs, SMTP-level inspection, DB/profiler access, or a
  11  | // custom module install) are listed at the bottom of this file with their exact repro steps, so a
  12  | // follow-up pass can pick them up without re-reading the GitHub issues.
  13  | //
  14  | // Results as of 2026-08-14 against PS 9.1.4 (prestashop/prestashop:latest):
  15  | //   #33306 — does NOT reproduce (returns 404, not 500). Likely fixed since the 2023 report.
  16  | //   #38072 — REPRODUCES. A cart rule with a no-op 0% discount still saves with no validation error.
  17  | //   #32186 — does NOT reproduce. A fresh Salesman employee logs in cleanly, no invalid-token error.
  18  | // Two of three "Regression"-labeled issues we could cheaply script no longer reproduce — consistent
  19  | // with the known-issues.md finding that this label likely isn't cleared when a fix lands. Along the
  20  | // way, submitting the new-employee form via a scripted profile change (without letting the
  21  | // "Default page" field repopulate from its profile-scoped AJAX call first) 500s with an uncaught
  22  | // TypeError instead of a validation message — a real bug, just not one of the 30 in scope here, and
  23  | // not filed anywhere. See AbstractEmployeeHandler::assertHomepageIsAccessible() in var/logs.
  24  | 
  25  | const { test, expect } = require('@playwright/test');
  26  | 
  27  | const ADMIN_EMAIL = 'demo@prestashop.com';
  28  | const ADMIN_PASSWORD = 'prestashop_demo';
  29  | 
  30  | async function loginAsAdmin(page) {
  31  |   await page.goto('/admin-dev/');
  32  |   await page.locator('#email').fill(ADMIN_EMAIL);
  33  |   await page.locator('#passwd').fill(ADMIN_PASSWORD);
  34  |   await page.locator('button[type=submit]').first().click();
  35  |   await page.waitForLoadState('domcontentloaded');
  36  | }
  37  | 
  38  | // PrestaShop's admin sidebar renders every entry's real, tokenized href straight into the DOM
  39  | // (no client-side menu fetch), but flyout submenus stay hidden until hover. Reading the href and
  40  | // navigating directly is more reliable here than driving the hover/click interaction.
  41  | async function hrefOf(page, linkText) {
  42  |   const href = await page.locator('a').filter({ hasText: linkText }).first().getAttribute('href');
  43  |   return new URL(href, page.url()).href;
  44  | }
  45  | 
  46  | test.describe('Regression bugs — default install', () => {
  47  | 
  48  |   // https://github.com/PrestaShop/PrestaShop/issues/33306
  49  |   // "FO - Error 500 URL with product id = 0" — expected a 404, PS 1.7.8.0+ throws a fatal error instead.
  50  |   test('#33306 FO product URL with id=0 returns a 500 instead of a 404', async ({ page }) => {
> 51  |     const res = await page.goto('/index.php?id_product=0&controller=product');
      |                            ^ Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:8080/index.php?id_product=0&controller=product
  52  |     expect(res.status()).toBe(500);
  53  |   });
  54  | 
  55  |   test.describe('signed in as demo admin', () => {
  56  |     test.beforeEach(async ({ page }) => {
  57  |       await loginAsAdmin(page);
  58  |     });
  59  | 
  60  |     // https://github.com/PrestaShop/PrestaShop/issues/38072
  61  |     // "Cart rules register without discounts apply" — a cart rule with "Apply a discount: Percent"
  62  |     // left at its default 0% value (i.e. a discount that does nothing) still saves without any
  63  |     // validation error.
  64  |     test('#38072 cart rule with an unconfigured 0% discount saves without a validation error', async ({ page }) => {
  65  |       await page.goto(await hrefOf(page, 'Discounts'));
  66  |       await page.goto(await hrefOf(page, 'Add new cart rule'));
  67  | 
  68  |       await page.locator('#name_1').fill(`Regression 38072 ${Date.now()}`);
  69  |       await page.getByRole('link', { name: /actions/i }).click();
  70  | 
  71  |       await page.locator('#apply_discount_percent').check();
  72  |       await page.locator('#apply_discount_to_cheapest').check();
  73  |       // reduction_percent is left at its default value "0" — a no-op discount.
  74  |       await expect(page.locator('#reduction_percent')).toHaveValue('0');
  75  | 
  76  |       // The Save control here is a styled <a>, not a <button>.
  77  |       await page.getByRole('link', { name: /^save$/i }).click();
  78  | 
  79  |       await expect(page.getByText(/successful creation|successfully created/i)).toBeVisible({ timeout: 10000 });
  80  |     });
  81  | 
  82  |     // https://github.com/PrestaShop/PrestaShop/issues/32186
  83  |     // "BO - Login - Invalid token when you connect with other person than the Super User" — a
  84  |     // freshly created Salesman-profile employee gets an "invalid security token" error on first login.
  85  |     test('#32186 a new Salesman employee gets an invalid-token error on first login', async ({ page, browser }) => {
  86  |       await page.goto(await hrefOf(page, 'Team'));
  87  |       const addHref = await page.locator('a').filter({ hasText: /add new employee/i }).first().getAttribute('href');
  88  |       await page.goto(new URL(addHref, page.url()).href);
  89  | 
  90  |       const email = `regression-32186-${Date.now()}@example.com`;
  91  |       const password = 'Regression#38072Test';
  92  |       await page.locator('#employee_firstname').fill('Regression');
  93  |       await page.locator('#employee_lastname').fill('Tester');
  94  |       await page.locator('#employee_email').fill(email);
  95  |       await page.locator('#employee_password').fill(password);
  96  |       // Selecting a profile refetches the "Default page" options via AJAX (restricted to what that
  97  |       // profile may access) — wait for that before picking one, or the field submits empty and the
  98  |       // whole form 500s with a TypeError instead of a validation message (a real, separate bug we hit
  99  |       // while building this test — see the note at the bottom of this file).
  100 |       const tabsResponse = page.waitForResponse((res) => res.url().includes('/employees/tabs') && res.request().method() === 'GET');
  101 |       await page.locator('#employee_profile').selectOption('4'); // Salesman
  102 |       await tabsResponse;
  103 |       await page.locator('#employee_default_page').selectOption({ index: 0 });
  104 | 
  105 |       await page.getByRole('button', { name: /save/i }).click();
  106 |       await expect(page).not.toHaveURL(/\/new(\?|$)/, { timeout: 10000 });
  107 | 
  108 |       // Fresh context (not just cleared cookies) for the second login, so nothing from the
  109 |       // SuperAdmin session leaks through.
  110 |       const guestContext = await browser.newContext();
  111 |       const guestPage = await guestContext.newPage();
  112 |       await guestPage.goto('/admin-dev/');
  113 |       await guestPage.locator('#email').fill(email);
  114 |       await guestPage.locator('#passwd').fill(password);
  115 |       await guestPage.locator('button[type=submit]').first().click();
  116 | 
  117 |       await expect(guestPage.getByText(/invalid security token/i)).toBeVisible({ timeout: 10000 });
  118 |       await guestContext.close();
  119 |     });
  120 |   });
  121 | });
  122 | 
  123 | // ---------------------------------------------------------------------------------------------
  124 | // Documented but NOT scripted this pass — precise repro steps from the GitHub issue, for a
  125 | // follow-up session. None of these need anything exotic (no Multistore/Webservice/extra
  126 | // languages), they just need more setup (a second currency, a Pack product, a combination
  127 | // product, etc.) than was worth building blind without verifying selectors live first.
  128 | // ---------------------------------------------------------------------------------------------
  129 | //
  130 | // #29346 (Major, 8.0.x) — stale currency symbol on a supplier's cost price after the currency
  131 | // is deleted. Repro: create a 2nd currency (e.g. DZD) -> create a product with a supplier using
  132 | // that currency -> delete/disable the currency -> reopen the product's Options tab -> the deleted
  133 | // currency symbol is still shown.
  134 | //
  135 | // #37739 (Trivial, 9.0.0) — combination product: changing a supplier's currency on a combination
  136 | // doesn't enable the Save button; editing any other field first does.
  137 | // Repro: Catalog > Products > edit a product with combinations > Combinations tab > edit a
  138 | // combination > Supplier reference(s) > change currency > Save is disabled.
  139 | //
  140 | // #31789 (Minor, 8.0.1, module psgdpr — installed & active by default on this image) — FO consent
  141 | // checkboxes (account creation, newsletter, product comments, contact form) don't appear even
  142 | // after enabling them in the psgdpr BO config, except for the "Customer account" one which works.
  143 | //
  144 | // #37993 (Trivial, 9.0.0) — BO Import: deleting a saved data-matching configuration and then
  145 | // loading it again leaves the column-matching table incomplete and the subsequent import
  146 | // permanently errors (persists across refresh/re-visit).
  147 | //
  148 | // #38078 (Major, 8.2.x) — cart rule stacking: a "free gift on cheapest product" rule combined
  149 | // with a "50% off cheapest product" rule applies the discount to the gift instead of the
  150 | // customer's actual cheapest product. Needs two cart rules + an FO checkout with both codes.
  151 | //
```