# Generate a self-signed TLS certificate for STAGING into nginx/certs/ (Windows).
# Requires openssl (ships with Git for Windows: C:\Program Files\Git\usr\bin).
# For production use certbot - see README "Enabling HTTPS".
#
# Usage:  .\scripts\gen-self-signed-cert.ps1 [-Domain yourdomain.com]
param([string]$Domain = "localhost")

$certDir = Join-Path $PSScriptRoot "..\nginx\certs"
New-Item -ItemType Directory -Force $certDir | Out-Null

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenssl) { $openssl = $gitOpenssl }
    else { Write-Error "openssl not found. Install Git for Windows or OpenSSL."; exit 1 }
}

& $openssl req -x509 -nodes -newkey rsa:2048 -days 365 `
    -keyout (Join-Path $certDir "privkey.pem") `
    -out (Join-Path $certDir "fullchain.pem") `
    -subj "/CN=$Domain" `
    -addext "subjectAltName=DNS:$Domain,DNS:localhost,IP:127.0.0.1"

Write-Host "Self-signed cert for '$Domain' written to nginx/certs/"
Write-Host "Enable TLS: set NGINX_CONF=nginx.prod.conf in .env, then recreate the nginx container."
