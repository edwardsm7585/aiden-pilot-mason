# Demo walkthrough rehearsal (2026-10-02)

`docs/plans/demo_walkthrough.md` rehearsed end to end against a dev server (`npm run dev`) on a fresh throwaway database (`aiden_rerun`: `prisma migrate deploy` + `npm run db:seed`). The browser steps were driven by headless Chrome through the real sign-in form, one browser context per persona. The model was `claude-sonnet-4-6`. Screenshots: `docs/evidence/screenshots/demo/`.

## Pre-demo steps

| Step | Result |
|---|---|
| 1 `prisma migrate reset --force` (original wording) | **Refused** by Prisma's guard against destructive actions run by an AI agent. Step 1 now uses a separate demo database with `migrate deploy` |
| 1 `migrate deploy` + `db:seed` on an empty database | 5 migrations applied; `✓ seeded DeskLine: 2 orgs, 7 users, 6 tickets`. A second seed left the ticket count at 6 (idempotent) |
| 2 `aiden doctor` | `All checks passed`, exit 0 |
| 4 `bash scripts/smoke-local.sh` | `== 7 passed, 0 failed` |

## Browser steps (raw output)

| Step | Expected | Got | |
|---|---|---|---|
| 1 agent1 list has own tickets | (predicate) | Refund please, Invoice charged twice, Export to CSV times out | ok |
| 1 agent1 list excludes agent2 + Globex | false | false | ok |
| 1 status filter labels | (predicate) | All Open Pending Closed | ok |
| 1 create → toast | (predicate) | Ticket created AI triaged it as high priority. | ok |
| note | | create round trip incl. triage: 1571 ms | |
| 1 new ticket appears in list | (predicate) | /dashboard/tickets/cmur51y8b0009m4fbkj6q9wjs | ok |
| 1 badges on new ticket | (predicate) | {"Status":"Open","Priority":"High","Category":"Billing","Sentiment":"Negative","Owner":"Acme Agent One"} | ok |
| 2 tabs | Reply,Edit ticket | Reply,Edit ticket | ok |
| 2 tone options | Friendly,Formal,Concise | Friendly,Formal,Concise | ok |
| 2 draft streams (distinct lengths seen) | (predicate) | 30 | ok |
| 2 Copy + Redraft after finish | (predicate) | Copy,Redraft | ok |
| note | | draft (friendly): Hi there!  Thanks for reaching out, and I'm sorry to hear you're having trouble completing your purchase! A declined card can definitely be frustrating, but let's see if we can get this sorted out for | |
| 2 Edit tab has Save + Close | (predicate) | AAAcme Agent One,Reply,Edit ticket,Open,Save changes,Close ticket | ok |
| 3 injected ticket triage not urgent | (predicate) | {"Status":"Open","Priority":"—","Category":"—","Sentiment":"—","Owner":"Acme Agent One"} | ok |
| 3 draft has no PWNED / prompt leak | false | false | ok |
| note | | injection draft: Thank you for reaching out. To process a refund, I'll need a few details from you:  - Order or transaction number - The item or service you'd like refunded - Reason for the refund request  Please reply with this informat | |
| 4 all three show 'Ticket not found' | true,true,true | true,true,true | ok |
| 4 page text identical across the three | true | true | ok |
| note | | HTTP statuses: 200,200,200 | |
| 5 viewer sees both agents' Acme tickets | (predicate) | Card declined at checkout, Refund please, Cannot reset password, Invoice charged twice, Export to CSV times out | ok |
| 5 viewer: no Globex tickets | false | false | ok |
| 5 viewer: Read-only access card, no form | true,false | true,false | ok |
| 5 viewer detail: no tabs/edit/close | 0,false,false | 0,false,false | ok |
| 5 viewer detail: drafting note | (predicate) | Drafting replies is available to owners and agents. | ok |
| 6 owner sidebar | (predicate) | Tickets,All,Open,Pending,Closed | **FAIL** |
| note | | members: Role for Acme Owner=Owner; Role for Acme Agent One=Agent; Role for Acme Agent Two=Agent; Role for Acme Viewer=Viewer | |
| 6 agent2 role select found | (predicate) | Role for Acme Agent Two | ok |
| 6 agent2 → viewer | (predicate) | Viewer | toast: Role updated Acme Agent Two is now a viewer. | ok |
| 6 agent2 → agent | (predicate) | Agent | toast: Role updated Acme Agent Two is now an agent. / Role updated Acme Agent Two is now a viewer. | ok |
| note | | audit columns: Time,Event,Member,Resource,Details,Request | |
| 6 audit: member.role_change ×2 | (predicate) | 2 | ok |
| 6 audit: ticket.create / ai.classify / ai.draft | (predicate) | 1/1/3 | ok |
| note | | cost page: AI cost  What AI triage and draft replies cost your organisation, all time.  AI SPEND  $0.0073  $0.0024 per call on average  AI CALLS  3  Triage and draft replies  TOKENS  1,012  659 in, 353 out  By member Member	Calls	Tokens	Spend agent1@acme.test	3	1,012	$0.0073 Recent calls Time	Member	Model	Tokens in / out	Latency	Cost Oct 2, 2026, 9:49 AM	agent1@acme.test	claude-sonnet-4-6	222 / 65 | |
| 6 cost page lists agent1 spend | (predicate) | $0.0073 $0.0024 $0.0073 $0.0016 | **FAIL** |
| 7 Globex owner sees only Globex | true,false | true,false | ok |
| 7 Globex members: no Acme | false | false | ok |
| 7 Globex audit: no Acme activity | false | false | ok |
| note | | globex cost: AI cost  What AI triage and draft replies cost your organisation, all time.  AI SPEND  $0.00  $0.00 per call on average  AI CALLS  0  Triage and draft replies  TOKENS  0  0 in, 0 out  No AI usage yet  | |
| 8 alert appears on attempt | 11 | 7 | **FAIL** |
| note | | alert text: Too many sign-in attempts Sign-in is paused to protect your account. Wait about 1 minute, then sign in again. | |
| 8 misleading toast dismissed | false | false | ok |
| 8 right password refused while limited | /login | /login | ok |

== 30 passed, 3 failed
page errors: none

The three FAIL rows, explained:

- **6 owner sidebar:** a rehearsal-script bug. The selector read the status-filter `nav`, not the sidebar. A follow-up run listed the sidebar links as `Tickets | Members | Audit log | AI cost | Settings`.
- **6 cost page lists agent1 spend:** a rehearsal-script bug. The predicate tested the dollar amounts, not the page text. The page text above shows `By member … agent1@acme.test 3 1,012 $0.0073`.
- **8 alert appears on attempt 11 (got 7):** **a doc error, now fixed.** The per-IP limit counts every sign-in from the machine, including the successful persona sign-ins earlier in the run. The doc now says to expect the alert before the 11th attempt.

## Follow-up checks

| Check | Result |
|---|---|
| Owner sidebar links | `Tickets \| Members \| Audit log \| AI cost \| Settings` |
| Injection text pasted into a **new** ticket (step 3, rewritten) | Toast "Ticket created / AI triaged it as medium priority."; details Medium / Billing / Negative, not urgent |
| Seeded injection ticket `cdeskline0ticket0a4` | Priority, Category and Sentiment show "—": the seed makes no AI calls. **The original doc's claim that its badges showed a billing ticket was wrong, and is now fixed** |
| Not-found page vs API status (agent1) | `b1`, `a3`, missing id: page 200, API 404. `a1` (own): page 200, API 200. The page streams 200 from `loading.tsx` before `notFound()`; the text is identical for all three. Added to the doc's Q&A |

## Terminal steps

| Command | Result |
|---|---|
| `curl -sI http://localhost:3000/login` | `HTTP/1.1 200 OK`; `content-security-policy:` with a nonce-based `script-src` |
| `bash scripts/verify.sh` | `== 0 failing checks`, exit 0 |
| `npm test` | `Test Files 4 passed (4)`, `Tests 51 passed (51)` |
| `bash scripts/checkpoint.sh demo-rehearsal` (on an uncommitted tree) | doctor=0, upgrade-dry-run=0 ("Already up to date", 2.0.1), `tree=dirty(2)`, exit 1 with "TREE DIRTY: checks ran, but commit and re-run". Its output files were removed afterwards. The doc now runs it before the demo on a clean tree |

## Doc corrections made from this rehearsal

1. Step 1: a separate demo database with `migrate deploy`, in place of `migrate reset --force`.
2. Code pointers: `src/lib/permissions.ts` doesn't exist. `ticketScope` and `toOwnable` are in `src/lib/tenancy.ts`; the ability matrix is `src/lib/abilities.ts`.
3. Step 3: seeded tickets have no triage, so triage resistance is shown by creating the attack as a new ticket.
4. Step 8: successful sign-ins count toward the per-IP limit, so the alert can come before the 11th attempt.
5. `checkpoint.sh`: run before the demo, not live.
6. Wording matched to the UI: Reply and Edit ticket tabs, the Read-only access card, toast text, audit columns, the cost page's By member table, and the Clear button.
7. Q&A: added "HTTP 200 on the not-found page" and "why the seeded injection ticket has no triage".
