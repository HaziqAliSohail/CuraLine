#!/usr/bin/env bash
# Generate a self-signed TLS certificate for STAGING into nginx/certs/,
# so the TLS stack (nginx.prod.conf) can be exercised before a real
# certificate exists. Browsers and mobile OSes will warn on self-signed
# certs - for production use certbot (see README "Enabling HTTPS").
#
# Usage:  ./scripts/gen-self-signed-cert.sh [domain]
set -euo pipefail

DOMAIN="${1:-localhost}"
CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

echo "Self-signed cert for '$DOMAIN' written to nginx/certs/"
echo "Enable TLS:  set NGINX_CONF=nginx.prod.conf in .env, then:"
echo "  docker compose --profile basic-setup up -d --force-recreate nginx"
