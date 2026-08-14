const { chromium } = require('playwright');

const BASE = 'http://localhost:8080';
const SHOT_DIR = __dirname;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const consoleMsgs = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleMsgs.push(`[${msg.type()}] ${page.url()} :: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`${page.url()} :: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.failure()?.errorText} :: ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`HTTP ${res.status()} :: ${res.url()}`);
    }
  });

  let step = 0;
  const shot = async (label) => {
    step += 1;
    const file = `${String(step).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: `${SHOT_DIR}/${file}`, fullPage: true });
    console.log(`SHOT ${file} -> ${page.url()}`);
  };

  // 1. Home page
  await page.goto(BASE, { waitUntil: 'load' });
  await shot('home');

  // 2. Try the search box
  const search = page.locator('input[name="s"], #search_widget input');
  if (await search.count()) {
    await search.first().fill('shirt');
    await search.first().press('Enter');
    await page.waitForLoadState('load').catch(() => {});
    await shot('search-results');
  } else {
    console.log('NOTE: no search box found on home page');
  }

  // 3. Go back home, open a category from nav
  await page.goto(BASE, { waitUntil: 'load' });
  const navLink = page.locator('#header nav a, .nav a, header a').filter({ hasText: /./ }).first();
  const categoryLinks = await page.locator('a[href*="category"], nav a').all();
  let visitedCategory = false;
  for (const link of categoryLinks) {
    const href = await link.getAttribute('href').catch(() => null);
    const text = (await link.textContent().catch(() => '') || '').trim();
    if (href && text) {
      await link.click({ trial: false }).catch(() => {});
      await page.waitForLoadState('load').catch(() => {});
      visitedCategory = true;
      await shot('category');
      break;
    }
  }
  if (!visitedCategory) console.log('NOTE: could not click into a category from nav');

  // 4. Open the first product on the page
  const productLink = page.locator('a.product-thumbnail, .product-miniature a, article a').first();
  if (await productLink.count()) {
    await productLink.click().catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await shot('product-page');

    // 5. Try add to cart
    const addToCart = page.locator('button[data-button-action="add-to-cart"], #add-to-cart button, button:has-text("Add to cart")');
    if (await addToCart.count()) {
      await addToCart.first().click().catch(() => {});
      await page.waitForTimeout(1500);
      await shot('after-add-to-cart');
    } else {
      console.log('NOTE: no add-to-cart button found on product page');
    }
  } else {
    console.log('NOTE: no product link found to open a product page');
  }

  // 6. Cart page
  await page.goto(`${BASE}/index.php?controller=cart`, { waitUntil: 'load' }).catch(() => {});
  await shot('cart-page');

  // 7. Admin login page
  await page.goto(`${BASE}/admin-dev/`, { waitUntil: 'load' });
  await shot('admin-login');

  // 8. Attempt admin login with documented default demo creds
  const emailField = page.locator('#email');
  const passField = page.locator('#passwd');
  if (await emailField.count() && await passField.count()) {
    await emailField.fill('demo@prestashop.com');
    await passField.fill('prestashop_demo');
    await page.locator('#submit_login, button[type="submit"]').first().click().catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await shot('admin-after-login');
  } else {
    console.log('NOTE: admin login form fields not found as expected');
  }

  await browser.close();

  console.log('\n=== CONSOLE MESSAGES ===');
  console.log(consoleMsgs.length ? consoleMsgs.join('\n') : '(none)');
  console.log('\n=== PAGE ERRORS ===');
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
  console.log('\n=== FAILED / ERROR HTTP RESPONSES ===');
  console.log(failedRequests.length ? failedRequests.join('\n') : '(none)');
})();
