#!/usr/bin/env bash
# Brings up colima + `docker compose up -d`, then waits for the PrestaShop storefront to
# actually respond before handing control back — `docker compose up -d` returns as soon as
# containers are *started*, not once PrestaShop has finished PS_INSTALL_AUTO on a first boot.
#
# Used as the `pretest` step for `npm test` (see package.json).

set -euo pipefail

ORIGIN="${BOMBADIL_ORIGIN:-http://localhost:8080}"
READY_TIMEOUT_SECONDS=180

echo "==> Starting colima"
colima start

echo "==> Starting containers (docker compose up -d)"
docker compose up -d

echo "==> Waiting for $ORIGIN to respond (up to ${READY_TIMEOUT_SECONDS}s)"
elapsed=0
until curl --silent --fail --output /dev/null "$ORIGIN/"; do
  if [ "$elapsed" -ge "$READY_TIMEOUT_SECONDS" ]; then
    echo "!! $ORIGIN did not become ready within ${READY_TIMEOUT_SECONDS}s" >&2
    docker compose logs --tail=50 >&2
    exit 1
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

echo "==> $ORIGIN is up"
