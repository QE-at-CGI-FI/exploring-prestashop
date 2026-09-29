---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Confirms the app is a single-process PHP monolith with no documented multi-node/clustered production topology to mirror — the minimal topology below is not a simplification of something more complex, it's the actual shape.
  - path: compose.yaml
    why: The existing local dev topology (db + prestashop) this plan extends with a Bombadil client container for actual Antithesis platform use.
---

# Deployment Topology

## Goal recap

The simplest container topology that lets Antithesis fault-inject around the same SUT this
project already runs locally via `docker compose up -d` (`compose.yaml`), with a Bombadil client
added so Antithesis can run the workload rather than a developer invoking
`npx bombadil browser test` by hand.

## Components

### `db` — Dependency

- **Image:** official `mysql:8` (already used in `compose.yaml`, no change needed).
- **Role:** Dependency.
- **What it runs:** MySQL 8, holding all PrestaShop durable state (`ps_*` tables).
- **Network:** Connected to `prestashop` only.
- **Replicas:** 1. No replication topology exists or is claimed by this deployment — running more
  than one would test a scenario (replication) this project doesn't have.

### `prestashop` — Service

- **Image:** `prestashop/prestashop:latest` (already used in `compose.yaml`), or a pinned tag if
  the version-drift caveat in `sut-analysis.md` is resolved by pinning.
- **Role:** Service (the SUT entrypoint).
- **What it runs:** Apache + PHP-FPM/mod_php serving both the storefront and `/admin-dev/` back
  office from the same process, per `sut-analysis.md`'s Architecture section.
- **Network:** Connected to `db` (MySQL protocol) and to the Bombadil client (HTTP, port 80/8080
  per `compose.yaml`'s existing mapping).
- **Replicas:** 1. Single-process monolith; no meaningful failover/leader-election scenario to
  test with more replicas (see `sut-analysis.md`'s Concurrency Model — the interesting races here
  are client-side/browser-timing, not inter-node).
- **Faults this container should be exposed to:** node hang, node throttling (both directly
  relevant to the async-dropdown-race property family — slowing this container down widens the
  exact windows those properties target), baseline network latency/congestion between it and the
  client. Node termination is **not required** by any property in this catalog (no
  crash-recovery/restart-correctness property exists — flagged as a coverage note for
  `property-evaluation.md`, not a topology requirement) — leave it at its default-disabled setting
  per `references/faults.md` unless a future property needs it.

### `bombadil-client` — Client

- **Image:** New, thin Dockerfile: Node.js base image + `@antithesishq/bombadil` installed (mirror
  `package.json`'s existing devDependency) + this repo's `bombadil/specification.ts`.
- **Role:** Client (workload driver).
- **What it runs:** The Bombadil browser-driving workload against `http://prestashop/` (container
  DNS name, replacing the local `http://localhost:8080` this project's `npm test`/`npm run
  test:bombadil` scripts currently target), checking the properties in
  `bombadil/specification.ts` plus whichever of the 23 catalogued properties are implemented.
- **Test template:** `/opt/antithesis/test/v1/bombadil/` containing a `parallel_driver_bombadil`
  (or similarly-prefixed) command that invokes the existing `npx bombadil browser test` CLI
  pointed at the container-network URL instead of `localhost`.
- **Network:** Connected to `prestashop` only.
- **Replicas:** 1. A single browser-driving client is sufficient for every property in this
  catalog — none require a second concurrent browser session (the "second guest checkout tab"
  scenario implied by some Data-Integrity-lens reasoning was explicitly *not* catalogued as a
  property this pass; noted as a coverage gap below).

## Diagram

```text
+----------------------+      +----------------------+      +----------------------+
| bombadil-client       | ---> | prestashop           | ---> | db                   |
| (Bombadil workload,   | <--- | (Apache+PHP,          | <--- | (MySQL 8)            |
|  runs specification.ts)|     |  storefront + BO)     |      |                      |
+----------------------+      +----------------------+      +----------------------+
        HTTP (port 80)              MySQL protocol
```

Three containers total — matches `compose.yaml`'s existing two plus one new client. No cache,
queue, or search service exists in this deployment to add (see `sut-analysis.md`'s External
Dependencies section).

## Out of scope for this topology

- `compose.admin-api.yml`'s Caddy TLS overlay (`admin-api-tls`) — irrelevant to Bombadil, which
  drives plain-HTTP storefront/back-office traffic; that overlay exists solely for the separate
  Schemathesis Admin-API test suite in this project and isn't part of the property catalog above.
- A second `bombadil-client` replica for genuine multi-session concurrency (e.g. two guest
  checkouts racing on the same product's stock) — no property in the current catalog requires it,
  but it's worth flagging: `sut-analysis.md`'s Concurrency Model section explicitly notes
  MySQL-level races between two carts are real in principle but unobservable to a single-session
  workload. If a future pass adds such a property, this topology would need a second client
  replica.

## Open Questions

- Should `bombadil-client` also authenticate into `/admin-dev/`? This is the same catalog-wide
  open question from `property-catalog.md` — it changes the workload container's script, not the
  topology's shape (still 3 containers either way), so it's noted here for completeness but
  doesn't block finalizing this topology. `(needs human input)`
