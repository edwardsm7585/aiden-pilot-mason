# AIDEN security guide: checklist against DeskLine (2026-10-01)

Each section of the AIDEN security guide was checked against the code, the live database and a production build. Gaps found by this check were fixed and tested; they are marked **fixed**. Runtime proof: `security-guide-gaps.txt` (18/18), plus regression on the production build: smoke 7/7, extended matrix 37/37, sign-in rate limit 12/12, and the CSP browser flow with 0 violations.

## 1–4. The request perimeter

| Rule | Status | Evidence |
|---|---|---|
| Every route under `src/app/api/**` wrapped in `withAuth` | ✔ 14 of 16 route files | `verify.sh` "route without withAuth". The 2 exceptions are NextAuth's own handler and registration, both public by design, both rate-limited and asserted (E1) |
| `withAuth` opens `withRequestContext` | ✔ | every audit row from those routes has a `request_id`, which joins audit to `ai_usage` (`db-phase6/05-trace-*.png`) |
| Public routes also tag their events | **fixed** | before: `auth.signin` rows had no `request_id`. `src/lib/request-context.ts` now opens the same context on NextAuth and register, so sign-in, sign-out and register rows carry one |
| Bodies via `parseRequest` | ✔ | every route with a body; no raw `req.json()` (`verify.sh`). Registration validates inside the SDK handler |
| Params and query validated too (plan D5) | **fixed** | the starter's `GET /api/admin/users` read `q`, `cursor` and `limit` raw and silently clamped bad values. It now uses `parseInput` with a Zod schema (bad input → 400; the UI's own requests still 200; pagination works) |
| `assertOwnership` after every row fetch | ✔ | all `[id]` routes: org-scoped `findFirst` → `assertOwnership` → `assertCan`; identical 404 for missing, other-org and other-agent (smoke 3–5, 7) |
| `assertCan` on role-gated actions | ✔ | all DeskLine actions plus the admin routes. `admin/users/[id]/roles` checks the role before reading the body (stricter than the diagram) |
| Order: auth → validate → read → own → can → work + audit | ✔ | per-route trace in this check; list routes use `assertCan` plus an org-scoped query (no single row to own-check) |
| Webhooks | n/a | no Stripe or other webhooks (`billing.enabled: false`) |

## 5. Audit logging

| Rule | Status | Evidence |
|---|---|---|
| Default sink writes `AuditLog` | ✔ | `src/lib/audit.ts`, registered in the route module graph |
| Auto events: sign-in | ✔ | `auth.signin` |
| Auto events: sign-out | ✔ (now proven) | `auth.signout` had never been exercised; now tested, with a `request_id` |
| Auto events: create user | **fixed** | the SDK emits `auth.register` only from NextAuth's `createUser` event, which never fires for password sign-ups (`createRegisterHandler` writes the user directly). The register route now audits through the SDK's `onPostRegister` hook. Repeat registrations of an existing email get the same 201 and no second row |
| Auto events: ownership failures, ability denials | ✔ | `security.ownership_failed`, `security.ability_denied` |
| Custom events | ✔ | `ticket.*`, `ai.*`, `member.role_change`, `user.*` (list in `docs/audit-retention.md`) |
| Swappable sink | ✔ | `AUDIT_SINK=jsonl` proven (`audit-sink-jsonl.txt`) |
| Retention and archival documented | **fixed** | `docs/audit-retention.md` records current behaviour (keep everything, delete nothing, rows outlive what they describe). **The retention period and archive target are still the owner's decision** |

## 6. Secrets

| Rule | Status | Evidence |
|---|---|---|
| No `.env*` or secrets committed | ✔ | all 55 commits searched for the live values: none (security re-check). `verify.sh` checks `.env` history, key patterns and the live `SEED_PASSWORD` |
| Rotate anything that touched git | ✔ | the seed password was in history, so it was rotated (F2a) |
| Logs are redacted | ✔ | `src/lib/logger.ts` uses aiden-logging's default redaction (no override); no logged bodies, prompts or tokens (`verify.sh`) |
| No secret echoed from a route | ✔ | `/api/me` returns `hasPassword`, never the hash; no route returns env values |
| Env validated at boot | ✔ | `aiden doctor` green at every checkpoint (`checkpoints/LOG.md`) |
| `server-only` on modules that import secrets | **fixed** | `src/lib/prisma.ts` (database URL) and `src/lib/auth.ts` (auth secret and config) lacked it; added. All other secret-touching modules already had it |

## 7. Security headers

| Rule | Status | Evidence |
|---|---|---|
| SDK `securityHeaders` | ✔ | `src/proxy.ts` (Next 16 renamed middleware to proxy): HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| CSP suited to the app | ✔ | per-request nonce CSP, with no `'unsafe-inline'` for scripts (F5, `f5-csp-nonce.txt`) |

## 8. CVE scanning and supply chain

| Rule | Status | Evidence |
|---|---|---|
| osv-scanner locally via `aiden doctor` | ✔ | every checkpoint; `checkpoint.sh` now fails if doctor skips the scan |
| osv-scanner in CI | **fixed** | `.github/workflows/security.yml`: osv-scanner 2.4.0 (checksum-verified) and `npm audit --audit-level=high` against `package-lock.json`, on push, PR and weekly. No install is needed, so CI needs no private-feed credentials |
| npm audit high/critical | ✔ | 0 vulnerabilities |
| BREAKING.md surfaced by doctor | ✔ | all 7 packages ship one; nothing is pending for 2.0.1. Every 2.0 manual item was checked: roles come from the DB, the 12-character password rule, the register response shape (not used), unverified new users (nothing gates on it), and brand/`PageHeader` (already in the scaffold) |

## 9. AI-specific risks

| Risk | Status | Evidence |
|---|---|---|
| Prompt injection | ✔ | ticket text fenced as untrusted data in the user message, never in the system prompt; closing tags escaped. Probe: 0/18 followed (`injection-probe.md`, re-run in `rerun-2026-10-01/`) |
| System-prompt leakage | ✔ | no free-form "instructions" path; probe checked drafts for prompt phrases: none |
| Data exfiltration via tools | n/a | no tools or URL fetching; the model only gets the ticket |
| Cost runaway: `maxTokens` per route | ✔ | triage 150, draft 700 |
| Cost runaway: alert on per-user spend spikes | **fixed** | the usage sink now raises `ai.spend_alert` (log warning and audit row, amber in the owner's Audit log) once a user's spend in the last hour crosses `AI_SPEND_ALERT_USD_PER_HOUR` (default $1). It fires once per crossing (`screenshots/ui/30-*.png`) |
| PII in logs | ✔ | `AIUsage` stores metadata only (provider, model, tokens, cost, latency); audit metadata never holds ticket text (checked: 0 rows) |

## 11. Pre-PR checklist

| Item | Status |
|---|---|
| Every route in `withAuth` (or signed webhook) | ✔ (two public auth routes, asserted) |
| Every body via `parseRequest` | ✔ |
| Every user-data row through `assertOwnership` | ✔ |
| Role-gated actions call `assertCan` | ✔ |
| No `$executeRawUnsafe` / `eval()` / `dangerouslySetInnerHTML` / `new Function()` | ✔ (`verify.sh`) |
| No server-only imports in `"use client"` files | ✔ (`verify.sh`; now also enforced by `server-only` in `prisma.ts` and `auth.ts`) |
| No hardcoded secrets | ✔ |
| Sensitive log lines redacted or omitted | ✔ |
| `/security-review` run | ✔ `security-review.md`: PASS, no open findings |
| osv-scanner and npm audit after dependency bumps | ✔ 0 / 0 |

## Note: "The destination stream closed early" in server logs

During browser tests the production server occasionally logs this error. It was reproduced in isolation: it appears only when the **client** cancels a page stream mid-response (here, a test navigating away while the login form's post-sign-in `router.refresh()` was still loading). Complete requests never produce it. It is Next logging a client disconnect, not a server fault.
