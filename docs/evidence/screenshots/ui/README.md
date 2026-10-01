# DeskLine UI — Phase 5 (2026-10-01, dev server, real sessions)

Captured with headless Chrome using real credential sign-ins (`authjs.session-token`) for each persona. Viewport 1440 wide unless noted. Browser console: 0 errors on every page, except the expected 409 in `24`.

| File | Persona | Shows |
|---|---|---|
| `01-login.png` | signed out | `LoginForm` from aiden-auth |
| `02-agent-tickets.png` | agent1 | Own tickets only; status/priority/category badges; New ticket form (the one primary CTA) |
| `03-owner-tickets-all-org.png` | owner | Whole org, Owner column |
| `04-viewer-tickets-read-only.png` | viewer | Whole org; the form is replaced by a read-only explanation |
| `05-agent-filter-empty-state.png` | agent1 | Status filter with a complete empty state |
| `06-agent-ticket-detail.png` | agent1 | Customer message, AI draft panel, details, edit form |
| `07-draft-streaming.png` | agent1 | Draft mid-stream: violet caret, tone locked, "Drafting…" |
| `08-draft-done.png` | agent1 | Finished plain-text draft; model footnote, Copy / Clear / Redraft |
| `09-viewer-ticket-read-only.png` | viewer | Detail without draft or edit, with the reason stated |
| `10-agent-other-agents-ticket-404.png` | agent1 | agent2's ticket → the same "doesn't exist or isn't shared with you" page |
| `11-owner-members.png` | owner | Members with role Select |
| `12-owner-audit-log.png` | owner | Org-scoped audit trail: event, member, resource, details, request id |
| `13-owner-ai-cost.png` | owner | Spend / calls / tokens, per member, recent calls |
| `14-agent-admin-redirected.png` | agent1 | `/admin/members` redirects to tickets |
| `15`–`17` (`dark-*`) | owner / agent1 | Dark theme on list, detail, and cost |
| `18-mobile-tickets.png`, `18b-mobile-owner-tickets.png`, `19-mobile-ticket-detail.png` | agent1 / owner | 390 px: mobile header with theme toggle; table trims to Subject / Status / Priority |
| `20-tablet-tickets.png` | owner | 820 px |
| `21-agent-created-ticket-toast.png` | agent1 | Created through the form → "Ticket created. AI triaged it as high priority." |
| `22-form-validation.png` | agent1 | Inline field errors on empty submit |
| `23-owner-role-changed-toast.png` | owner | Viewer → agent via Select, toast (reverted afterwards) |
| `24-owner-last-owner-refused.png` | owner | Demoting the last owner → 409 explained; the Select reverts to Owner |
| `25-delete-account-dialog.png` | owner | Delete-account dialog: says tickets you own move to an org owner (F3 fix) |
| `26-sole-owner-delete-refused.png` | owner | Sole owner tries to delete their account → 409; the toast gives the reason and the next step (F3 fix) |

DB state and request traces after these runs: `../db-phase5/`.
