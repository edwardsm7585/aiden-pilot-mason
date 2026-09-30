# Database snapshots — Prisma Studio (2026-09-30, after Phase 4 verification)

Captured from `npx prisma studio` against the local dev database, after the seed and the Phase 4 route checks (`../../phase4-route-checks.md`).

| File | Shows |
|---|---|
| `00-schema-visualizer.png` | All 14 tables and their foreign keys (DeskLine: `orgs`, `memberships`, `tickets`, `ai_usage`) |
| `01-orgs.png` | Acme, Globex |
| `02-memberships.png` | One membership per user (D2), with roles |
| `03-users.png` | 7 seeded users + `noorg@example.test` (D4 check). `password_hash` = bcrypt of the documented dev seed password |
| `04-tickets.png` | 6 seeded tickets (incl. the injection probe) + 2 created during checks, with AI triage |
| `05-ai_usage.png` | One row per AI call: user, org, model, tokens, cost, `request_id` |
| `06-audit_logs.png` | All 37 audit rows: `ticket.*`, `ai.*`, `member.role_change`, and SDK auto-events (`auth.signin`, `security.ownership_failed`, `security.ability_denied`) |
| `07-roles.png`, `08-permissions.png`, `09-RolePermissions.png`, `10-UserRoles.png` | Starter RBAC tables (global `admin`/`member`; unused by DeskLine) |
| `11-accounts.png`, `12-sessions.png`, `13-verification_tokens.png` | NextAuth tables: empty (JWT sessions, credentials only) |
| `14-prisma_migrations.png` | `init` + `add_deskline_core` |
| `15-trace-requests-audit-plus-ai-usage.png` | Request traces: audit events joined to `ai_usage` on `request_id`. Three requests end to end: ticket create → triage, a streamed draft, and the role-change check's create → triage |
