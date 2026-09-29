// Three properties from the antithesis-research property-discovery pass that need real HTTP
// access (raw Set-Cookie headers and their attributes) rather than page-context JavaScript — see
// antithesis/scratchbook/property-catalog.md, "Session & Auth Boundaries" category, and
// antithesis/scratchbook/evaluation/synthesis.md's Refinement #1 for why these can't be Bombadil
// properties: Bombadil's `extract()` only sees `document`/`window`, and Set-Cookie is never
// exposed to page JS by any browser, by design, regardless of HttpOnly. Playwright reads responses
// through its CDP session instead, so it doesn't hit that wall — `response.headersArray()`
// explicitly preserves repeated headers like Set-Cookie (unlike `response.headers()`, which both
// drops cookie-related headers and would collapse duplicates into one string anyway).
//
// Unlike regression-bugs.spec.js, these assert the CORRECT behavior (normal test semantics: a
// failure means a real defect), not the currently-reported-buggy behavior. Two of the three are
// expected to fail on this install as of 2026-09-29 (PS 9.1.4, prestashop/prestashop:latest) —
// see the per-test comments and the linked evidence files for the confirmed root causes.

const { test, expect } = require('@playwright/test');

const SESSION_COOKIE_NAMES = ['PHPSESSID', /^PrestaShop-/];
// Real sessions should last hours or days, not years. Anything past this ceiling is either the
// confirmed expiry-math bug (see session-cookie-lifetime-bounded.md) or a config choice that
// still deserves a human's attention — either way it should fail loudly, not silently pass.
const MAX_SANE_LIFETIME_SECONDS = 60 * 60 * 24 * 400; // ~400 days

function isSessionCookie(name) {
  return SESSION_COOKIE_NAMES.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(name) : pattern === name,
  );
}

// Parses one Set-Cookie header value into { name, value, attributes, raw }. `attributes` keys are
// lower-cased attribute names (e.g. "max-age", "secure"); a flag attribute like `Secure` (no `=`)
// is present as a key with an empty-string value, so `'secure' in attributes` is the right check.
function parseSetCookieHeader(raw) {
  const [pair, ...attrParts] = raw.split(';').map((s) => s.trim());
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq);
  const value = pair.slice(eq + 1);
  const attributes = {};
  for (const part of attrParts) {
    const [attrName, ...rest] = part.split('=');
    attributes[attrName.trim().toLowerCase()] = rest.join('=').trim();
  }
  return { name, value, attributes, raw };
}

async function getSetCookieHeaders(response) {
  return (await response.headersArray()).filter((h) => h.name.toLowerCase() === 'set-cookie');
}

test.describe('Session cookie properties (antithesis-research property catalog)', () => {
  // antithesis/scratchbook/properties/session-cookie-lifetime-bounded.md
  // Expected to FAIL on this install: config/config.inc.php builds the session cookie's expiry as
  // an absolute future Unix timestamp (correct for Cookie::__construct()'s $expire param), then
  // reuses that same value unconverted as SessionHandler's $lifetime constructor arg, which PHP's
  // session_set_cookie_params() treats as a *relative* seconds-from-now duration — landing the
  // real expiry around double "now", i.e. decades out (observed: 18 July 2083).
  test('session-cookie-lifetime-bounded: no session cookie has an implausibly long lifetime', async ({ page }) => {
    const response = await page.goto('/');
    const cookies = (await getSetCookieHeaders(response))
      .map((h) => parseSetCookieHeader(h.value))
      .filter((c) => isSessionCookie(c.name));

    expect(cookies.length, 'expected at least one session cookie to be set on the homepage response').toBeGreaterThan(0);

    for (const cookie of cookies) {
      const maxAge = cookie.attributes['max-age'] !== undefined ? parseInt(cookie.attributes['max-age'], 10) : null;
      const expires = cookie.attributes['expires'] ? new Date(cookie.attributes['expires']) : null;
      const lifetimeSeconds = maxAge ?? (expires ? (expires.getTime() - Date.now()) / 1000 : null);

      expect(lifetimeSeconds, `${cookie.name} has neither a Max-Age nor an Expires attribute`).not.toBeNull();
      expect(
        lifetimeSeconds,
        `${cookie.name}'s lifetime is ~${Math.round(lifetimeSeconds / 86400)} days ` +
          `(raw: "${cookie.raw}"), expected under ${MAX_SANE_LIFETIME_SECONDS / 86400} days. ` +
          `See antithesis/scratchbook/properties/session-cookie-lifetime-bounded.md.`,
      ).toBeLessThan(MAX_SANE_LIFETIME_SECONDS);
    }
  });

  // antithesis/scratchbook/properties/duplicate-session-cookie-single-write.md
  // Expected to FAIL on this install: the homepage response sets the PrestaShop-<hash> cookie
  // twice with two different encrypted values in a single response (confirmed via curl — see the
  // evidence file's Investigation Log). Relies on unspecified "last Set-Cookie wins" client
  // behavior instead of writing the cookie once.
  test('duplicate-session-cookie-single-write: no response sets the same cookie twice with different values', async ({ page }) => {
    const response = await page.goto('/');
    const setCookies = await getSetCookieHeaders(response);

    const distinctValuesByName = new Map();
    for (const { value } of setCookies) {
      const { name, raw } = parseSetCookieHeader(value);
      if (!distinctValuesByName.has(name)) distinctValuesByName.set(name, new Set());
      distinctValuesByName.get(name).add(raw);
    }

    expect(distinctValuesByName.size, 'expected at least one Set-Cookie header on the homepage response').toBeGreaterThan(0);

    for (const [name, distinctValues] of distinctValuesByName) {
      expect(
        distinctValues.size,
        `${name} was set ${distinctValues.size} times with different values in one response:\n` +
          [...distinctValues].join('\n'),
      ).toBe(1);
    }
  });

  // antithesis/scratchbook/properties/session-cookie-secure-flag-matches-transport.md
  // Expected to PASS on this install: confirms the (correct, if not ideal — this deployment simply
  // never serves HTTPS on the storefront/admin port, see bugs.md #6) absence of a Secure flag over
  // plain HTTP, as a regression guard against e.g. a future reverse-proxy header-trust bug.
  test('session-cookie-secure-flag-matches-transport: no cookie claims Secure over plain HTTP', async ({ page }) => {
    const response = await page.goto('/');
    expect(new URL(response.url()).protocol, 'this property only makes sense over plain HTTP').toBe('http:');

    const setCookies = await getSetCookieHeaders(response);
    expect(setCookies.length, 'expected at least one Set-Cookie header on the homepage response').toBeGreaterThan(0);

    for (const { value } of setCookies) {
      const { name, attributes } = parseSetCookieHeader(value);
      expect('secure' in attributes, `${name} was issued with the Secure attribute over plain HTTP`).toBe(false);
    }
  });
});
