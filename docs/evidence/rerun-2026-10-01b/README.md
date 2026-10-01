# Phases 0–6 re-run (second pass), 2026-10-01

A full re-verification after today's fixes (F3, F4, F5, the security-guide and design-system passes, and the formatting standard). It ran on code at `d501242`, against a database (`aiden_rerun`) **rebuilt from empty** before each suite that needs a known state. The dev database was not touched.

| Phase | What was re-run | Result | File |
|---|---|---|---|
| 0 Setup | osv-scanner on PATH (2.4.0); public repo in sync with origin; no `.npmrc`; `.env.local` untracked; installed tree matches the lockfile (`npm ls`); `aiden doctor` 5/5 with the CVE scan run | pass | `phase0.txt` |
| 1 Plan | D1–D7, §1–7, 30 deviations; plan merge `8e79e38` precedes all implementation | pass | `phase1.txt` |
| 2 Data | merge leaves the schema unchanged; 3 migrations from empty; no drift; seed idempotent; FKs as designed (`tickets.owner_id` RESTRICT, the rest CASCADE) | pass | `phase2.txt` |
| 3 Gates | tsc 0, lint 0, `verify.sh` 0 failing (now including the DS, CSP, rate-limit, request-context and formatting checks) | pass | `phase3.txt` |
| 4 Routes (dev) | smoke **7/7**; matrix **37/37**; `AIUsage` for triage and at the end of a streamed draft, user-attributed and joined to audit by `request_id`; no ticket text in audit metadata | pass | `phase4.txt` |
| 5 UI (dev) | 30 screens incl. dark, mobile, tablet; create / validation / role-change / last-owner flows; DS runtime **17/17**; 0 page errors (the one console 409 is the expected last-owner refusal) | pass | `phase5.txt`, `ui/` |
| 6 Injection | **0/18** followed; 0 triages took the injected `urgent`; fence escape holds | pass | `injection-probe.txt` |
| 6 Switches | model switch recorded `claude-opus-4-6`; kill-switch 201 + 503, 0 AI calls; `AUDIT_SINK=jsonl` 0 Postgres rows; all edits reverted | pass | `switches.txt` |
| 6 Production | build with 0 static routes; smoke 7/7 + matrix 37/37 on `next start`; nonce CSP + full SDK header set; generic error bodies | pass | `prod.txt`, `build.txt` |
| 6 F4 | sign-in rate limit **12/12** | pass | `f4-signin-rate-limit.txt` |
| 6 F5 | every `<script>` carries the request's nonce; nonce changes per request; 0 CSP violations in normal use; injected-HTML XSS vectors blocked | pass | `f5-csp-nonce.txt` |
| 6 Guide gaps | **18/18** (audit request ids, `auth.register`, admin query validation, spend alert) | pass | `security-guide-gaps.txt` |
| 6 F3 | account deletion **17/17**; forced-overlap race 6/6 rounds end with 1 owner, every conflict a 409 | pass | `f3-account-deletion.txt` |
| 6 DS (prod) | DS runtime **17/17** on the production build | pass | `design-system-runtime.txt` |
| 6 Dependencies | npm audit 0; osv-scanner 0 of 990 packages; 1 `aiden-logging` copy; CI green | pass | `deps.txt` |
| 6 Rollback | worktree at `cb67bd6` + copy of the DB after a real workload; generated drop SQL **identical** to the committed one; tables 13 → 9; all 37 audit rows (10 DeskLine events) kept; app boots, DeskLine routes 404; worktree, branch and DB removed | pass | `rollback.txt` |
| Evidence | Prisma Studio: every table with all rows in frame, plus the request trace (audit events joined to `ai_usage`) | captured | `db/` |

## Test-harness corrections made during this run

None of these are product defects; each was a sequencing or assertion error in the test scripts, fixed and re-run:

1. **Spend-alert actor check:** the check assumed agent2 would be the only user to cross the test threshold. On a server that had already run the Phase 4 harness, agent1 had legitimately crossed it first and got its own alert, as designed. The check now filters on agent2; re-run on a fresh database: 18/18.
2. **Forced-race table:** the first attempt ran after the F3 suite had deleted most Acme members, so each round had only one transaction. That table was discarded, and the test re-run on a fresh seed with the two memberships named explicitly.
3. **DS runtime on production:** the first attempt ran against the F3 suite's leftover state, whose users had been deleted, so it couldn't sign in. Re-run on a fresh database: 17/17.
4. **Sign-in pacing:** suites now pause 61 s between bursts of sign-ins, because sign-in is rate-limited to 10 per minute per address (F4). The limit is working as intended, so the tests wait instead of loosening it.
