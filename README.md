# exploring-prestashop

Prestashop is an open source webshop that makes a more complicated test target than the simple frontends. This project sets frame for using it in exploratory testing teaching.

JAMK / Marko Rintamäki uses Prestashop, with intentionally broken versions as a platform to teach the complexities in software testing. CGI / Maaret Pyhäjärvi has been of the opinion that teaching environment setup or debugging might not be the core of learning to test, and that intentionally broken is unnecessary when the available systems are already in need of significant quality feedback; larger systems require more effort in domain, leaving less effort for testing thus driving the lessons through intentionally may be more difficult. From a conversation, taking a look at exploring it as testing target for teaching makes sense, and this project is for notes on the experience.

## Installation

- prerequisites: Docker desktop (licensed) or e.g. Colima

- terminal: colima start

- terminal: docker compose up -d

## Prestashop

Source: https://github.com/prestashop/prestashop

## Testing

- `tests/` — Playwright specs, scripted (see `tests/prestashop.spec.js`, `tests/regression-bugs.spec.js`). Run with `npx playwright test`.
- `bombadil/` — [Bombadil](https://antithesishq.github.io/bombadil/index.html) specification for autonomous, property-based exploration of the storefront. Bombadil drives the browser itself (clicking, typing, navigating) and continuously checks correctness properties rather than following a fixed script — a different failure-finding strategy than the scripted Playwright tests above.

  ```
  npm test                                   # ensures colima + `docker compose up -d` are up, waits for the
                                              # storefront to respond, then runs a bounded (60s) Bombadil pass
                                              # that fails (non-zero exit) on the first violation
  npm run test:bombadil                      # ad-hoc exploration, no time limit — explores until Ctrl+C
  npx bombadil browser test --time-limit=3m --output-path bombadil-output --output-path-overwrite http://localhost:8080 bombadil/specification.ts
  npx bombadil browser inspect bombadil-output   # opens a UI to replay/inspect a run, including any violation
  ```

  `npm test`'s environment bring-up lives in `scripts/ensure-env.sh` (also usable standalone).

- `schemathesis/` — [Schemathesis](https://schemathesis.readthedocs.io/) property-based tests against PrestaShop's Admin API (`ps_apiresources`, OpenAPI/OAuth2, introduced 8.1+ — see `/admin-dev/` → Advanced Parameters → Admin API). Schemathesis generates requests from the OpenAPI schema and checks generic API correctness properties (schema conformance, no server errors, etc.) — same "properties over scripts" idea as Bombadil, applied to the API instead of the browser.

  Setup (one-time, only needed for this — the storefront/admin/Playwright/Bombadil above don't need any of it):

  1. The Admin API refuses plain HTTP outside Symfony debug mode, which the app image doesn't run in, so bring the stack up with the `compose.admin-api.yml` overlay instead of plain `docker compose up -d` — it adds a Caddy TLS proxy at `https://localhost:8443` (see `Caddyfile`) and builds a `prestashop` image that trusts this machine's corporate TLS-inspecting proxy root CA if it has one (see `docker/prestashop.Dockerfile` — export yours to `docker/zscaler-root-ca.pem`, gitignored; skip this file entirely on a network without one). Generate a local cert for Caddy first: `openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost-key.pem -out certs/localhost.pem -days 825 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`. Then:
     ```
     docker compose -f compose.yaml -f compose.admin-api.yml up -d --build
     ```
  2. Point the shop's SSL domain at the proxy (PrestaShop's fresh-install default is the plain HTTP domain, which makes the Admin API redirect every request to the shop root instead of serving it):
     ```
     docker compose exec -T db mysql -uroot -pprestashop -D prestashop \
       -e "UPDATE ps_shop_url SET domain_ssl='localhost:8443' WHERE id_shop_url=1;"
     ```
  3. In `/admin-dev/` → Advanced Parameters → Admin API → Add new API Client: enable it, Enable all scopes, save, and put its id/secret in `schemathesis/.env` (copy `schemathesis/.env.example`).
  4. `python3 -m venv .venv && .venv/bin/pip install schemathesis` (kept out of `package.json` since it's Python tooling).

  Then:
  ```
  npm run test:schemathesis            # no time limit — Ctrl+C to stop, or pass flags: -- --max-time=60
  bash schemathesis/run.sh --max-time=60
  ```

  `compose.admin-api.yml` has the full rationale for each piece in its header comment.

  Expect a full run to delete or disable the `schemathesis-tester` API client itself — it's
  granted `api_client_read`/`api_client_write`, and Schemathesis (correctly) discovers and
  exercises `DELETE /api-clients/{id}` like any other endpoint. Recreate the client (step 3
  above) before the next run if that happens; excluding `/api-clients` via
  `--exclude-path-regex` trades that off against not testing API-client management at all.
