# Phases 1–6 re-run, 2026-10-01

Every phase was re-verified from scratch on a **new database, `aiden_rerun`**: migrated from empty and seeded, with nothing carried over. The dev database and earlier evidence were not touched. Head at start: `8fb83a3`; security fix `a219a57` landed mid-run (see Phase 6).

| Phase | What was re-run | Result | File |
|---|---|---|---|
| 1 Plan | D1–D7 and §1–7 present; 25 deviations; plan merge `8e79e38` precedes all implementation commits | pass | `phase1.txt` |
| 2 Data | `prisma:merge` leaves the composed schema unchanged; `migrate deploy` from empty; no drift; seed run twice (idempotent: 2 orgs, 7 users, 6 tickets); 4 indexes + 6 `CASCADE` FKs | pass | `phase2.txt` |
| 3 Lib wiring | `tsc` 0, lint 0, `verify.sh` 0 failing checks | pass | `phase3.txt` |
| 4 Routes | smoke **7/7**; extended matrix **37/37** (D1 role scope, D2 role freshness, D3 org audit, D4 no-org, last-owner 409, validation 400s); `AIUsage` row for triage **and** at the end of a streamed draft, attributed to agent1, `request_id` joins the audit rows; 0 audit rows contain ticket text | pass | `phase4.txt` |
| 5 UI | 25 screens across 4 personas, dark, mobile and tablet; create, validation, role change and last-owner refusal flows; 0 page errors (the one console 409 is the expected last-owner refusal) | pass | `ui/` |
| 6 Injection | 3 vectors × (3 triage + 3 drafts): **0/18 followed**; no triage took the injected `urgent`; fence escape leaves exactly one real tag of each kind | pass | `injection-probe.txt`, `injection-probe-raw.json` |
| 6 Switches | one-line model switch (`AIUsage` records `claude-opus-4-6`); kill-switch (201 with null triage, 503 draft, 0 AI calls); `AUDIT_SINK=jsonl` (0 Postgres rows, 1 jsonl line, `.audit/` ignored); every config edit reverted | pass | `switches.txt` |
| 6 Production | `next build` (tree stays clean); `next start`: smoke **7/7**, HSTS + CSP without `unsafe-eval`, generic error bodies | pass | `build.txt`, `prod.txt` |
| 6 Dependencies | `npm audit` 0; `osv-scanner` 2.4.0: no issues; 1 copy of `aiden-logging` | pass | `deps.txt` |
| 6 Rollback | worktree at `cb67bd6` + copy of `aiden_rerun`: generated drop SQL matches the committed one; tables 13 → 9; all 86 audit rows (51 DeskLine events) kept; app boots, DeskLine routes 404; worktree, branch and DB removed | pass | `rollback.txt` |
| Evidence | Prisma Studio: every DeskLine table with all rows in frame, plus the 42-row request trace (audit events joined to `ai_usage` on `request_id`) | captured | `db/` |

## Found and fixed during the re-run

1. **Seed password still exposed (security finding F2a).** The old seed password was still written out in `security-review.md` in this public repo, and `.env.local` still used it. Fixed in `a219a57`:
   - rotated `SEED_PASSWORD` (the new value is not committed) and re-seeded;
   - redacted the report;
   - added a `verify.sh` check that fails if the current value appears in any tracked file.

   The old password now works on 0 of the 7 demo accounts.
2. **The CVE scan could be skipped silently.** `aiden doctor` only warns when `osv-scanner` isn't on PATH, and still exits 0. Two checkpoints earlier today passed without scanning. `checkpoint.sh` now finds a winget-installed `osv-scanner` that isn't on PATH, and fails if the scan is still skipped (`osv-guard-test` in `checkpoints/LOG.md` proves this).
3. **Old harness bugs.** These were fixed in the test scripts only, not in the app:
   - the old sign-in helper still used the removed hard-coded password;
   - the register body needs `fullName` and `confirmPassword`;
   - the token columns are `prompt_tokens` and `completion_tokens`.
