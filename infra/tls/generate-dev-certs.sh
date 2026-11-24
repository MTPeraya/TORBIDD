#!/usr/bin/env bash
# Generates self-signed TLS certificates for local Docker Compose development.
# Do NOT use these certificates in production (see infra/tls/README.md).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating local development TLS certificates in ${SCRIPT_DIR}..."

# 1. Public TLS cert/key for Nginx gateway (localhost)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${SCRIPT_DIR}/privkey.pem" \
  -out "${SCRIPT_DIR}/fullchain.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# 2. Internal CA for Nginx <-> Next.js TLS hop
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${SCRIPT_DIR}/internal-ca.key" \
  -out "${SCRIPT_DIR}/internal-ca.pem" \
  -subj "/CN=torbidd-internal-ca"

# 3. Internal cert/key with SAN=DNS:app (required by proxy_ssl_verify & Node healthcheck)
openssl req -nodes -newkey rsa:2048 \
  -keyout "${SCRIPT_DIR}/internal.key" \
  -out "${SCRIPT_DIR}/internal.csr" \
  -subj "/CN=app"

openssl x509 -req -days 365 \
  -in "${SCRIPT_DIR}/internal.csr" \
  -CA "${SCRIPT_DIR}/internal-ca.pem" \
  -CAkey "${SCRIPT_DIR}/internal-ca.key" \
  -CAcreateserial \
  -out "${SCRIPT_DIR}/internal.crt" \
  -extfile <(printf "subjectAltName=DNS:app,DNS:localhost,IP:127.0.0.1")

rm -f "${SCRIPT_DIR}/internal.csr" "${SCRIPT_DIR}/internal-ca.srl"
chmod 600 "${SCRIPT_DIR}/privkey.pem" "${SCRIPT_DIR}/internal.key" "${SCRIPT_DIR}/internal-ca.key"

echo "Done! You can now run: docker compose up --build"
