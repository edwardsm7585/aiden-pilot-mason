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
3. `npm run prisma:generate` composes `prisma/fragments/*.prisma` into `prisma/schema.prisma` (`aiden-db-merge-schema`) and generates the Prisma client. `npm install` already runs this through `postinstall`; running it again is harmless and doesn't depend on the hook.
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

Retention and archival are customer-owned (D7). DeskLine's policy: keep audit rows for 400 days, clear IP addresses and user agents after 180, then archive to JSONL and delete. Run it with `npm run audit:retention` (add `-- --dry-run` to preview), daily. All three settings are configurable. Nothing else deletes audit rows, including account deletion and feature rollback. Details: [`docs/audit-retention.md`](docs/audit-retention.md).

## Verify

| Command                                                      | What it does                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash scripts/smoke-local.sh`                                | Signs in the seeded agent and viewer with `SEED_PASSWORD`, then runs the graded perimeter suite (`scripts/smoke.sh`, 7 probes). Needs a running server and a fresh seed                  |
| `bash scripts/smoke.sh`                                      | Same suite, with cookies and ids exported by hand (see the script header)                                                                                                                |
| `bash scripts/verify.sh`                                     | Convention and security sweep, including perimeter, no-ship sinks, secrets, design-system rules, CSP, formatting and schema drift. Named exceptions E1–E4 are asserted, not just skipped |
| `bash scripts/checkpoint.sh <label>`                         | `aiden doctor` plus `aiden upgrade --dry-run`. It never skips either check, and it fails on a skipped CVE scan or a dirty tree. History is in `docs/evidence/checkpoints/LOG.md`         |
| `npm test`                                                   | 51 unit tests (Vitest): permission matrix, two-step tenant scoping, prompt-injection fencing, input schemas, client IP, conflict detection, log redaction                                |
| `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .` | Type check, lint and formatting                                                                                                                                                          |
| CI: `.github/workflows/security.yml`                         | osv-scanner and `npm audit` on every push and pull request, and weekly                                                                                                                   |

## Evidence

| Where                                                                                    | What                                                                                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/evidence/fresh-clone-walkthrough.txt`](docs/evidence/fresh-clone-walkthrough.txt) | **This README followed literally on a fresh clone from GitHub**: install, migrate, seed, doctor, run, smoke 7/7, verify 0 failing |
| [`docs/evidence/rerun-2026-10-01b/`](docs/evidence/rerun-2026-10-01b/README.md)          | **Latest full re-run of Phases 0–6**, every suite on fresh databases                                                              |
| [`docs/evidence/security-review.md`](docs/evidence/security-review.md)                   | `/security-review`: findings F1–F5, each fixed and verified. Verdict: PASS, no open findings                                      |
| [`docs/evidence/security-guide-checklist.md`](docs/evidence/security-guide-checklist.md) | Every section of the AIDEN security guide against the code                                                                        |
| [`docs/evidence/design-system-checklist.md`](docs/evidence/design-system-checklist.md)   | Every design-system rule against the UI                                                                                           |
| [`docs/evidence/injection-probe.md`](docs/evidence/injection-probe.md)                   | Formal prompt-injection probe: 0 of 18 calls followed                                                                             |
| [`docs/evidence/rollback-rehearsal.md`](docs/evidence/rollback-rehearsal.md)             | Rollback (plan §7) rehearsed on a throwaway branch and database                                                                   |
| `docs/evidence/screenshots/`                                                             | UI for every persona, plus Prisma Studio tables and request traces per phase                                                      |
| `docs/evidence/checkpoints/`                                                             | Every `aiden doctor` and upgrade dry-run, with a note explaining any non-green run                                                |

## Production settings

| Setting                                                       | Default                        | What it does                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRUSTED_PROXY_HOPS`                                          | `1`                            | How many trusted proxies append to `X-Forwarded-For`. The rate limiter keys on the address your outermost trusted proxy saw, never on client-supplied entries |
| `RATE_LIMIT_STORE`                                            | `postgres`                     | Sign-in and registration limits are shared by every instance and survive restarts; `memory` is for throwaway single-instance runs                             |
| `AI_SPEND_ALERT_USD_PER_HOUR`                                 | `1`                            | Raises `ai.spend_alert` (log + audit row) when one user's AI spend in an hour crosses it                                                                      |
| `AUDIT_RETENTION_DAYS`, `AUDIT_PII_DAYS`, `AUDIT_ARCHIVE_DIR` | `400`, `180`, `.audit/archive` | Audit retention: run `npm run audit:retention` daily ([policy](docs/audit-retention.md))                                                                      |
| `AUTH_URL` or `AUTH_TRUST_HOST`                               | unset                          | Required by Auth.js in production                                                                                                                             |

## Submission documents

| Document                                                     | What it covers                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`docs/plans/deskline.md`](docs/plans/deskline.md)           | Plan (D1–D7, §1–7), pre-UI pre-flight, AI safety, deviations log, verify record, approval       |
| [`docs/ops-diagnosis.md`](docs/ops-diagnosis.md)             | Upgrade dry-run steps, no-op reasons, recovery runbook, request-context diagnosis, doctor → fix |
| [`docs/self-assessment.md`](docs/self-assessment.md)         | M12 readiness bars and the rubric self-score                                                    |
| [`docs/acceptance-matrix.md`](docs/acceptance-matrix.md)     | Every Spec §4 acceptance criterion with evidence                                                |
| [`docs/audit-retention.md`](docs/audit-retention.md)         | Audit retention, anonymisation and archival policy                                              |
| [`docs/upstream-sdk-issues.md`](docs/upstream-sdk-issues.md) | 20 SDK and starter defects found, with workarounds and proposed fixes                           |

## Reference docs

AIDEN package references (Confluence): [aiden-security](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3082321922/aiden-security) · [aiden-ai](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3082518531/aiden-ai) · [structured output](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3082092577/4.8+Use+structured+output+tool+calls+with+aiden-ai) · [aiden-realtime](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3083108353/aiden-realtime) · [aiden-logging](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3083010049/aiden-logging) · [aiden-db](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3082977281/aiden-db) · [aiden-ui](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3083075585/aiden-ui) · [aiden-auth](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3082518558/aiden-auth) · [aiden-cli](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3081830403/aiden-cli)

Capstone: [project brief](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3137404929/AIDEN+Capstone+Project+Brief+Specification) · [rubric](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3137437697/AIDEN+Certification+Assessment+Rubric+Scoring) · [submission checklist](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3137470465/AIDEN+Capstone+Candidate+Handbook+Submission+Checklist) · [M12 self-assessment](https://upstart13.atlassian.net/wiki/spaces/IP/pages/3102474241/Module+12+Self-Assessment+Resources)

## Known limitations

- **Plan approval:** the reviewer's sign-off on PR #1 is pending. The plan was merged by the candidate, as the plan's Approval section records.
- **SDK defects:** 20 SDK and starter defects are worked around locally ([`docs/upstream-sdk-issues.md`](docs/upstream-sdk-issues.md)). Fixing them belongs upstream, for example a native rate-limit message in the SDK's `LoginForm`.
