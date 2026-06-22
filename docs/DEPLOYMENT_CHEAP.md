# CuraLine — Cheapest Production Deployment (Runbook)

The whole product — API, workers, scheduler, Postgres, Redis, **and** the React
web app — runs on **one small box**, same-origin (no CORS), behind free TLS and a
free CDN. Copy-paste runbook below.

> Architecture detail and the hardening rationale live in
> [DEPLOYMENT.md](DEPLOYMENT.md). This file is the "do exactly this" version.

---

## 0. The cost (what you actually pay)

| Piece | Cheapest choice | Cost |
|------|------------------|------|
| Compute (everything) | **Oracle Cloud Always Free** ARM VM (4 OCPU / 24 GB) | **$0** |
| …or a more reliable box | **Hetzner CX22** (2 vCPU / 4 GB) | **~$4.5/mo** |
| Postgres + Redis | self-hosted in the compose | $0 |
| Web app + API | same box, same origin | $0 |
| TLS certificate | Let's Encrypt | $0 |
| DNS + CDN + DDoS shield | Cloudflare free plan | $0 |
| Transactional email | Brevo (300/day) or Resend (3k/mo) free tier | $0 |
| Off-box DB backups | Cloudflare R2 (10 GB free) | $0 |
| Uptime monitoring | UptimeRobot / Better Stack free | $0 |
| **Domain name** | Cloudflare Registrar (at-cost) | **~$10/yr** |
| App stores (optional) | Apple $99/yr · Google $25 once | optional |

**Bottom line: $0/month on Oracle Free, or ~$4–5/month on Hetzner — plus ~$10/yr
for a domain.** Everything else is free tier. The only truly unavoidable cost for
a *real* deployment is the domain (and app-store fees if you publish native apps).

Recommendation: **Hetzner CX22** for reliability (Oracle's free ARM capacity is
frequently unavailable), **Cloudflare** in front for free TLS/CDN/DDoS.

---

## 1. Get a domain + Cloudflare (5 min)

1. Buy a domain (Cloudflare Registrar is at-cost). Or use a free dynamic-DNS
   subdomain (DuckDNS) for a hobby deploy.
2. Add the domain to Cloudflare (free plan), update nameservers at your registrar.
3. You'll add the DNS `A` record after the box exists (step 3).

## 2. Create the server (5 min)

**Hetzner:** create a **CX22** (Ubuntu 24.04) in the region nearest your users,
add your SSH key.
**Oracle Free:** create an **Ampere A1** VM (Ubuntu 22.04/24.04), 1–4 OCPU.

Note the public IP.

## 3. Point DNS at the box

In Cloudflare DNS add an `A` record:
- `app.yourdomain.com → <server-ip>` — **Proxied (orange cloud)**.

(Optional) Set SSL/TLS mode to **Full (strict)** once your origin cert is live.

## 4. Harden the box (10 min)

SSH in as root, then:

```bash
# Create a sudo user and lock down SSH
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: only SSH + HTTP/HTTPS
apt update && apt install -y ufw fail2ban
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Auto security updates
apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

Reconnect as `deploy` for the rest.

## 5. Install Docker (3 min)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker version && docker compose version
```

## 6. Get the code + configure secrets (5 min)

```bash
git clone <your-repo-url> curaline && cd curaline/Backend
cp .env.example .env

# Generate strong secrets
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(24))"

nano .env   # paste the two values; set OPENAI_API_KEY, POSTGRES_USER,
            # ALLOWED_ORIGINS=https://app.yourdomain.com,
            # FRONTEND_BASE_URL=https://app.yourdomain.com,
            # ENABLE_DOCS=False, LOG_DIAGNOSE=False
            # (optional) SMTP_* from Brevo/Resend, ELIGIBILITY_* for real coverage
```

## 7. Build the web app (same-origin SPA) (3 min)

```bash
cd ../Frontend
# Replace the placeholder domain in index.html / robots.txt / sitemap.xml first.
npm ci && npm run build      # produces Frontend/dist, which nginx will serve
cd ../Backend
```

## 8. TLS certificate (Let's Encrypt) (5 min)

```bash
# Issue a cert (standalone uses port 80 once; make sure nothing is on :80 yet)
sudo apt install -y certbot
sudo certbot certonly --standalone -d app.yourdomain.com --agree-tos -m you@email.com -n

# Hand the cert to nginx (it expects these two filenames)
sudo cp /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/app.yourdomain.com/privkey.pem   nginx/certs/
sudo chown $USER nginx/certs/*.pem
```

> Cloudflare-only alternative (no certbot): use a **Cloudflare Origin Certificate**
> (15-year cert) — paste it into `nginx/certs/fullchain.pem` / `privkey.pem` and set
> Cloudflare SSL mode to **Full (strict)**.

## 9. Launch everything (2 min)

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps        # all healthy?
curl -fsS https://app.yourdomain.com/health         # {"status":"ok"}
```

Open `https://app.yourdomain.com` — the React app loads, and its `/v1` calls hit
the API on the same origin. Done.

## 10. Cert auto-renewal (2 min)

```bash
# Renew monthly, copy fresh certs in, reload nginx — via cron
( sudo crontab -l 2>/dev/null; cat <<'CRON'
0 3 1 * * certbot renew --standalone --pre-hook "cd /home/deploy/curaline/Backend && docker compose -f docker-compose.prod.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/app.yourdomain.com/*.pem /home/deploy/curaline/Backend/nginx/certs/ && cd /home/deploy/curaline/Backend && docker compose -f docker-compose.prod.yml start nginx"
CRON
) | sudo crontab -
```

## 11. Off-box backups (free, 5 min)

```bash
# Cloudflare R2 (10 GB free). Configure rclone once: rclone config  (S3-compatible)
( crontab -l 2>/dev/null; cat <<'CRON'
30 2 * * * cd /home/deploy/curaline/Backend && docker compose -f docker-compose.prod.yml exec -T postgresdb pg_dump -U "$POSTGRES_USER" appointment_management | gzip > /tmp/curaline_$(date +\%F).sql.gz && rclone copy /tmp/curaline_$(date +\%F).sql.gz r2:curaline-backups/ && rm -f /tmp/curaline_$(date +\%F).sql.gz
CRON
) | crontab -
```

## 12. Monitoring (2 min)

UptimeRobot (free): add an HTTPS monitor for `https://app.yourdomain.com/health`,
alert to email/Slack. That's your "is it up" + a free status page.

## 13. Mobile app (optional)

```bash
cd Mobile
# In src/config.js set PROD_API_URL = https://app.yourdomain.com/v1
npm ci
npx expo start            # free: test instantly via the Expo Go app
# For installable/store builds (free tier):
npx eas build -p android  # APK/AAB; Google Play one-time $25 to publish
npx eas build -p ios      # Apple Developer $99/yr to publish
```
Distributing the Android APK directly (or via Expo Go) costs **$0**.

---

## 14. Push-to-deploy (GitHub Actions)

`.github/workflows/ci-cd.yml` runs the 318 backend tests + the frontend
tests/build on every push & PR, and on push to `main` it **builds the SPA in CI
and SSH-deploys to your box** (sync code → push built `dist` → `docker compose
build && up` → migrate → health smoke-test). No Node needed on the server.

**One-time setup:**

1. Make a dedicated CI SSH key and authorize it on the box:
   ```bash
   ssh-keygen -t ed25519 -f ci_deploy -N ""          # on your laptop
   ssh-copy-id -i ci_deploy.pub deploy@<server-ip>   # add public key to the box
   ```
2. Ensure the box can pull the repo: public repo works as-is; for a **private**
   repo add a read-only **deploy key** (the box's `~/.ssh` key) to the repo's
   Settings → Deploy keys.
3. In the GitHub repo → Settings → Secrets and variables → Actions, add:

   | Secret | Value |
   |--------|-------|
   | `DEPLOY_HOST` | server IP / hostname |
   | `DEPLOY_USER` | `deploy` |
   | `DEPLOY_SSH_KEY` | contents of the **private** `ci_deploy` key |
   | `DEPLOY_PATH` | repo path on the box, e.g. `/home/deploy/curaline` |
   | `DEPLOY_PORT` | *(optional)* SSH port, defaults to `22` |

That's it — `git push origin main` now tests, builds, and deploys. A failed test
blocks the deploy; a failed health check turns the run red.

## 15. Tagged mobile releases (EAS)

`.github/workflows/mobile-release.yml` builds the Expo app on **EAS** when you
push a version tag, and can optionally submit to the stores. EAS build/submit run
on Expo's servers (free tier), so no Mac/Android SDK needed in CI.

**One-time setup:**
```bash
cd Mobile
npm i -g eas-cli
eas login
eas init        # creates the projectId + owner in app.json (commit this)
```
- Create an **EXPO_TOKEN** (expo.dev → Account → Access tokens) and add it as a
  repo secret.
- For store **submission** (optional):
  - **Android:** create a Google Play service account, download its JSON, and add
    it as the `GOOGLE_SERVICE_ACCOUNT_JSON` secret (the workflow writes it to the
    path `eas.json` expects).
  - **iOS:** fill the `submit.production.ios` fields in `eas.json` (Apple ID,
    App Store Connect app id, team id).
- `eas.json` already defines `preview` (internal APK) and `production`
  (store AAB/IPA) profiles.

**Use it:**
```bash
# Build both platforms on a release tag (no store submit by default):
git tag v1.0.0 && git push origin v1.0.0

# Or from the Actions tab → "Mobile Release (EAS)" → Run workflow:
#   platform=all  profile=production  submit=true   ← builds AND submits
```
Store accounts are the only cost here: **Apple Developer $99/yr**, **Google Play
$25 one-time**. For free internal testing, use `profile=preview` (installable APK)
or Expo Go.

---

## Day-2 cheatsheet

```bash
cd ~/curaline/Backend
# Update to latest code
git pull && (cd ../Frontend && npm ci && npm run build) \
  && docker compose -f docker-compose.prod.yml build \
  && docker compose -f docker-compose.prod.yml up -d
# Logs / status
docker compose -f docker-compose.prod.yml logs -f web worker beat
docker compose -f docker-compose.prod.yml ps
# Roll a migration back
docker compose -f docker-compose.prod.yml run --rm migrate alembic downgrade -1
# Scale API/workers on a bigger box
docker compose -f docker-compose.prod.yml up -d --scale web=2 --scale worker=2
```

## When to graduate (and the next cheapest step up)

This single box comfortably serves a launch / pilot. Scale up only when needed:
1. **Bigger box first** (Hetzner CX32, ~$7/mo) — vertical scaling is cheapest.
2. **Managed Postgres** (Neon/Supabase free → paid) when you want point-in-time
   recovery without managing backups yourself.
3. **Separate workers** onto a second box once AI/email volume grows.
4. **Frontend to Cloudflare Pages** (free) if you want the SPA on the CDN edge —
   then set an absolute `VITE` API base URL and re-enable CORS for that origin.

Keep beat at **one** instance no matter what.
