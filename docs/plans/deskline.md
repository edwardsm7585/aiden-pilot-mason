# DeskLine — Implementation Plan

**Status:** Awaiting approval · **Target:** AIDEN Certified — Associate (App Engineer)
**Repo:** `edwardsm7585/aiden-pilot-mason` · **Base:** AIDEN starter 2.0.1 (`@upstart13-com/aiden-*` 2.0.1, Next 16.3, Prisma 7.10, zod 4.6)
**Rule:** no implementation code is committed until this plan is approved (see [Approval](#approval)).

DeskLine is a multi-tenant support desk. Each organisation has members with one of three roles. Members work support tickets, get AI triage on every ticket, and can stream an AI-drafted reply. Owners manage member roles and see the org's audit trail and AI spend.

---

## Decisions D1–D7

D1–D4 are the runbook's forced decisions, re-checked against the **installed** 2.0.1 type definitions (`node_modules/@upstart13-com/aiden-*/dist/*.d.ts`). D5–D7 came up during that check.

| # | Decision | Why it's forced | Answer |
|---|---|---|---|
| **D1** | How `assertOwnership(row, userId)` works per role | Smoke suite needs **agent → another agent's ticket = 404** but **viewer → same-org ticket draft = 403**, so viewers must *pass* ownership on org tickets. `Ticket` uses `ownerId`, and `assertOwnership<T extends { userId: string }>` in 2.0.1 has **no owner-key or predicate option**. | **Role-aware query scoping, then a projection.** `ticketScope(member, userId, id)` returns `{ id, orgId, ownerId: userId }` for agents and `{ id, orgId }` for owners/viewers. The fetched row goes through `toOwnable(row, userId)`, which projects it to `{ ...row, userId }` because the query has already applied visibility; `null` stays `null` → `OwnershipError` → 404. |
| **D2** | How `assertCan` knows the org role | Role lives on `Membership`, not the session. `createAuth` merges consumer callbacks **shallowly** (`{ ...defaultCallbacks, ...callbacks }` in `aiden-auth/dist/index.js`), so a custom `jwt`/`session` callback *replaces* the SDK's `token.id`/roles propagation. A JWT-cached role would also stay stale after `member.role_change` until re-login. | **Per-request membership lookup; no auth-callback change.** `getMembership(userId)` (one indexed query) and `orgSession(session, member)` → `{ user: { ...session.user, roles: member ? [member.role] : [] } }`, passed to `assertCan(abilities, orgSession, action, row)`. Role changes take effect on the next request. `src/lib/auth.ts` stays untouched. Assumption: one membership per user, enforced by the seed and by `@@unique([userId])`. |
| **D3** | How the audit viewer is org-scoped | Shipped `AuditLog` has no `orgId`; its actor column is `actorId` (not `userId`). `auditReader.list()` filters by a single user only. | `prisma.auditLog.findMany({ where: { actorId: { in: <userIds of caller's org> } }, orderBy: { timestamp: "desc" }, take: 200 })`. Accepted limitation: events by users who later leave the org drop out of the view (rows persist in the table). |
| **D4** | Caller with no membership (e.g. a freshly self-registered user) | Edge case | `GET /api/tickets` → **200 `{ tickets: [] }`** (empty state, not an error). Any `[id]` route → **404** (query scope matches nothing, and ownership is checked before ability). All other role-gated actions → **403** (`orgSession` has `roles: []`). |
| **D5** | Validating route params and query strings | `parseRequest` reads **only** the JSON body. `withAuth` maps only `RequestValidationError`→400, `OwnershipError`→404, `AbilityError`→403; a raw `ZodError` from `Schema.parse(await params)` would surface as **500**. | Add `parseInput(schema, value)` in `src/lib/validation.ts`: `safeParse`, and on failure `throw new RequestValidationError(error)`, so params/query get the same 400 shape as bodies. Used for `await params` and `Object.fromEntries(new URL(req.url).searchParams)`. Flagged upstream as an SDK gap (a `parseParams`/`parseQuery` helper). |
| **D6** | How the AI provider is chosen ("switch in one line") | aiden-cli 2.0.1's schema requires `ai.providers.*` to be booleans, and doctor requires an API key for every `true` provider. | `aiden.config.ts` → `ai.providers.anthropic: true`, `ai.providers.openai: true` (both keys validated by doctor) plus a new `ai.active: "anthropic"` line. `src/lib/ai.ts` builds **one** client from `ai.active` + `ai.models[active]`. **Switching = changing the `ai.active` line only.** No route edits. |
| **D7** | Audit retention and sink | Audit rows are compliance data | Default sink = shipped Prisma `AuditLog` (starter `src/lib/audit.ts`). `AUDIT_SINK=jsonl` swaps to `.audit/audit.jsonl` (gitignored). Retention and archival are customer-owned; rows are never deleted by DeskLine, including on rollback. |

---

## 1. Outcome

What each person can do once DeskLine ships:

- **Owner** (e.g. `owner@acme.test`)
  - Sees every ticket in their organisation, can open any of them, edit the subject/body/status, and close it.
  - Gets an automatic priority, category, and sentiment on each ticket whenever it's created or its text changes.
  - Can ask for an AI-drafted reply in a chosen tone and watch it appear word by word.
  - Has an **Admin** area: a list of members where they can change anyone's role (the org can never be left without an owner), the organisation's activity log, and a cost page showing total AI spend and spend per person.
- **Agent** (e.g. `agent1@acme.test`)
  - Sees and works **only their own** tickets: create, edit, close, AI triage, AI draft reply.
  - Another agent's ticket, or any ticket from another organisation, behaves exactly as if it doesn't exist.
  - No Admin area.
- **Viewer** (e.g. `viewer@acme.test`)
  - Can browse and open every ticket in their organisation, read-only.
  - Cannot create, edit, close, or draft replies; those buttons are disabled, and the server refuses the action.
  - No Admin area.
- **Anyone**
  - Nothing is visible across organisations.
  - Signed-out visitors are sent to the login page.
  - A newly registered account with no organisation sees an empty ticket list.

---

## 2. Data

New fragments go under `prisma/fragments/`. The composed `prisma/schema.prisma` is regenerated by `npm run prisma:merge` and never hand-edited.

| Fragment | Model | Fields | Relations / indexes |
|---|---|---|---|
| `org.prisma` | `Org` | `id cuid`, `name`, `createdAt` | back-relations `memberships`, `tickets`, `aiUsage` |
| `membership.prisma` | `Membership` | `id cuid`, `orgId`, `userId`, `role String` (`owner`\|`agent`\|`viewer`), `createdAt` | `org → Org onDelete: Cascade`; `user → User onDelete: Cascade`; `@@unique([userId])` (D2: one membership per user; also serves as the `userId` index), `@@index([orgId])` |
| `ticket.prisma` | `Ticket` | `id cuid`, `orgId`, `ownerId`, `subject`, `body`, `status String @default("open")` (`open`\|`pending`\|`closed`), `priority?`, `category?`, `sentiment?`, `createdAt`, `updatedAt @updatedAt` | `org → Org onDelete: Cascade`; `owner → User @relation("TicketOwner") onDelete: Cascade`; `@@index([orgId])`, `@@index([ownerId])`, `@@index([orgId, status])` |
| `aiusage.prisma` | `AIUsage` | `id cuid`, `orgId`, `userId`, `requestId?`, `provider`, `model`, `promptTokens Int`, `completionTokens Int`, `costUsd Decimal @db.Decimal(10,6)`, `latencyMs Int`, `createdAt` | `org → Org onDelete: Cascade`; `user → User onDelete: Cascade`; `@@index([orgId])`, `@@index([userId])`, `@@index([createdAt])` |

- **Changes to `prisma/fragments/user.prisma`:** only back-relations are added to `model User`: `memberships Membership[]`, `tickets Ticket[] @relation("TicketOwner")`, `aiUsage AIUsage[]`. The existing `accounts`, `sessions`, and `roles` stay.
- **`AuditLog` is reused, not redefined.** It ships as `pkg:@upstart13-com/aiden-db/schema/audit.prisma` and is already listed in `aiden-db.config.json`. No `AuditLog` model is added to any fragment.
- **`AIUsage` differs from the runbook sketch.** `AIUsageRecord` in aiden-logging carries `provider`, `model`, tokens, `costUSD`, `latencyMs`, `requestId` and `userId`, but **no route**. So `route` becomes `requestId`, which joins to the `ai.draft`/`ai.classify` audit row for that request. Real FKs replace the sketch's `"unknown"` placeholder, which would have violated them: a usage record for a user with no membership is skipped and logged with `log.warn`.
- **Migration:** `npm run db:migrate -- --name add_deskline_core` produces `prisma/migrations/<ts>_add_deskline_core/`.
- **Seed:** `prisma/seed.ts` is extended and stays idempotent via `upsert`. The starter's RBAC roles/permissions seed is kept.

  | Org | Users (role) | Tickets |
  |---|---|---|
  | Acme | `owner@acme.test` (owner), `agent1@acme.test` (agent), `agent2@acme.test` (agent), `viewer@acme.test` (viewer) | 2 owned by agent1, 1 owned by agent2, 1 **malicious** owned by agent1 |
  | Globex | `owner@globex.test` (owner), `agent@globex.test` (agent), `viewer@globex.test` (viewer) | 2 owned by `agent@globex.test` |

  - Passwords are hashed with `bcryptjs.hash(pw, 12)`, the same library and cost factor `credentialsProvider` verifies with. `aiden-auth` 2.0.1 exports no hash helper.
  - The seed prints `{A_T1, A_T_AGENT2, A_T_MALICIOUS, B_T1}` as JSON for the smoke suite.
  - The malicious ticket body is the runbook's prompt-injection text.

---

## 3. Permissions

**Roles:** exactly three org roles, `owner`, `agent` and `viewer`, added to `src/config/rbac.ts` as `ORG_ROLES`. That file is the starter's single source of truth for role strings, shared with `prisma/seed.ts`.

**Ability matrix** (`src/lib/abilities.ts`, `defineAbilities({ rules })`, role rules only):

| Action | owner | agent | viewer |
|---|:-:|:-:|:-:|
| `ticket.read` | ✓ | ✓ | ✓ |
| `ticket.create` | ✓ | ✓ | – |
| `ticket.update` | ✓ | ✓ | – |
| `ticket.close` | ✓ | ✓ | – |
| `ai.draft` | ✓ | ✓ | – |
| `ai.classify` | ✓ | ✓ | – |
| `member.manage` | ✓ | – | – |
| `audit.read` | ✓ | – | – |
| `usage.read` | ✓ | – | – |

The starter's `audit.export` and `users.manage` rules keep their global `admin` role, and the starter's `/admin/users` screens keep working behind them. `audit.read` moves from `admin` to `owner`, because DeskLine's audit viewer replaces the starter's global one.

**Per route: owner-scoped vs role-gated.** Owner-scoped means the query scope plus `assertOwnership` decide visibility; role-gated means `assertCan` decides:

| Route | Owner-scoped | Role-gated | Why this is the simplest sufficient primitive |
|---|:-:|:-:|---|
| `GET /api/tickets` | ✓ (query) | ✓ `ticket.read` | The list is a query, so scoping filters rows; the ability check blocks role-less callers (after D4's empty-list case). |
| `POST /api/tickets` | – | ✓ `ticket.create` | No existing row; the owner is set to the caller. Only role matters (viewer → 403). |
| `GET /api/tickets/[id]` | ✓ | ✓ `ticket.read` | Visibility differs per role (D1); the ability check is defence-in-depth. |
| `PATCH /api/tickets/[id]` | ✓ | ✓ `ticket.update` | Agents limited to own tickets (scope); viewers see the row but get 403. |
| `POST /api/tickets/[id]/close` | ✓ | ✓ `ticket.close` | Same as PATCH. |
| `POST /api/tickets/[id]/draft` | ✓ | ✓ `ai.draft` | Viewer sees org tickets (passes ownership) and gets 403 on the ability, exactly as smoke #6 requires. |
| `GET /api/admin/members` | ✓ (org filter) | ✓ `member.manage` | Org-scoped list; owner-only. |
| `PATCH /api/admin/members/[id]` | ✓ | ✓ `member.manage` | A member in another org → 404; a non-owner → 403. |
| `GET /api/admin/audit` | ✓ (D3) | ✓ `audit.read` | Org scoping via member `actorId`s. |
| `GET /api/admin/usage` | ✓ (org filter) | ✓ `usage.read` | Org-scoped aggregates. |

**Options rejected as unneeded:**
1. **Separate `ticket.read_own` / `ticket.read_all` abilities.** Query scoping (D1) already encodes the difference; two abilities would duplicate it and could drift.
2. **CASL or other attribute-based ability libraries.** No rule needs conditions beyond role membership. Resource conditions live in the query, and `defineAbilities` role rules suffice.
3. **A fourth `admin` org role.** Roles are frozen at three; owner covers administration.
4. **Predicate ability rules on `orgId`.** They'd duplicate the org filter that every query already applies, and a predicate can't turn a cross-tenant row into a 404.
5. **Putting the role in the JWT via a `createAuth` callback.** Rejected in D2 because of the shallow merge and stale roles.
6. **WebSockets for drafting.** v1 is SSE only (`aiden-realtime`).

---

## 4. Request perimeter

**Canonical order in every route**, nothing skipped or reordered:

`withAuth` → validate (`parseRequest` for body, `parseInput` for params/query, D5) → `getMembership` → org-scoped Prisma read → `assertOwnership` → `assertCan(abilities, orgSession(...), action, row)` → work + `auditLog` → AI → `NextResponse.json` / SSE

**Status codes**, all produced by `withAuth`'s error mapping:
- **401:** no session.
- **400:** `RequestValidationError`.
- **404:** `OwnershipError`, covering missing, not yours, and cross-tenant alike, with an identical body.
- **403:** `AbilityError`.
- **409:** the only hand-rolled status: demoting the last owner.

**Named Zod schemas** in `src/lib/schemas.ts`:
- `TicketId`, `MemberId`: `{ id: z.string().cuid() }`
- `ListTicketsQuery`: `status?` of open/pending/closed
- `CreateTicketBody`: subject 1–200, body 1–10 000
- `UpdateTicketBody`: subject?, body?, `status?` of open/pending, at least one field
- `DraftBody`: tone of friendly/formal/concise, default friendly
- `RoleChangeBody`: role from `ORG_ROLES`
- `TriageSchema`: priority low/medium/high/urgent, category billing/technical/account/feature_request/other, sentiment positive/neutral/negative

| Method · Path | Validation | Checks, in order | 401 | 400 | 404 | 403 |
|---|---|---|:-:|:-:|:-:|:-:|
| `GET /api/tickets` | `ListTicketsQuery` (query) | membership → D4 early `[]` → `assertCan ticket.read` → `findMany where ticketScope(...)` | ✓ | bad `status` | – | – |
| `POST /api/tickets` | `CreateTicketBody` | membership → `assertCan ticket.create` → create (org + owner from session) → audit → classify | ✓ | ✓ | – | viewer / no org |
| `GET /api/tickets/[id]` | `TicketId` (params) | membership → `findFirst ticketScope` → `assertOwnership(toOwnable)` → `assertCan ticket.read` | ✓ | bad id | ✓ | – |
| `PATCH /api/tickets/[id]` | `TicketId` + `UpdateTicketBody` | …ownership → `assertCan ticket.update` → update → audit → reclassify if text changed | ✓ | ✓ | ✓ | viewer |
| `POST /api/tickets/[id]/close` | `TicketId` | …ownership → `assertCan ticket.close` → update status → audit | ✓ | bad id | ✓ | viewer |
| `POST /api/tickets/[id]/draft` | `TicketId` + `DraftBody` | …ownership → `assertCan ai.draft` → audit `ai.draft` → `ai.stream` → `createAIStreamResponse(stream, { signal: req.signal })` | ✓ | ✓ | ✓ | viewer |
| `GET /api/admin/members` | none | membership → `assertCan member.manage` → `findMany where { orgId }` | ✓ | – | – | non-owner |
| `PATCH /api/admin/members/[id]` | `MemberId` + `RoleChangeBody` | membership → `findFirst { id, orgId }` → `assertOwnership(projection)` → `assertCan member.manage` → last-owner guard (409) → update → audit | ✓ | ✓ | ✓ | non-owner |
| `GET /api/admin/audit` | none | membership → `assertCan audit.read` → D3 query | ✓ | – | – | non-owner |
| `GET /api/admin/usage` | none | membership → `assertCan usage.read` → aggregate / groupBy / recent by `orgId` | ✓ | – | – | non-owner |

**Two-step tenant scoping.** Every read of a tenant row takes two independent steps:
1. **Query org-filter.** The Prisma `where` always includes the caller's `orgId`, taken from their `Membership` and never from the request. For agents it also includes `ownerId: session.user.id`. This is done by `ticketScope()` in `src/lib/tenancy.ts`, and by an inline `{ id, orgId }` for memberships. A caller with no membership gets the sentinel org `"__none__"`, which matches nothing.
2. **`assertOwnership` on the result.** A `null` from step 1, whether the row is missing, belongs to another agent, or belongs to another org, throws `OwnershipError`, which becomes the same 404 body every time. Tickets pass through `toOwnable()` first (D1).

`findUnique({ where: { id } })` is never used for tenant data, and there are no inline `userId ===` comparisons. Writes after the check use the id that was already verified.

**Hardening:**
- `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) exports `proxy = securityHeaders({ hsts: <false in dev> })`, which sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and CSP. Note that `securityHeaders` is a factory. The README's `export { securityHeaders as middleware }` would register the factory itself, so it's called explicitly.
- No request body, prompt, or AI output is ever logged.

---

## 5. Audit

Events are emitted with `auditLog()` from `@/lib/security`. `timestamp`, `requestId` and `actorId`/`userId` attach automatically from the request context that `withAuth` opens. Metadata never contains ticket subjects, bodies, prompts or AI output.

| Event | Emitted in | `resourceId` | `metadata` |
|---|---|---|---|
| `ticket.create` | `POST /api/tickets` | ticket id | `{ status }` |
| `ticket.update` | `PATCH /api/tickets/[id]` | ticket id | `{ fields: string[] }` (names only) |
| `ticket.close` | `POST /api/tickets/[id]/close` | ticket id | `{ from: previousStatus }` |
| `ai.draft` | `POST /api/tickets/[id]/draft`, before streaming | ticket id | `{ tone, provider, model }` |
| `ai.classify` | `classifyTicket()` in `src/lib/triage.ts` | ticket id | `{ ok, priority?, category? }`; `ok: false` when the output fails schema validation or the provider errors |
| `member.role_change` | `PATCH /api/admin/members/[id]` | membership id | `{ from, to }` |

**Events emitted automatically by the SDK, which DeskLine relies on:**
- `auth.signin`, `auth.signout`, `auth.register`: from `createAuth` events in aiden-auth.
- `security.ownership_failed`: from `assertOwnership`, covering both the not-found and the mismatch cases.
- `security.ability_denied`, with `{ action, actorRoles }`: from `withAuth` when it catches an `AbilityError`.

---

## 6. Files touched

| File | Change |
|---|---|
| `prisma/fragments/org.prisma` | **new**: `Org` |
| `prisma/fragments/membership.prisma` | **new**: `Membership` |
| `prisma/fragments/ticket.prisma` | **new**: `Ticket` |
| `prisma/fragments/aiusage.prisma` | **new**: `AIUsage` |
| `prisma/fragments/user.prisma` | back-relations only |
| `prisma/schema.prisma` | regenerated by `prisma:merge` (commit message says "merge") |
| `prisma/migrations/*_init/` | **new**: baseline of the starter's own tables (deviation 2) |
| `prisma/migrations/*_add_deskline_core/` | **new**: generated migration |
| `prisma.config.ts` | `migrations.seed` for Prisma 7 (deviation 3) |
| `prisma/seed.ts` | add the orgs, users, memberships and tickets above; keep the RBAC seed |
| `aiden.config.ts` | `ai.providers.anthropic/openai: true`, new `ai.active`, set `ai.models`; set `app.name` to DeskLine (D6) |
| `package.json` / lockfile | add `@anthropic-ai/sdk` and `openai` (optional peers of aiden-ai) and dev dependency `pino-pretty` (needed by the starter logger's dev transport) |
| `src/config/rbac.ts` | add `ORG_ROLES` and the `OrgRole` type |
| `src/config/nav.ts` | add a Tickets nav item and owner-only Admin items (Members, Audit, Cost) |
| `src/lib/validation.ts` | **new**: `parseInput()` (D5) |
| `src/lib/schemas.ts` | **new**: the named Zod schemas above |
| `src/lib/tenancy.ts` | **new**: `getMembership`, `orgSession`, `ticketScope`, `toOwnable`, `NO_ORG` |
| `src/lib/abilities.ts` | add DeskLine rules; move `audit.read` to `owner` |
| `src/lib/ai.ts` | rewrite to one config-driven `createAIClient` call via a memoised `getAI()` (D6) |
| `src/lib/ai-usage.ts` | **new**: `setAIUsageSink` (from aiden-logging) → `AIUsage` row; imported from `instrumentation.ts` |
| `src/lib/triage.ts` | **new**: `classifyTicket()`, structured output + Zod validation |
| `src/lib/audit.ts` | add the `AUDIT_SINK=jsonl` branch (D7) |
| `src/instrumentation.ts` | also import `@/lib/ai-usage` on the Node.js runtime |
| `src/proxy.ts` | **new**: security headers |
| `src/app/api/tickets/route.ts` | **new**: GET, POST |
| `src/app/api/tickets/[id]/route.ts` | **new**: GET, PATCH |
| `src/app/api/tickets/[id]/close/route.ts` | **new**: POST |
| `src/app/api/tickets/[id]/draft/route.ts` | **new**: POST (SSE) |
| `src/app/api/admin/members/route.ts` | **new**: GET |
| `src/app/api/admin/members/[id]/route.ts` | **new**: PATCH |
| `src/app/api/admin/audit/route.ts` | **rewrite**: org-scoped (D3), replacing the starter's global reader |
| `src/app/api/admin/usage/route.ts` | **new**: GET |
| `src/app/api/ai/chat/route.ts`, `src/app/dashboard/chat/page.tsx` | **delete**: starter demo chat. It's an extra AI feature outside the frozen scope, and it depends on the old multi-client `ai.ts`. |
| `src/app/dashboard/layout.tsx` | nav gating by org role via `getMembership` |
| `src/app/dashboard/tickets/page.tsx` | **new**: list, badges, empty state |
| `src/app/dashboard/tickets/new-ticket-form.tsx` | **new**: client form (react-hook-form + zod) |
| `src/app/dashboard/tickets/[id]/page.tsx` | **new**: detail, triage badges, edit/close |
| `src/app/dashboard/tickets/[id]/ticket-actions.tsx` | **new**: client edit/close controls |
| `src/app/dashboard/tickets/[id]/draft-panel.tsx` | **new**: `useAIStream` panel |
| `src/app/admin/layout.tsx` | gate on org `owner` (via `getMembership`) instead of the global `admin` role |
| `src/app/admin/members/page.tsx`, `role-select.tsx` | **new**: members table and role `Select` |
| `src/app/admin/audit/page.tsx` | **rewrite**: org-scoped audit table |
| `src/app/admin/cost/page.tsx` | **new**: metric cards and recent-usage table |
| `scripts/smoke.sh`, `scripts/verify.sh` | **new**: the Phase 6 suites |
| `.gitignore` | add `.audit/` |
| `docs/evidence/**` | checkpoint and verification evidence |
| `README.md` | run, seed logins, provider switch, audit sink, verify |

Ticket pages live under the starter's existing `src/app/dashboard/` segment, so they reuse its auth redirect, `DashboardNav` and `PageHeader` layout. Their URL is `/dashboard/tickets`, not the runbook sketch's `(dashboard)/tickets`.

---

## 7. Rollback

1. **Code:** revert the DeskLine feature commits, or deploy the tag cut before them.
2. **Schema:** delete the four fragments and the `user.prisma` back-relations, run `npm run prisma:merge`, then `npm run db:migrate -- --name drop_deskline_core`. The generated SQL drops `Ticket`, `Membership`, `AIUsage` and `Org`; cascades mean no orphans remain. Rehearsed on a throwaway branch in Phase 6.
3. **AI kill-switch** (no deploy needed): set every `ai.providers.*` to `false`. `classifyTicket` then skips and records `ai.classify { ok: false }`, and the draft route responds 503 "AI unavailable".
4. **Audit sink:** `AUDIT_SINK=jsonl` swaps storage without code changes (D7).
5. **What persists (accepted):** `AuditLog` rows remain after rollback, since it's the shipped table and is untouched by the drop migration. Rows still reference the dropped ticket and membership ids by string. This is intentional: the audit trail outlives the feature.

---

## Pre-UI pre-flight

Must be dated **before** the first UI commit.

| Step | Date | Notes |
|---|---|---|
| `/frontend-design` invoked with the DeskLine brief | | |
| Read `docs/design-system/00-overview.md` | | |
| Read `01-foundations`, `02-components`, `03-forms`, `05-data-display`, `06-navigation`, `07-feedback`, `08-page-layouts` | | |

## AI safety

| Control | Where | Evidence |
|---|---|---|
| Untrusted ticket text fenced in `<ticket>` tags, and the system prompt forbids following it | | |
| Closing-tag escape of `</ticket>` inside untrusted text | | |
| Triage output bounded by `TriageSchema` (enum-only), validated with Zod; no `JSON.parse`/regex in app code | | |
| No prompts, bodies or outputs in logs, audit metadata, or `AIUsage` | | |
| Injection probe against `A_T_MALICIOUS` | | `docs/evidence/injection-probe.md` |

## Deviations log

| # | Date | What happened | Plan said | Resolution | Plan updated |
|---|---|---|---|---|---|
| 1 | 2026-09-30 | PR #1 was closed without review. The candidate merged `plan` into `main` locally and proceeded on the assumption it will be approved. | Implementation starts only after reviewer approval | Merge `8e79e38` records the plan before any implementation commit; reviewer approval is still pending (see Approval) | Yes: Approval section |
| 2 | 2026-09-30 | With no prior migrations, `migrate dev` would have folded the starter's own tables (users, auth, audit, RBAC) into `add_deskline_core` | One migration, `add_deskline_core` | Created a baseline `init` migration from the unmerged starter schema first; `add_deskline_core` has only the 4 DeskLine tables | Yes: §6 |
| 3 | 2026-09-30 | `npm run db:seed` did nothing: Prisma 7 ignores the starter's `package.json` `"prisma.seed"` field | `prisma.config.ts` not in §6 | Added `migrations.seed: "tsx prisma/seed.ts"` to `prisma.config.ts`; recorded in `.claude/fixes/prisma.md` | Yes: §6 |

## Verify-against-plan record

| Dim | Check | Evidence |
|---|---|---|
| Outcome | | |
| Data | | |
| Permissions | | |
| Perimeter | | |
| Audit | | |
| Files | | |
| Rollback | | |

## Approval

| Reviewer | Link | Timestamp (UTC) |
|---|---|---|
| _pending_: plan merged to `main` by the candidate (merge `8e79e38`), approval assumed per candidate instruction | https://github.com/edwardsm7585/aiden-pilot-mason/pull/1 | merged 2026-09-30; reviewer approval not yet recorded |

---

## Appendix — corrections to the runbook sketches (found while checking 2.0.1 types)

These are resolved in the plan above, and listed here so the reviewer can see why the code will differ from the runbook.

| Runbook sketch | Installed 2.0.1 reality | Plan |
|---|---|---|
| `assertCan(session, action, row)` | `assertCan(abilities, session, action, resource?)` | 4-argument form with `orgSession` (D2) |
| `defineAbilities({ owner: {...}, agent: {...} })` | `defineAbilities({ rules: { action: { roles } } })` | §3 matrix encoded as role rules |
| `Schema.parse(await params)` inside `withAuth` → 400 | Raw `ZodError` is rethrown → 500 | `parseInput` (D5) |
| `ai.complete({ responseSchema: ZodSchema, max_tokens })` | `responseSchema` is JSON Schema; option is `maxTokens`; result is `parsed: unknown`; the Anthropic adapter does not enforce the schema, it only parses the text | `responseSchema: z.toJSONSchema(TriageSchema)`, then `TriageSchema.safeParse(res.parsed)`; the prompt also demands JSON |
| `setAIUsageSink` from `aiden-ai` | Exported from `aiden-logging`; the record has no `route` | Import from aiden-logging; `requestId` column instead of `route` |
| `prisma.auditLog.findMany({ where: { userId } })` | Column is `actorId`; ordered by `timestamp` | D3 |
| `export { securityHeaders as middleware }` in `src/middleware.ts` | `securityHeaders()` is a factory; Next 16 uses `src/proxy.ts` | §4 Hardening |
| `export const ai = await createAIClient(...)`, while the starter `ai.ts` has 6 `createAIClient` calls | `verify.sh` requires exactly 1 | One memoised `getAI()` (D6) |
