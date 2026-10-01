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
| Auth & Access Control | PASS | All 8 new/changed DeskLine route files use `withAuth`, validate with `parseRequest`/`parseInput`, and scope every query by org (plus owner for agents) before `assertOwnership` → `assertCan`. Acknowledged public exceptions: `api/auth/[...nextauth]` (Auth.js handler) and `api/auth/register` (rate-limited); both asserted by `verify.sh` E1. NextAuth callbacks unchanged (only an import added to `src/lib/auth.ts`). | PASS |
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

- `@anthropic-ai/sdk@0.131.0`: CLEAR. Known advisory CVE-2026-41686 / GHSA-p7fg-763f-g4gf affects 0.79.0–0.91.0 only. ([NVD](https://nvd.nist.gov/vuln/detail/cve-2026-34452), [chroxy #7886](https://github.com/blamechris/chroxy/issues/7886))
- `openai@7.25.0`: CLEAR. No advisories for the npm package. ([Snyk](https://security.snyk.io/package/npm/openai))
- `radix-ui@1.6.7`: CLEAR. ([Snyk](https://security.snyk.io/package/npm/radix-ui))
- `pino-pretty@13.1.3`: CLEAR. ([Snyk](https://snyk.io/vuln/npm:pino-pretty))
- `deepmerge-ts@8.0.2` (override): CLEAR. 8.0.2 is the fix for GHSA-ggr8-5vv4-36mx / CVE-2026-40345, which this override was added to close. ([Snyk](https://security.snyk.io/vuln/SNYK-JS-DEEPMERGETS-2438399))
- `mysql2@3.24.5` (override): CLEAR in osv-scanner and npm audit. Web sources list 3.24.4 as the fix for GHSA-3f6p-5ww8-9rcr. ([Snyk](https://security.snyk.io/package/npm/mysql2), [CVE-2024-21511](https://www.cvedetails.com/cve/CVE-2024-21511/))

### Detailed Findings

- **F1 [HIGH] Data Exposure — `src/app/api/tickets/[id]/route.ts:37`**: `GET` returns the whole ticket row (`{ ...row }`) rather than an explicit `select`. *Today* every column is one the caller is already allowed to see (id, org, owner, subject, body, status, triage, timestamps), so nothing leaks now. The risk is future columns (e.g. internal notes) being exposed by default. **Fix:** `select` the fields the client uses in the `findFirst`, and return that object.
  - **Status:** Resolved in `58b360b`: the ticket query uses an allow-list `select` (`TICKET_FIELDS`); the response now has exactly id, subject, body, status, priority, category, sentiment, ownerId, createdAt, updatedAt (no orgId). Smoke 7/7 after the change; 404 bodies still identical.
- **F2 [HIGH] Sensitive Data — `prisma/seed.ts:20`**: `SEED_PASSWORD = "<redacted>"` was a hard-coded password for the seeded demo accounts. It's a local fixture (documented in the README; hashes are bcrypt), but if the seed ever ran against production it would create 7 accounts with a publicly known password. **Fix:** read `SEED_PASSWORD` from the environment and refuse to seed when `NODE_ENV=production`.
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

### Verdict: PASS

No CRITICAL or HIGH findings remain; dependency scans are clean.
