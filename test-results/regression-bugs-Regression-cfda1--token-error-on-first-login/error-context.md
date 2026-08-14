# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression-bugs.spec.js >> Regression bugs — default install >> signed in as demo admin >> #32186 a new Salesman employee gets an invalid-token error on first login
- Location: tests/regression-bugs.spec.js:85:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/invalid security token/i)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/invalid security token/i)

```

```yaml
- banner:
  - navigation:
    - link:
      - /url: http://localhost:8080/admin-dev/sell/orders/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - text: 9.1.4
    - button "Quick Access arrow_drop_down"
    - search:
      - text: 
      - textbox "Searchbar":
        - /placeholder: "Search (e.g.: product reference, customer name…)"
      - button "Everywhere arrow_drop_down"
      - button "search"
    - link "visibility":
      - /url: http://localhost:8080/
    - button "notifications_none"
    - text: account_circle
- navigation:
  - text: first_page
  - list:
    - listitem: Sell
    - listitem:
      - link "shopping_basket Orders keyboard_arrow_up":
        - /url: http://localhost:8080/admin-dev/sell/orders/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - list:
        - listitem:
          - link "Orders":
            - /url: http://localhost:8080/admin-dev/sell/orders/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
        - listitem:
          - link "Invoices":
            - /url: http://localhost:8080/admin-dev/sell/orders/invoices/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
        - listitem:
          - link "Credit Slips":
            - /url: http://localhost:8080/admin-dev/sell/orders/credit-slips/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
        - listitem:
          - link "Shopping Carts":
            - /url: http://localhost:8080/admin-dev/sell/orders/carts/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - listitem:
      - link "store Catalog keyboard_arrow_down":
        - /url: http://localhost:8080/admin-dev/sell/catalog/products/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - listitem:
      - link "account_circle Customers keyboard_arrow_down":
        - /url: http://localhost:8080/admin-dev/sell/addresses/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - listitem:
      - link "chat Customer Service keyboard_arrow_down":
        - /url: http://localhost:8080/admin-dev/sell/customer-service/order-messages/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - listitem: Configure
    - listitem:
      - link "settings Shop Parameters keyboard_arrow_down":
        - /url: http://localhost:8080/admin-dev/?controller=AdminSearchConf&token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - listitem:
      - link "settings_applications Advanced Parameters keyboard_arrow_down":
        - /url: http://localhost:8080/admin-dev/configure/advanced/webservice-keys/?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
- navigation "Breadcrumb":
  - list:
    - listitem: shopping_basket Orders
- heading "Orders" [level=1]
- link "add_circle_outline Add new order":
  - /url: /admin-dev/sell/orders/new?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
- link "Help":
  - /url: "#"
- text: assessment Conversion Rate 30 days
- link "remove_shopping_cart Abandoned Carts From 08/12/2026 to 08/13/2026 per unique visitors":
  - /url: /admin-dev/sell/orders/carts/?cart%5Bfilters%5D%5Bstatus%5D=abandoned_cart&_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
- text: account_balance_wallet Average Order Value 30 days tax excl. account_box Net Profit per Visit 30 days
- button "refresh"
- heading "Orders (5)" [level=3]
- button "Settings settings"
- button "Bulk actions expand_more" [disabled]
- table:
  - rowgroup:
    - row "ID Sort by Reference Sort by New client Delivery Sort by Customer Sort by Total Sort by Payment Sort by Status Sort by Date Sort by Actions":
      - columnheader
      - columnheader "ID Sort by":
        - columnheader "ID"
        - button "Sort by": keyboard_arrow_up
      - columnheader "Reference Sort by":
        - columnheader "Reference"
        - button "Sort by": code
      - columnheader "New client"
      - columnheader "Delivery Sort by":
        - columnheader "Delivery"
        - button "Sort by": code
      - columnheader "Customer Sort by":
        - columnheader "Customer"
        - button "Sort by": code
      - columnheader "Total Sort by":
        - columnheader "Total"
        - button "Sort by": code
      - columnheader "Payment Sort by":
        - columnheader "Payment"
        - button "Sort by": code
      - columnheader "Status Sort by":
        - columnheader "Status"
        - button "Sort by": code
      - columnheader "Date Sort by":
        - columnheader "Date"
        - button "Sort by": code
      - columnheader "Actions"
    - row "All date_range date_range search Search":
      - cell:
        - checkbox
      - cell:
        - textbox "order_id_order input":
          - /placeholder: Search ID
      - cell:
        - textbox "order_reference input":
          - /placeholder: Search reference
      - cell "All":
        - combobox "order_new input":
          - option "All" [selected]
          - option "Yes"
          - option "No"
      - cell:
        - combobox "order_country_name input":
          - option [selected]
          - option "United States"
      - cell:
        - textbox "order_customer input":
          - /placeholder: Search customer
      - cell:
        - textbox "order_total_paid_tax_incl input":
          - /placeholder: Search total
      - cell:
        - textbox "order_payment input":
          - /placeholder: Search payment
      - cell:
        - combobox "order_osname input":
          - option [selected]
          - option "Authorization voided"
          - option "Authorized. To be captured by merchant"
          - option "Awaiting Cash On Delivery validation"
          - option "Awaiting bank wire payment"
          - option "Awaiting check payment"
          - option "Canceled"
          - option "Delivered"
          - option "On backorder (not paid)"
          - option "On backorder (paid)"
          - option "Partial payment"
          - option "Partial refund"
          - option "Payment accepted"
          - option "Payment error"
          - option "Processing in progress"
          - option "Refunded"
          - option "Remote payment accepted"
          - option "Shipped"
          - option "Waiting for payment"
      - cell "date_range date_range":
        - textbox "order_date_add_from input":
          - /placeholder: YYYY-MM-DD
        - text: date_range
        - textbox "order_date_add_to input":
          - /placeholder: YYYY-MM-DD
        - text: date_range
      - cell "search Search":
        - button "search Search" [disabled]
  - rowgroup:
    - row "5 KHWLILZLL No United States J. DOE €27.30 Bank wire Awaiting bank wire payment 08/14/2026 21:07:07 zoom_in":
      - cell:
        - checkbox
      - cell "5"
      - cell "KHWLILZLL"
      - cell "No"
      - cell "United States"
      - cell "J. DOE":
        - link "J. DOE":
          - /url: /admin-dev/sell/customers/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - cell "€27.30"
      - cell "Bank wire"
      - cell "Awaiting bank wire payment":
        - button "Awaiting bank wire payment"
      - cell "08/14/2026 21:07:07":
        - time: 08/14/2026 21:07:07
      - cell "zoom_in":
        - link "zoom_in":
          - /url: /admin-dev/sell/orders/5/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - row "4 FFATNOMMJ No United States J. DOE €21.30 Payment by check Awaiting check payment 08/14/2026 21:07:07 zoom_in":
      - cell:
        - checkbox
      - cell "4"
      - cell "FFATNOMMJ"
      - cell "No"
      - cell "United States"
      - cell "J. DOE":
        - link "J. DOE":
          - /url: /admin-dev/sell/customers/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - cell "€21.30"
      - cell "Payment by check"
      - cell "Awaiting check payment":
        - button "Awaiting check payment"
      - cell "08/14/2026 21:07:07":
        - time: 08/14/2026 21:07:07
      - cell "zoom_in":
        - link "zoom_in":
          - /url: /admin-dev/sell/orders/4/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - row "3 UOYEVOLI No United States J. DOE €21.30 Payment by check Payment error 08/14/2026 21:07:07 zoom_in":
      - cell:
        - checkbox
      - cell "3"
      - cell "UOYEVOLI"
      - cell "No"
      - cell "United States"
      - cell "J. DOE":
        - link "J. DOE":
          - /url: /admin-dev/sell/customers/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - cell "€21.30"
      - cell "Payment by check"
      - cell "Payment error":
        - button "Payment error"
      - cell "08/14/2026 21:07:07":
        - time: 08/14/2026 21:07:07
      - cell "zoom_in":
        - link "zoom_in":
          - /url: /admin-dev/sell/orders/3/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - row "2 OHSATSERP No United States J. DOE €169.90 Payment by check Awaiting check payment 08/14/2026 21:07:07 zoom_in":
      - cell:
        - checkbox
      - cell "2"
      - cell "OHSATSERP"
      - cell "No"
      - cell "United States"
      - cell "J. DOE":
        - link "J. DOE":
          - /url: /admin-dev/sell/customers/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - cell "€169.90"
      - cell "Payment by check"
      - cell "Awaiting check payment":
        - button "Awaiting check payment"
      - cell "08/14/2026 21:07:07":
        - time: 08/14/2026 21:07:07
      - cell "zoom_in":
        - link "zoom_in":
          - /url: /admin-dev/sell/orders/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
    - row "1 XKBKNABJK Yes United States J. DOE €68.20 Payment by check Canceled 08/14/2026 21:07:07 zoom_in":
      - cell:
        - checkbox
      - cell "1"
      - cell "XKBKNABJK"
      - cell "Yes"
      - cell "United States"
      - cell "J. DOE":
        - link "J. DOE":
          - /url: /admin-dev/sell/customers/2/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
      - cell "€68.20"
      - cell "Payment by check"
      - cell "Canceled":
        - button "Canceled"
      - cell "08/14/2026 21:07:07":
        - time: 08/14/2026 21:07:07
      - cell "zoom_in":
        - link "zoom_in":
          - /url: /admin-dev/sell/orders/1/view?_token=3ddad3672.CITdrj9EAwlgPr7QofI65Yx_M3uNagSrBcs0rPZ_4lU.O7CqwA0RZWA2dPjj6ZN4rrgyVA_kB2LMRL5nnZAspTlwxu7-SzV3QiN59w
- navigation:
  - img "Loading..."
```

# Test source

```ts
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
  51  |     const res = await page.goto('/index.php?id_product=0&controller=product');
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
> 117 |       await expect(guestPage.getByText(/invalid security token/i)).toBeVisible({ timeout: 10000 });
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
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
  152 | // #39389 (Trivial, 8.2.1) — BO order creation: the "Order message" field only persists once
  153 | // "Create order" is clicked; refreshing beforehand loses it (used to autosave via AJAX pre-9.x).
  154 | 
```