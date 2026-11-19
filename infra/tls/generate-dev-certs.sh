#!/usr/bin/env bash
set -euo pipefail

TLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Generating local development TLS certificates in $TLS_DIR..."

# 1. Internal CA for proxy-to-app communication
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$TLS_DIR/internal-ca.key" \
  -out "$TLS_DIR/internal-ca.pem" \
  -subj "/CN=TORBIDD Internal CA"

# 2. Internal app certificate (signed by Internal CA, SAN: app)
openssl req -newkey rsa:2048 -nodes \
  -keyout "$TLS_DIR/internal.key" \
  -out "$TLS_DIR/internal.csr" \
  -subj "/CN=app"

openssl x509 -req -days 365 \
  -in "$TLS_DIR/internal.csr" \
  -CA "$TLS_DIR/internal-ca.pem" \
  -CAkey "$TLS_DIR/internal-ca.key" \
  -CAcreateserial \
  -out "$TLS_DIR/internal.crt" \
  -extfile <(printf "subjectAltName=DNS:app\nbasicConstraints=CA:FALSE")

# 3. Public gateway certificate (SAN: localhost, 127.0.0.1)
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$TLS_DIR/privkey.pem" \
  -out "$TLS_DIR/fullchain.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Cleanup temporary CSR and serial files
rm -f "$TLS_DIR/internal.csr" "$TLS_DIR/internal-ca.srl"

echo "✅ Development TLS certificates generated successfully in $TLS_DIR"
