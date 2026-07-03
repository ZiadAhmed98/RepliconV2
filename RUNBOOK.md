# Operations Runbook — MDS Premium Dashboard

Practical, copy-paste ops for the Ubuntu server (`ubuntu@129.151.146.210`).
Environments: **prod** (`:443`, branch `main`, container `mds_dashboard_production`, `data/mds_prod.db`) ·
**test** (`:8081`, branch `test`, container `mds_dashboard_test`, `data/mds.db`) ·
**dev** (`:8082`, branch `dev`, container `mds_dashboard_development`).

App dir on server: `/var/www/replicon/<env>`.

---

## Deploy
A push to GitHub fires a **webhook** that auto-pulls + rebuilds the matching env. Manual equivalent:
```bash
cd /var/www/replicon/test
git pull
docker compose up -d --build
```

## Promotion flow (dev → test → prod)
- **`dev`** branch → dev env (`:8082`) — active development.
- **`test`** branch → test env (`:8081`) — validation / UAT. Merge here only after the **CI build passes**.
- **`main`** branch → prod (`:443`) — promote by merging `test → main` after sign-off on test.

CI (`.github/workflows/ci.yml`) runs install + Vite build on every push/PR — keep prod promotion gated on a green build. For prod-like data in test, periodically restore a recent prod backup into the test DB (see the restore drill below), scrubbing secrets as needed.

## Rollback (fast)
```bash
cd /var/www/replicon/test
git log --oneline -10           # find the last good commit
git reset --hard <good_sha>     # or: git revert <bad_sha> && git push
docker compose up -d --build
```
Immutable restore point from before the current UI/hardening work: tag **`backup-stable-20260630`**.

## Logs
```bash
docker logs -f --tail=100 mds_dashboard_test          # live
docker logs --since 15m mds_dashboard_test 2>&1 | grep -iE 'error|cors|csrf'
```

## Health / readiness
```bash
curl -s http://localhost:3001/health   # liveness → {"status":"ok"}
curl -s http://localhost:3001/ready    # readiness → checks DB, 503 if down
```
(Prod is `:3000`, dev `:3002`.)

## Database backup + restore
**Backup** (online, safe while running; keeps newest 30 in `data/backups/`):
```bash
cd /var/www/replicon/test && npm run backup
```
Schedule it (daily 02:30) + push offsite:
```cron
30 2 * * * cd /var/www/replicon/test && /usr/bin/node scripts/backup-db.mjs >> data/backups/backup.log 2>&1
35 2 * * * rclone copy /var/www/replicon/test/data/backups remote:mds-backups   # after configuring rclone
```
**Restore drill** (do this periodically so you know it works):
```bash
docker compose down
cp data/backups/mds-<timestamp>.db data/mds.db     # pick a known-good backup
docker compose up -d
curl -s http://localhost:3001/ready                # confirm DB up
```

---

## Incident switches

### A write started failing with 403 "Invalid or missing CSRF token"
CSRF (double-submit) is likely mis-firing. Disable it, restart, investigate:
```bash
# add DISABLE_CSRF=1 to the env, then restart
cd /var/www/replicon/test
grep -q '^DISABLE_CSRF=' .env && sed -i 's/^DISABLE_CSRF=.*/DISABLE_CSRF=1/' .env || echo 'DISABLE_CSRF=1' >> .env
docker compose up -d
```
Re-enable by setting `DISABLE_CSRF=0` (or removing the line) and restarting.

### Assets 500 with "CORS: Origin ... not allowed"
The origin/port isn't allowed. CORS matches the **hostname** and allows any port; if you add a new host/domain, set `ALLOWED_ORIGINS` in `.env` (comma-separated) and restart. The IP is served on `:443/:8081/:8082`.

### Too many "429 Too many requests"
The general API limiter default is 5000 req/15min/IP. Behind a shared corporate NAT this can be tight — raise it:
```bash
echo 'API_RATE_MAX=15000' >> .env && docker compose up -d
```

### A container is crash-looping
```bash
docker ps -a --filter name=mds_            # see status
docker logs --tail=80 <container_name>     # find the cause
docker compose up -d --build <service>
```

---

## Environment variables (server `.env`)
Required: `REPLICON_TOKEN`, `REPLICON_COMPANY`, `NODE_ENV`, `PORT`.
Security/ops: `SESSION_MS` (default 3600000), `ALLOWED_ORIGINS`, `API_RATE_MAX` (default 5000),
`DISABLE_CSRF` (default off), `AdminPWD`/`ModPWD`/`GMPWD` (seed default users on first start),
`ANTHROPIC_API_KEY` (AI), `AZURE_*` (calendar). Never commit `.env` (it's gitignored).
