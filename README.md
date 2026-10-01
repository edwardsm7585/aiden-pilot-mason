# DeskLine — aiden-pilot-mason

Repo: https://github.com/edwardsm7585/aiden-pilot-mason
Scaffolded with `npx @upstart13-com/aiden-cli init aiden-pilot-mason` (first commit, `cb9cd15`, unmodified).

DeskLine is a multi-tenant support desk built on the AIDEN SDK (`@upstart13-com/aiden-*` 2.0.1) for the AIDEN Certified — Associate capstone. Agents log customer tickets, AI triages each one (priority, category, sentiment), and agents stream an AI draft reply. Owners manage member roles and see their organisation's audit log and AI cost. Every organisation's data is isolated from every other.

The approved plan, decisions D1–D7 and all 30 recorded deviations are in [`docs/plans/deskline.md`](docs/plans/deskline.md).

## Run

Needs Node 24, PostgreSQL 16 and `osv-scanner` on PATH (`aiden doctor` runs it).

1. `cp .env.example .env.local`, then set:
   - `DATABASE_URL`;
   - `AUTH_SECRET` (`openssl rand -base64 32`);
   - `ANTHROPIC_API_KEY`;
   - `SEED_PASSWORD` (12+ characters; the password for every demo account).

   No `OPENAI_API_KEY` is needed: only Anthropic is enabled (deviation 19).

2. `npm install`
3. `npx aiden-db-merge-schema` composes `prisma/fragments/*.prisma` into `prisma/schema.prisma`.
4. Apply migrations:
   - **Dev:** `npm run db:migrate`.
   - **CI or production:** `npx @upstart13-com/aiden-cli migrate` (wraps `prisma migrate deploy`).
   - **On Windows, use `npx prisma migrate deploy` instead.** `aiden migrate` 2.0.1 can't start `npx` there, but still exits 0 having done nothing ([upstream issue 16](docs/upstream-sdk-issues.md)).
5. `npm run db:seed` creates the two demo organisations and prints the ticket ids the smoke suite uses.
6. `npx @upstart13-com/aiden-cli doctor` should exit 0 with all 5 checks green, including the CVE scan.
7. `npm run dev`, then open http://localhost:3000.

For production, run `npm run build && npm start` and set `AUTH_URL` (or `AUTH_TRUST_HOST=true` behind a trusted proxy). Auth.js rejects untrusted hosts in production.

## Seeded logins

The password for every account is the `SEED_PASSWORD` you set in `.env.local`. It is never committed. The seed refuses a password shorter than 12 characters and skips demo accounts when `NODE_ENV=production`.

| Email                | Organisation | Role   | Can                                                                  |
| -------------------- | ------------ | ------ | -------------------------------------------------------------------- |
| `owner@acme.test`    | Acme         | owner  | everything in Acme: all tickets, drafts, Members, Audit log, AI cost |
| `agent1@acme.test`   | Acme         | agent  | create, edit, close and draft replies for **their own** tickets      |
| `agent2@acme.test`   | Acme         | agent  | same, for their own tickets (agent1's tickets are a 404)             |
| `viewer@acme.test`   | Acme         | viewer | read every Acme ticket; no create, edit, close or draft              |
| `owner@globex.test`  | Globex       | owner  | everything in Globex; nothing in Acme                                |
| `agent@globex.test`  | Globex       | agent  | their own Globex tickets                                             |
| `viewer@globex.test` | Globex       | viewer | read Globex tickets                                                  |

Ticket `cdeskline0ticket0a4` contains a prompt-injection attempt, kept for the injection probe.

## Switch AI provider

Change **one line** in `aiden.config.ts`: `ai.active` (line 92). `src/lib/ai.ts` builds the single client from `ai.active` and `ai.models[active]`, so no route changes are needed. Restart the server afterwards.

- The target provider must also be enabled (`ai.providers.<name>: true`, lines 84–89) with its API key set, because `aiden doctor` checks for the key. Only Anthropic is enabled today, so a switch to OpenAI also flips line 84 and adds `OPENAI_API_KEY`.
- **Model switch:** `ai.models.anthropic` (line 96), proven in `docs/evidence/provider-switch.md`.
- **AI kill-switch:** set `ai.providers.anthropic: false` (line 85). Tickets still save, without triage, and drafts return 503.

## Audit sink

`AUDIT_SINK=jsonl npm run dev` writes audit events to `.audit/audit.jsonl` (gitignored) instead of the `audit_logs` table. To send them somewhere else, register a sink with `setAuditSink()` in `src/lib/audit.ts`.

Retention and archival are customer-owned (D7). By default, `AuditLog` rows stay in Postgres indefinitely, and no DeskLine code deletes them, including on account deletion and feature rollback. Details and the open owner decision: [`docs/audit-retention.md`](docs/audit-retention.md).

## Verify

| Command                                                      | What it does                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash scripts/smoke-local.sh`                                | Signs in the seeded agent and viewer with `SEED_PASSWORD`, then runs the graded perimeter suite (`scripts/smoke.sh`, 7 probes). Needs a running server and a fresh seed                  |
| `bash scripts/smoke.sh`                                      | Same suite, with cookies and ids exported by hand (see the script header)                                                                                                                |
| `bash scripts/verify.sh`                                     | Convention and security sweep, including perimeter, no-ship sinks, secrets, design-system rules, CSP, formatting and schema drift. Named exceptions E1–E4 are asserted, not just skipped |
| `bash scripts/checkpoint.sh <label>`                         | `aiden doctor` plus `aiden upgrade --dry-run`. It never skips either check, and it fails on a skipped CVE scan or a dirty tree. History is in `docs/evidence/checkpoints/LOG.md`         |
| `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .` | Type check, lint and formatting                                                                                                                                                          |
| CI: `.github/workflows/security.yml`                         | osv-scanner and `npm audit` on every push and pull request, and weekly                                                                                                                   |

## Evidence

| Where                                                                                    | What                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`docs/evidence/rerun-2026-10-01b/`](docs/evidence/rerun-2026-10-01b/README.md)          | **Latest full re-run of Phases 0–6**, every suite on fresh databases                         |
| [`docs/evidence/security-review.md`](docs/evidence/security-review.md)                   | `/security-review`: findings F1–F5, each fixed and verified. Verdict: PASS, no open findings |
| [`docs/evidence/security-guide-checklist.md`](docs/evidence/security-guide-checklist.md) | Every section of the AIDEN security guide against the code                                   |
| [`docs/evidence/design-system-checklist.md`](docs/evidence/design-system-checklist.md)   | Every design-system rule against the UI                                                      |
| [`docs/evidence/injection-probe.md`](docs/evidence/injection-probe.md)                   | Formal prompt-injection probe: 0 of 18 calls followed                                        |
| [`docs/evidence/rollback-rehearsal.md`](docs/evidence/rollback-rehearsal.md)             | Rollback (plan §7) rehearsed on a throwaway branch and database                              |
| `docs/evidence/screenshots/`                                                             | UI for every persona, plus Prisma Studio tables and request traces per phase                 |
| `docs/evidence/checkpoints/`                                                             | Every `aiden doctor` and upgrade dry-run, with a note explaining any non-green run           |

## Known limitations

- **Generic sign-in message:** when sign-in is rate-limited, the SDK's `LoginForm` still says "Invalid email or password". It ignores the error code and can't be changed without forking the SDK; a fix is proposed upstream.
- **Rate-limit scope:** the per-address limits trust `X-Forwarded-For`, so deploy behind a proxy that sets it. The limit store is in memory, per instance; use a shared `RateLimitStore` when running several instances.
- **Account deletion and AI cost:** deleting an account hands its tickets to an org owner, but deletes that person's AI cost rows.
- **Open decisions:** the audit retention period is the owner's call, and the reviewer's sign-off on the plan (PR #1) is pending.
- **SDK and starter defects:** 16 found during the build are listed with workarounds and proposed fixes in [`docs/upstream-sdk-issues.md`](docs/upstream-sdk-issues.md).
