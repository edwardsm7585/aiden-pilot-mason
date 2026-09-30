# Phase 4 — route verification (2026-09-30, dev server, seeded data)

Sessions from real credentials sign-ins (`authjs.session-token`). Status codes only unless noted.

## Graded smoke suite — `scripts/smoke.sh` → `smoke.txt`
7/7 pass: 401 · 400 · 404 (cross-tenant) · 404 (IDOR, same org) · 404 (missing) · 403 (viewer draft) · identical 404 bodies.

## Extended perimeter (plan §4 table)

| Check | Expected | Got |
|---|---|---|
| `GET /api/tickets/not-a-cuid` (param validation, D5) | 400 | 400 |
| `GET /api/tickets?status=bogus` (query validation, D5) | 400 | 400 |
| viewer `POST /api/tickets` | 403 | 403 |
| viewer `PATCH` / `close` org ticket | 403 / 403 | 403 / 403 |
| viewer / owner `GET` another member's ticket (D1) | 200 / 200 | 200 / 200 |
| agent2 `GET` agent1's ticket; Globex agent `GET` Acme ticket | 404 / 404 | 404 / 404 |
| list sizes: agent1 · agent2 · viewer · owner · Globex agent | own 4 · own 1 · org 5 · org 5 · 2 | 4 · 1 · 5 · 5 · 2 |
| agent1 `PATCH {status}` own · `PATCH {}` · `PATCH {status:"closed"}` | 200 · 400 · 400 | 200 · 400 · 400 |
| agent1 `close` own | 200 | 200 |
| draft `{tone:"angry"}` · agent2 draft on agent1's ticket | 400 · 404 | 400 · 404 |
| agent1 `members` · viewer `audit` · agent1 `usage` | 403 · 403 · 403 | 403 · 403 · 403 |
| owner `members` | 4 rows | 4 |
| owner viewer→agent, then ex-viewer creates **with the same session** (D2 freshness) | 200, 201 | 200, 201 |
| owner reverts agent→viewer | 200 | 200 |
| owner demotes the last owner (themself) | 409 | 409 |
| owner `PATCH` a Globex membership id | 404 | 404 |
| owner `PATCH {role:"admin"}` | 400 | 400 |
| owner `audit`: every row's actor is an `@acme.test` member (D3) | true | true |
| no-membership user (fresh register): list · `[id]` · create · `members` (D4) | 200 `[]` · 404 · 403 · 403 | 200 `[]` · 404 · 403 · 403 |

## AI + usage sink

| Check | Result |
|---|---|
| `POST /api/tickets` → 201 with triage | `urgent / technical / negative`, `claude-sonnet-4-6` |
| `AIUsage` row for the **non-streaming** triage call | written: agent1@acme.test, Acme, 246 in / 21 out, $0.001053, `request_id` = the `ticket.create` + `ai.classify` audit rows' |
| `POST /api/tickets/{A_T1}/draft` (SSE) | 200 `text/event-stream`, 86 `data:` frames, 1 `event: done`, 0 errors → `sse-draft.txt` |
| `AIUsage` row reported **at the end of the stream** | written and attributed to agent1@acme.test (203 out, $0.003495); `request_id` = the `ai.draft` audit row's → request context survives the stream; no "usage skipped" warnings |

## Audit trail for one ticket (metadata as stored)
`ticket.create {status:"open"}` → `ai.classify {ok:true, priority:"urgent", category:"technical"}` → `ticket.update {fields:["status"]}` (status-only edit, no re-triage) → `ticket.close {from:"pending"}`.
Owner audit view contained: `ai.classify, ai.draft, auth.signin, member.role_change, security.ability_denied, security.ownership_failed, ticket.close, ticket.create, ticket.update`.
