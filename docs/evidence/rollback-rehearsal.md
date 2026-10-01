# Rollback rehearsal (plan §7), 2026-10-01

Run on a **throwaway branch** (`rollback-rehearsal`, a separate git worktree, never pushed, deleted afterwards) against a **copy** of the dev database (`aiden_rollback`, cloned from `aiden_dev` with `createdb -T`, dropped afterwards). `main` and the dev data were not touched.

## Steps

1. **Code:** restored `src/`, `prisma/fragments/` and `aiden.config.ts` to `cb67bd6`, the last commit before DeskLine code. This removes the 4 fragments, the `user.prisma` back-relations, and all DeskLine routes, pages and lib modules.
2. **Schema:** `npm run prisma:merge`, then generated the drop migration.
   - `prisma migrate dev --name drop_deskline_core` **refuses to run non-interactively** when it would drop tables holding data ("You are about to drop the `tickets` table, which is not empty (14 rows)"). That's a useful guard.
   - Used the deploy-safe path instead: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → `prisma/migrations/<ts>_drop_deskline_core/migration.sql`, then `prisma migrate deploy`.
   - The SQL (`rollback-drop-migration.sql`) drops the 6 DeskLine foreign keys and exactly 4 tables: `ai_usage`, `memberships`, `orgs`, `tickets`. It doesn't touch `audit_logs` or any starter table.
   - The first deploy attempt failed safely: dotenv's "◇ injected env" banner had gone to stdout into line 1 of the SQL, Postgres rejected it at position 1, and nothing applied. Recovered the standard way (strip the line, `prisma migrate resolve --rolled-back`, deploy again).
3. **Boot:** ran the rolled-back app on port 3100 against `aiden_rollback`.

## Results

| Check | Before | After |
|---|---|---|
| Public tables | 14 | **10** |
| DeskLine tables (`orgs`, `memberships`, `tickets`, `ai_usage`) | present | **none** |
| `audit_logs` rows | 121 | **121** (persist, as planned) |
| of which DeskLine events (`ticket.*`, `ai.*`, `member.role_change`) | 63 | **63** |
| `users` | 8 | 8 |
| `POST /api/auth/callback/credentials` (owner@acme.test) | | 302, session valid (`/api/me` 200) |
| `/login`, `/dashboard` | | **200, 200** (app boots; starter home) |
| `/dashboard/tickets`, `/api/tickets`, `/admin/members` | | **404, 404, 404** (feature gone) |

**Accepted, as the plan states:** audit rows outlive the feature, and still reference dropped ticket and membership ids by string.

*Rehearsal-only note:* the worktree shared `node_modules` through a directory junction. Turbopack rejects a `node_modules` link that points outside the project root, so the rehearsal booted with `next dev --webpack`. A real rollback deploys from a normal checkout, where this doesn't arise.
