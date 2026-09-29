#!/usr/bin/env bash
# Runs Schemathesis (property-based API testing, driven by the OpenAPI schema) against
# PrestaShop's Admin API. See ../README.md for the wider picture.
#
# Usage:
#   schemathesis/run.sh                       # default: all checks, no time limit
#   schemathesis/run.sh --max-time=60s         # extra flags are passed straight to `schemathesis run`
#
# Requires: an Admin API client's credentials in schemathesis/.env (see .env.example), the
# admin-api-tls proxy up (docker compose, see ../Caddyfile — the Admin API refuses plain HTTP),
# and the Python venv with schemathesis installed (python3 -m venv .venv && .venv/bin/pip
# install schemathesis).

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="schemathesis/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy schemathesis/.env.example, create an Admin API client" >&2
  echo "(Advanced Parameters > Admin API in the back office), and fill in its id/secret." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ORIGIN="${ADMIN_API_ORIGIN:-https://localhost:8443}"

# The client_credentials grant only puts the scopes you ask for into the token — omitting
# `scope` gets you a bare `is_authenticated` token that 401s on every real resource. Ask for
# every scope the schema declares; the client itself still needs each one authorized
# (Advanced Parameters > Admin API > this client > Enable all), or the token request 400s.
SCOPES=$(python3 -c "
import json
schema = json.load(open('schemathesis/openapi.json'))
scopes = schema['components']['securitySchemes']['oauth']['flows']['clientCredentials']['scopes'].keys()
print(' '.join(scopes))
")

TOKEN_RESPONSE=$(curl -sk -X POST "$ORIGIN/admin-api/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$API_CLIENT_ID" \
  --data-urlencode "client_secret=$API_CLIENT_SECRET" \
  --data-urlencode "scope=$SCOPES")

TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
  echo "Failed to get an access token. Response was:" >&2
  echo "$TOKEN_RESPONSE" >&2
  exit 1
}

source .venv/bin/activate
schemathesis run \
  --url "$ORIGIN/admin-api" \
  --header "Authorization: Bearer $TOKEN" \
  --tls-verify certs/localhost.pem \
  --checks all \
  "$@" \
  schemathesis/openapi.json
