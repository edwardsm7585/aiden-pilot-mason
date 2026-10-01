# Audit log: retention and archival

The AIDEN SDK leaves audit retention and archival to the app (decision D7). This page records what DeskLine does today and the one decision the owner still has to make.

## What is recorded

| Source                     | Events                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sign-in and accounts       | `auth.signin`, `auth.signout`, `auth.register`, `user.update`, `password.change`, `data.export`, `user.delete`         |
| Access control (automatic) | `security.ownership_failed` (a 404 for something that isn't yours), `security.ability_denied` (a 403)                  |
| Tickets                    | `ticket.create`, `ticket.update`, `ticket.close`, `ticket.reassign` (when an account is deleted)                       |
| AI                         | `ai.classify`, `ai.draft`, `ai.spend_alert` (a user's AI spend crossed `AI_SPEND_ALERT_USD_PER_HOUR` in the last hour) |
| Administration             | `member.role_change`, `roles.assign`                                                                                   |

Each row stores the event name, who did it (`actor_id`), what it was about (`resource_id`), a request id that joins the row to its log lines and `ai_usage` rows, the client IP and user agent, a timestamp, and small metadata such as `{ status }` or `{ fields }`. **Ticket text, prompts and AI output are never stored in audit rows.**

## Where it is stored

- **Default:** the `audit_logs` table in Postgres (the `AuditLog` model shipped by `aiden-db`).
- **`AUDIT_SINK=jsonl`:** appends to `.audit/audit.jsonl` on the server instead (gitignored). For local testing only: the file isn't shared between instances or backed up.
- **Elsewhere (warehouse, SIEM):** register a sink with `setAuditSink()` in `src/lib/audit.ts`; nothing else changes.

## Who can read it

- **Org owners:** see their own organisation's events at **Audit log** (`/admin/audit`), newest 200. Rows are matched to the org through its members.
- **Platform admins:** hold the starter's `audit.export` permission, but no export screen or endpoint ships yet. Today an export is a database query.

## How long it is kept (current behaviour)

- **Indefinitely.** No DeskLine code updates or deletes an audit row.
- **Rows outlive what they describe.** They store ids as plain strings with no foreign keys, so deleting a user, ticket or membership leaves its audit history intact. This was checked in the rollback rehearsal and the account-deletion tests.
- **No archival job.** The table grows until someone acts on it.

Related: AI cost rows (`ai_usage`) are deleted with the user they belong to, so an org's cost totals drop when a member deletes their account. The audit rows for those calls remain.

## Decision needed (owner)

Set and record:

1. **Retention period** for `audit_logs` (for example, 1 year in Postgres). Base it on contracts and regulations, such as SOC 2 evidence windows and GDPR storage limitation.
2. **Archival target and method.** For example, a `setAuditSink` that also writes to object storage or a warehouse, or a scheduled export followed by a delete of rows past the retention period.
3. **Personal data:** the IP address, user agent and actor id are personal data. Decide whether they are kept for the full period or anonymised earlier.

Until those are decided, the policy is: **keep everything, archive nothing, delete nothing.**
