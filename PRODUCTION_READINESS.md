# Production Readiness & Security Audit
**App:** MDS Premium Dashboard / Liveroute Replicon Analytics (v2)
**Audited:** 2026-06-30 · against commit `50e8029`
**Backup point:** tag `backup-stable-20260630` + branch `backup-stable-20260630-branch`

This is the working checklist to take the app from "works on our server" to "enterprise-grade, used daily by real employees." Items are ranked **🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Polish**. Each has a concrete fix.

> **Good news first — already done (verified in code):**
> scrypt password hashing + `timingSafeEqual` ([lib/auth.js](lib/auth.js)); httpOnly + `sameSite` cookies with conditional `secure`; login rate-limiting ([routes/auth.js](routes/auth.js)); **SQLite-backed sessions** that survive restarts; users migrated to SQLite; security headers + CSP + HSTS ([server.js](server.js)); CORS allow-list; a safe global error handler that never leaks stack traces; parameterized SQL everywhere (no injection surface); default passwords come from env vars, not hardcoded; every data route enforces `requireAuth`/`requireAdmin` (145 usages). The roadmap memory is out of date — much of the "critical" list is already shipped.

---

## 🔴 Critical — fix before real employees rely on it

### 1. `trust proxy` is not set (breaks rate-limiting + IP logging behind nginx)
Your server runs behind nginx/Docker, but [server.js](server.js) never calls `app.set('trust proxy', 1)`. Consequences:
- `req.ip` is the **proxy's** IP, not the user's. So the login rate-limiter ([routes/auth.js](routes/auth.js)) keys every user into **one shared bucket** — 15 failed logins from *anyone* locks out *everyone*, and a real attacker behind the same proxy hop is indistinguishable.
- Every audit log IP (`Failed login`, `LOGIN`) is wrong/useless.
- **Fix:** `app.set('trust proxy', 1);` near the top of `server.js` (1 = trust one proxy hop). Confirm nginx sends `X-Forwarded-For`.

### 2. Confirm TLS is actually terminating (HTTPS)
The CORS allow-list still contains raw `http://129.151.146.210`. If the app is reachable over plain HTTP, **session cookies and passwords travel in cleartext**, and the `secure` cookie flag is being skipped. HSTS is set in headers but is meaningless without HTTPS.
- **Fix:** Put nginx/Caddy in front with a real cert (Let's Encrypt). Redirect `:80 → :443`. Then drop the `http://` origins from `ALLOWED_ORIGINS` and force `secure` cookies in production.

### 3. CORS check uses `startsWith` — subdomain/suffix bypass
[server.js](server.js) does `origin.startsWith(o)`. `http://129.151.146.210` also matches `http://129.151.146.210.evil.com`, and `http://localhost` matches `http://localhost.attacker.com`.
- **Fix:** exact-match the origin: `allowedOrigins.includes(origin)`.

### 4. Automated, offsite database backups
Everything lives in a single `data/mds.db`. One bad `rm`, disk failure, or corrupt write and the company's projects/timesheets/users are gone. The in-app "Backup" page is a **manual** download only.
- **Fix:** nightly cron → `sqlite3 mds.db ".backup"` (or `VACUUM INTO`) → encrypt → push to S3/Backblaze with 30-day retention. Test a restore. This is the single highest-value reliability item.

---

## 🟠 High — needed for a credible enterprise tool

### 5. No CSRF tokens
Cookies are `sameSite: 'lax'`, which blocks most cross-site POSTs — good, but not a complete defense (lax still allows top-level GET navigations, and "lax" relies on browser behavior). State-changing admin actions deserve defense-in-depth.
- **Fix:** double-submit CSRF token (or `csrf-csrf` middleware) on all POST/PUT/DELETE, or move to `sameSite: 'strict'` where the UX allows.

### 6. Audit log is a flat JSON file (lossy + race-prone)
`appendAudit` ([lib/rbac.js](lib/rbac.js)) does read-modify-write on `audit-log.json` and **truncates to the last 2000 entries**. Concurrent writes can clobber each other and history silently vanishes — bad for a compliance/audit trail.
- **Fix:** move audit events into an `audit_log` SQLite table (append-only, indexed by `ts`/`user`). You already migrated users this way.

### 7. No password reset / "forgot password" flow
Locked-out users must be reset by hand. No self-service recovery.
- **Fix:** "Forgot password" → time-limited signed token → email → reset page. Depends on email (#8).

### 8. No email / SMTP
Blocks password reset, timesheet reminders, approval notifications, access-request status, and alert delivery. Several settings pages (Email Templates, Alert Rules, Notification Preferences) are **UI shells with no transport behind them**.
- **Fix:** wire SendGrid/SES (or SMTP). Centralize in a `lib/mailer.js`. Then make those settings pages actually send.

### 9. Centralized logging + error alerting
`pino` logs to stdout only. In production you can't see errors, slow queries, or failed-login spikes unless you're tailing Docker logs by hand.
- **Fix:** ship logs to a sink (Grafana Loki / Papertrail / Datadog) and alert on `level>=error` and failed-login bursts.

### 10. Rate-limit more than just login
Only `/login` is throttled. `/api/v1/admin/*`, the streaming dashboard, CSV import, and key-generation endpoints have no abuse protection.
- **Fix:** a general API limiter (e.g., 300 req/15min/IP) plus stricter limits on heavy/sensitive routes. (Requires #1 to key correctly.)

### 11. No global React ErrorBoundary around routes
`ErrorBoundary.jsx` exists but [App.jsx](src/App.jsx) doesn't wrap `<main>`/`<Routes>` in it. Any render error in any page = **white screen of death** for the user.
- **Fix:** wrap the routed `<main>` in `<ErrorBoundary>` with a friendly "Something went wrong — reload / go home" fallback and an error report hook.

### 12. Remove the legacy localStorage auth fallback
[App.jsx](src/App.jsx) still trusts `mds_dashboard_session` from `localStorage` if the cookie check fails. It's a weaker, client-controlled auth path that shouldn't exist now that auth is a httpOnly cookie.
- **Fix:** delete the localStorage fallback branch; rely solely on the cookie + `/api/v1/me`.

---

## 🟡 Medium — hardening, correctness, and missing capabilities

### 13. Input validation with zod (it's installed, unused)
Admin user-create/update ([routes/admin.js](routes/admin.js)) accept arbitrary `permissions`, `id`, `displayName` with minimal checks. Malformed data can be persisted.
- **Fix:** validate request bodies with zod schemas at each route; reject unknown/oversized fields.

### 14. No password policy
An admin can set a one-character password. No minimum length/complexity, no breach check.
- **Fix:** enforce min length (≥10), basic complexity, and ideally a HaveIBeenPwned k-anonymity check on set.

### 15. No MFA / 2FA on admin accounts
Enterprise expectation, especially for `isAdmin` users who can edit everyone's permissions.
- **Fix:** TOTP (authenticator app) for admins at minimum.

### 16. CSP allows `'unsafe-inline'` scripts + remote CDNs without SRI
`script-src 'unsafe-inline' cdnjs unpkg` ([server.js](server.js)) weakens XSS protection, and `index.html` loads `html2pdf`, Boxicons, and Google Fonts from CDNs with **no Subresource Integrity hash** — a CDN compromise = arbitrary code on your domain.
- **Fix:** self-host html2pdf/Boxicons/fonts (or add `integrity`/SRI), then tighten CSP toward nonces/hashes and drop `'unsafe-inline'` for scripts.

### 17. Session is a hard 1-hour expiry with no sliding renewal
Users get logged out mid-task at the 60-minute mark regardless of activity.
- **Fix:** sliding expiry (refresh `expiresAt` on activity) with an absolute max (e.g., 12h), and an optional "remember me."

### 18. Verify CSV upload limits (multer)
`csvImport` uses multer + `express.json({ limit: '5mb' })`. Confirm multer has its own `limits.fileSize`, MIME/type checks, row caps, and that nothing is written to a web-served path.
- **Fix:** set `limits`, validate content, parse in-memory, never persist raw uploads.

### 19. API keys — confirm they're real and enforced
There's an `api_keys` table and a generate flow ([routes/settings.js](routes/settings.js)). Confirm: keys generated with `crypto.randomBytes`, stored **hashed**, compared in constant time, and actually **checked by some middleware**. If nothing validates them, it's a dead/misleading feature.

### 20. `.gitignore` hygiene
No secrets are currently tracked (verified), but confirm `.gitignore` covers `.env`, `data/`, `node_modules/`, `dist/` so they can never be committed by accident on a future `git add -A`.

### 21. `/health` doesn't check the database
Returns `{status:'ok'}` even if SQLite is unreachable. A load balancer would route traffic to a broken instance.
- **Fix:** run a trivial `SELECT 1` and report DB status; add `/ready` vs `/live` if you orchestrate.

---

## 🟢 UX, error handling & "every scenario" — the polish that makes it feel real

You asked specifically about *error handling and UI output, tiniest to biggest part.* The foundations exist (`ToastContext`, `Skeleton`, `EmptyState`, `LoadingScreen`, `LoadingOverlay`). The gaps:

- **Silent failures.** Many fetches use `.catch(() => {})` (page-view audit, logout, some page loads). When a load fails the user sees a blank region with no explanation. → Every data fetch should resolve to one of three explicit states: **loading (skeleton)**, **empty (EmptyState)**, or **error (retry card + toast)**.
- **No "ticket raising" / support path.** You called this out and it doesn't exist. Employees hitting a problem have nowhere to go. → Add a lightweight **"Report an issue"** entry (in the Ribbon/profile menu): captures the current route, the user, a description, and the last client error, stored in a `support_tickets` table + emailed to admins. Pairs naturally with the ErrorBoundary fallback (#11) having a "Report this" button.
- **Form validation feedback.** Inline field-level errors, disabled submit while invalid, and a clear success toast on save — applied consistently across the 32 settings pages and all create/edit forms.
- **Destructive-action confirmations.** Ensure every delete/revoke (users, API keys, projects, clients) has a confirm modal (API Keys already does — make it universal).
- **Network-offline + session-expired banners.** Detect `offline` and 401 globally and show a top banner ("You're offline" / "Session expired — please sign in") instead of silent breakage.
- **Empty states with a next action.** "No projects yet → + Create project," not just blank space.
- **Loading skeletons everywhere**, not spinners-on-blank, so the layout doesn't jump.
- **Accessibility pass.** Focus rings, `aria-label`s on icon-only buttons (the Ribbon/Sidebar icon buttons), keyboard nav in modals (focus trap + Esc), and `prefers-reduced-motion` honored by the heavy aurora/3D animations.
- **404 / not-authorized pages.** Unknown routes silently redirect to `/home`; a real "Page not found" and "You don't have access to this" improve trust.
- **Consistent number/date/currency formatting** via the existing helpers, locale-aware (Localization settings page should actually drive it).

---

## Suggested execution order
1. **#1, #2, #3** (proxy, TLS, CORS) — small code, big security delta.
2. **#4** (backups) — protect the data before anything else can lose it.
3. **#11, #12, ticketing + silent-failure pass** — reliability + the "every scenario" UX you asked for.
4. **#6** (audit→SQLite), **#8** (email) → unlocks **#7** (password reset), **#5** (CSRF), **#10** (rate limits).
5. **#13–#21** hardening, then the 🟢 polish pass site-wide.

---
*Generated as a living document — tick items off as we go. Nothing here changes runtime behavior; it's the map for the work.*
