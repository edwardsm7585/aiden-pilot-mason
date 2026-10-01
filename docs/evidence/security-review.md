## Security Review Report

**Branch:** main (no `develop` branch exists)
**Base:** `cb9cd15` (the untouched `aiden init` scaffold), so the review covers all DeskLine work
**Head:** `b8af692`
**Reviewed:** 2026-10-01 00:19 UTC
**Changed files:** 179 total (66 code/config files; the rest are docs and evidence)
**Reviewer:** Claude Code (automated, `/security-review`)

---

### Code Analysis (initial run, head `b8af692`; current status in the last column)

| Category | Initial | Findings | Current |
|----------|--------|----------|---------|
| Auth & Access Control | PASS | All 8 new/changed DeskLine route files use `withAuth`, validate with `parseRequest`/`parseInput`, and scope every query by org (plus owner for agents) before `assertOwnership` → `assertCan`. Acknowledged public exceptions: `api/auth/[...nextauth]` (Auth.js handler) and `api/auth/register` (rate-limited); both asserted by `verify.sh` E1. NextAuth callbacks unchanged (only an import added to `src/lib/auth.ts`). | **PASS**: F3 resolved (see re-check) |
| Injection Prevention | PASS | No `$executeRawUnsafe`/`$queryRawUnsafe`, `eval`, `new Function`, or `dangerouslySetInnerHTML` in app code (`src/generated` is the Prisma client). No raw `req.json()`: every body goes through Zod. Prompt injection: see `injection-probe.md` (0/18). | PASS |
| Data Exposure | **FAIL** | 1 HIGH (by this skill's rule): see F1. All other responses use explicit `select` or hand-built objects; no stack traces in responses (`withAuth` maps known errors; prod 500s are generic); no `console.*` in `src/app/api` or `src/lib`; `NEXT_PUBLIC_*` vars are display strings only (`APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`, `APP_COPYRIGHT`). | **PASS**: F1 resolved in `58b360b` |
| Stripe Security | N/A | No Stripe changes (`billing.enabled: false`). | N/A |
| Server/Client Boundary | PASS | The 5 new `"use client"` files import only React, Next navigation, react-hook-form, zod, sonner, lucide, aiden-ui, aiden-realtime/react, `@/components/ui/select`, `@/config/rbac`, and `@/lib/schemas` (zod + rbac only). No server modules. No Server Actions. | PASS |
| Sensitive Data | **FAIL** | 1 HIGH (by this skill's rule): see F2. No Stripe/SendGrid keys, private keys, JWTs, connection strings, or AI API keys in tracked files (`.env.local` is gitignored; `verify.sh` also greps for `sk-ant-…`). | **PASS**: F2 resolved in `58b360b`; residual exposure F2a closed 2026-10-01 |

### Dependency Vulnerabilities

| Source | Critical | High | Medium | Low |
|--------|----------|------|--------|-----|
| npm audit (1,235 deps) | 0 | 0 | 0 | 0 |
| osv-scanner (989 pkgs in lockfile) | 0 | 0 | 0 | 0 |

### New Package CVE Check

- `@anthropic-ai/sdk@0.131.0`: CLEAR. Known advisory GHSA-p7fg-763f-g4gf / CVE-2026-41686 affects 0.79.0 up to (not including) 0.91.1. ([OSV](https://osv.dev/vulnerability/GHSA-p7fg-763f-g4gf)) *(Corrected 2026-10-01: the original NVD link pointed to CVE-2026-34452, an unrelated Python SDK advisory.)*
- `openai@7.25.0`: CLEAR. 0 advisories in OSV at this version.
- `radix-ui@1.6.7`: CLEAR. 0 advisories in OSV at this version.
- `pino-pretty@13.1.3`: CLEAR. 0 advisories in OSV at this version.
- `deepmerge-ts@8.0.2` (override): CLEAR. GHSA-ggr8-5vv4-36mx / CVE-2026-40345 (stack exhaustion) is fixed from 8.0.0, so 8.0.2 is past the fix. ([OSV](https://osv.dev/vulnerability/GHSA-ggr8-5vv4-36mx)) *(Corrected 2026-10-01: originally said 8.0.2 was the fix and cited an unverified Snyk id.)*
- `mysql2@3.24.5` (override): CLEAR. 0 advisories in OSV at this version; the newest mysql2 advisories are GHSA-3f6p-5ww8-9rcr (fixed 3.22.0) and GHSA-rgwj-5xj2-c3m3 (fixed 3.23.1). ([OSV](https://osv.dev/vulnerability/GHSA-3f6p-5ww8-9rcr)) *(Corrected 2026-10-01: originally gave 3.24.4 as the fix and linked CVE-2024-21511, an unrelated advisory fixed in 3.9.7.)*

### Detailed Findings

- **F1 [HIGH] Data Exposure — `src/app/api/tickets/[id]/route.ts:37`**: `GET` returns the whole ticket row (`{ ...row }`) rather than an explicit `select`. *Today* every column is one the caller is already allowed to see (id, org, owner, subject, body, status, triage, timestamps), so nothing leaks now. The risk is future columns (e.g. internal notes) being exposed by default. **Fix:** `select` the fields the client uses in the `findFirst`, and return that object.
  - **Status:** Resolved in `58b360b`: the ticket query uses an allow-list `select` (`TICKET_FIELDS`); the response now has exactly id, subject, body, status, priority, category, sentiment, ownerId, createdAt, updatedAt (no orgId). Smoke 7/7 after the change; 404 bodies still identical.
- **F2 [HIGH] Sensitive Data — `prisma/seed.ts:20`**: `SEED_PASSWORD = "<redacted>"` was a hard-coded password for the seeded demo accounts. It's a local fixture (hashes are bcrypt), but if the seed ever ran against production it would create 7 accounts with a publicly known password. **Fix:** read `SEED_PASSWORD` from the environment and refuse to seed when `NODE_ENV=production`.
  - **Status:** Resolved in `58b360b`: the password comes from `SEED_PASSWORD` (12+ chars, documented in `.env.example`), and the demo accounts are skipped when `NODE_ENV=production` (RBAC roles still seed). Verified: normal seed OK; missing password stops with an explicit error; production run prints "skipped DeskLine demo data".
- **F2a [HIGH] Sensitive Data — residual of F2 (found 2026-10-01)**: after `58b360b`, the old literal was still quoted in this report (a tracked file in a public repo), and `.env.local` had been given the *same* value, so the 7 demo accounts still accepted a publicly readable password.
  - **Status:** Resolved 2026-10-01: `SEED_PASSWORD` rotated to a new random 24-character value (never printed or committed); `aiden_dev` and `aiden_rerun` re-seeded; the literal redacted here. Verified: old password works on 0/7 demo accounts (bcrypt check) and is refused at sign-in; the new one signs in. `verify.sh` now fails if the current `SEED_PASSWORD` value appears in any tracked file. The old value remains in earlier commits (`8a94092`, `58b360b`, `f965929`); it is dead after rotation, so history was not rewritten.
- **[INFO] `CLAUDE.md`**: 10 added lines are the agent-rules block that `next dev` writes into `CLAUDE.md` itself (see `node_modules/next/dist/server/lib/generate-agent-files.js`). Not a security change.

---

### Verdict (initial run): FAIL

Two HIGH code-analysis findings (F1, F2) fail the gate under this skill's rules, though neither is exploitable as the code stands: F1 exposes only fields the caller is already authorised to see, and F2 only matters if the dev seed is run in production. There are no CRITICAL findings and no dependency vulnerabilities. Both fixes are small; after they land, this review should be re-run and each finding marked "Resolved in `<sha>`".

---

## Re-run after fixes — 2026-10-01, head `58b360b`

| Category | Status |
|---|---|
| Auth & Access Control | PASS |
| Injection Prevention | PASS |
| Data Exposure | PASS (F1 resolved) |
| Stripe Security | N/A |
| Server/Client Boundary | PASS |
| Sensitive Data | PASS (F2 resolved; no password literals in code). See F2a: the report itself still quoted the old value until 2026-10-01 |
| npm audit / osv-scanner | 0 / 0 |

Also re-run after the fix: `scripts/smoke.sh` 7/7, `scripts/verify.sh` 0 failing checks, `tsc` and lint clean.

### Verdict (after F1/F2 fixes): PASS (superseded by the re-check below)

No CRITICAL or HIGH findings remain; dependency scans are clean.

---

## Independent re-check — 2026-10-01, head `d7cd7af`

Every claim above was re-verified against the current code and live requests, without relying on the original report. The scope was widened to **all 16 API route files**, including the 8 starter routes the original review skipped as "unchanged". They now sit on top of DeskLine data, so a starter route can still affect it.

### Confirmed (still true)

| Claim | How it was checked | Result |
|---|---|---|
| Every route authenticates | All 16 `route.ts` files: 14 use `withAuth`; NextAuth only re-exports handlers; register is `withRateLimit` | ✔ |
| Register is rate-limited | 15 rapid requests: 5 × 400, then 429 | ✔ |
| NextAuth `update()` can't grant roles | `aiden-auth` `jwt` callback reloads roles from the DB on `trigger === "update"`, ignoring client data; `dev/impersonate` only echoes, and 404s in production | ✔ |
| Org roles can't mix with global roles | `orgSession` *replaces* `roles` with the org role; global roles are `admin`/`member` (no overlap); no demo user holds a global role (`_UserRoles` empty) | ✔ |
| No injection sinks | No `$queryRaw*`/`$executeRaw*`, `eval`, `new Function`, `dangerouslySetInnerHTML` outside `src/generated`; no raw `req.json()/text()/formData()` | ✔ |
| Responses are allow-listed | Every `NextResponse.json` returns an explicit `select` or a hand-built object (PATCH/close read full rows internally but return hand-built objects); `/api/me` reads the hash in a separate query and returns only `hasPassword` | ✔ |
| Errors don't leak | `withAuth` maps known errors to 400/403/404 and re-throws the rest; Next returns a bare 500 in production; malformed JSON gives a Zod message only | ✔ |
| `NEXT_PUBLIC_*` are display strings | Only `APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`, `APP_COPYRIGHT` | ✔ |
| Client files import no server code | The 5 DeskLine `"use client"` files import only UI/form libs, `@/components/ui/select`, `@/config/rbac`, `@/lib/schemas` (zod + rbac only) | ✔ |
| No secrets in the repo | The live `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `SEED_PASSWORD`, `DATABASE_URL` and DB password searched for verbatim in **all 55 commits**: none found. Pattern scan of history (session tokens, JWTs, CSRF tokens, private keys, Stripe/SendGrid/Anthropic keys, credentialed connection strings): only the security tooling's own patterns and the `.env.example` placeholder | ✔ |
| Seed safety (F2) | Empty or short `SEED_PASSWORD` → explicit error, no demo accounts; `NODE_ENV=production` → "skipped DeskLine demo data" | ✔ |
| Dependencies | `npm audit`: 0 of 1,235 deps; `osv-scanner` 2.4.0: 0 of 989 packages; OSV API: 0 advisories for each new/overridden package at its installed version | ✔ |

### Corrections to this report

- Three advisory citations under *New Package CVE Check* were wrong (an unrelated CVE link, and wrong fix versions for deepmerge-ts and mysql2). They are corrected in place above. The CLEAR verdicts themselves were right.
- F2 said the demo password was "documented in the README". It wasn't, so the phrase is removed.
- The header (head `b8af692`, 179 changed files) describes the initial run only.

### New findings

- **F3 [HIGH] Auth & Access Control — `src/app/api/me/route.ts` `DELETE` + `prisma/fragments/ticket.prisma:18`**: the starter's self-service account deletion hard-deletes the user, and `Ticket.owner` is `onDelete: Cascade`. As a result:
  - an agent can permanently delete org tickets, though no role has a ticket-delete permission (`DELETE /api/tickets/{id}` → 405);
  - a sole owner can delete themselves and leave the org with **0 owners**, bypassing the last-owner 409 rule.

  Reproduced on the throwaway `aiden_rerun` DB: agent2 `DELETE /api/me` → 204, ticket `a3` gone (org tickets 11 → 10); owner `DELETE /api/me` → 204, Acme owners 1 → 0. The two `user.delete` audit rows remain. The same action is exposed in the UI (Settings → Data & privacy → Delete account).
  - **Status:** Resolved (candidate chose *reassign + block*):
    - `src/lib/account-deletion.ts` runs one Serializable transaction that hands the user's tickets to another owner of their org (audit `ticket.reassign {count, reason}`), refuses a sole owner with 409 and a specific message, then deletes the user. `user.delete` is now audited only after a successful delete.
    - Migration `ticket_owner_restrict` changes `Ticket.owner` from `Cascade` to `Restrict`, so even a raw `DELETE FROM users` can't take tickets with it.
    - The members role-change last-owner check now runs in a Serializable transaction, so two owners demoting each other at once can't reach 0 owners.
    - Serialization conflicts arrive in two shapes with the pg adapter (P2034, or a bare `DriverAdapterError` "TransactionWriteConflict" at commit); `src/lib/db-errors.ts` recognises both, so a race returns 409 rather than 500. A first version missed the second shape; the forced-overlap test caught it.
    - The delete dialog now says tickets move to an org owner and shows the server's reason on refusal (`screenshots/ui/25-…`, `26-…`).
    - Verified (`f3-account-deletion.txt`): agent deletion keeps the ticket under the owner; sole owner 409 with nothing changed; raw SQL delete refused by the FK; concurrent owner deletions leave exactly one owner and no lost tickets; 6/6 forced-overlap rounds end with one change applied and one 409. Regression: smoke 7/7, extended matrix 37/37.
- **F4 [MEDIUM] Auth — credentials sign-in is not rate-limited** (starter/SDK): 20 wrong-password attempts in a row were all processed, with no lockout or 429. The demo accounts use a 24-character random password, so they aren't guessable, but real user passwords could be brute-forced. Fix: rate-limit `POST /api/auth/callback/credentials`.
  - **Status:** Resolved. `src/app/api/auth/[...nextauth]/route.ts` wraps Auth.js's `POST` in the SDK's `withRateLimit` twice, for credentials sign-in only:
    - 10 attempts a minute per IP;
    - 20 attempts in 15 minutes per account (email, case- and space-insensitive), which stops a slow or distributed attack on one account without locking out a user who makes a few typos.
    - Sign-out, session and OAuth POSTs are not limited, and `GET` is the plain Auth.js handler.
    - The 429 is answered in Auth.js's own shape (`{ url: "/login?error=RateLimited" }`, or a 303 for non-JS posts), so the login form neither throws nor hangs. `Retry-After` is kept.
    - `verify.sh` E1 now asserts all of this.
    - **Bugs found while proving it:**
      - The SDK's `withRateLimit` mutates the handler's response headers, and Auth.js's failed-sign-in redirect has immutable headers. Every wrong password became a **500**. Fixed by handing it a mutable copy; recorded for upstream in `.claude/fixes/aiden-security.md`.
      - The auth pages never mounted a `<Toaster />`, so even a plain wrong password showed **no message**. It is now mounted once at the root, per DS 07.
    - Verified on the production server (`f4-signin-rate-limit.txt`): 12/12 checks, plus the real login form in a browser. A wrong password shows its toast; a rate-limited attempt gets a 429, the form stays usable, and there are no page or server errors.
    - **Residuals closed 2026-10-01** (`docs/evidence/limitations-fixes.txt`):
      - **Specific message:** the login page now shows "Too many sign-in attempts… wait about N minutes". The 429 sets a short-lived cookie holding only a timestamp, and `SignInLimitNotice` composes beside the SDK `LoginForm` and dismisses its generic toast. A native fix is still proposed upstream.
      - **IP spoofing:** the per-IP key no longer trusts client-supplied entries. It takes the address the outermost trusted proxy appended (`TRUSTED_PROXY_HOPS`, default 1); a spoofed left-hand `X-Forwarded-For` no longer evades the limit.
      - **Shared store:** limits live in Postgres (`rate_limit_hits`, SHA-256 hashed keys), shared by every instance and kept across restarts. Proven with two instances and a restart.
- **F5 [MEDIUM] Defence in depth — production CSP allows `script-src 'unsafe-inline'`** (Next's inline bootstrap scripts need it without nonces). There are no XSS sinks in the code, so nothing is exploitable today, but the CSP wouldn't stop an injected inline script. Fix: nonce-based CSP via `proxy.ts` (upstream `securityHeaders` option).
  - **Status:** Resolved. `src/proxy.ts` follows Next 16's CSP guide:
    - A fresh nonce on every request: `script-src 'self' 'nonce-…' 'strict-dynamic'`, with no `'unsafe-inline'`. `'unsafe-eval'` is dev-only.
    - The SDK's `securityHeaders({ csp: false })` still sets HSTS, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy.
    - The root layout reads `x-nonce` and passes it to next-themes. This also makes every route dynamic (build shows 0 static routes), which nonces require.
    - `src/instrumentation-client.ts` sets Zod's `jitless` mode, so its eval probe no longer raises a CSP violation on every page.
    - `verify.sh` asserts the nonce and fails on `unsafe-inline` in `script-src`.
    - Verified on the production server (`f5-csp-nonce.txt`):
      - every `<script>` on every page carries that request's nonce, and the nonce changes per request;
      - **0 CSP violations** across a clean load, form sign-in, a streamed draft and dark mode;
      - injected-HTML XSS vectors (`<img onerror>`, a parser-inserted `<script>`, a `javascript:` URL) **ran under the old policy and are blocked now**.
    - Trade-offs:
      - `style-src` keeps `'unsafe-inline'`, because Radix and sonner set inline style attributes, which nonces can't cover. Style injection can't run script.
      - `/login` and `/register` now render per request instead of being prerendered.
      - Phase 6's `headers.txt` shows the earlier policy and is kept as history.

### Verdict (re-check, initial): FAIL

F3 was a HIGH access-control finding, so the gate failed until F3 was fixed.

### Verdict (after the F3 fix): PASS

No CRITICAL or HIGH findings remained; F4 and F5 (MEDIUM) were still open.

### Verdict (after the F4 and F5 fixes): **PASS, no open findings**

F1, F2, F2a, F3, F4 and F5 are all resolved and verified. The residual items listed under F4 and F5 are deployment notes and upstream SDK requests, not open findings in this app. Regression on the production build: smoke 7/7, extended matrix 37/37, dashboard toast flows intact, `verify.sh` 0 failing checks, `tsc` and lint clean.
