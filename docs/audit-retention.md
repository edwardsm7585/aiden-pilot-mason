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

## Retention policy

| What                                   | Default                                                                                                                                                                 | Setting                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Audit rows kept in Postgres            | **400 days**: more than the 12-month window SOC 2 evidence typically covers, with a buffer                                                                              | `AUDIT_RETENTION_DAYS`                                      |
| Client IP and user agent on audit rows | Cleared after **180 days**: GDPR storage limitation, while still covering security investigations                                                                       | `AUDIT_PII_DAYS`                                            |
| Rows past retention                    | **Archived, then deleted**: appended to a JSONL file and flushed to disk _before_ deletion, batch by batch, so a crash can duplicate archive lines but never lose a row | `AUDIT_ARCHIVE_DIR` (default `.audit/archive/`, gitignored) |

The defaults are a reasoned starting point. Change them through the settings above, without code changes, if contracts or regulations require something else. `AUDIT_PII_DAYS` may not be longer than `AUDIT_RETENTION_DAYS`; the job refuses that configuration.

### Running it

```bash
npm run audit:retention -- --dry-run   # report what would change
npm run audit:retention                # apply
```

- **Schedule:** run it daily (cron, a platform scheduler, or a CI job with database access). It is idempotent: a second run the same day changes nothing.
- **Order:** IP addresses and user agents are cleared first, so archive files never contain them.
- **Record:** each run writes an `audit.retention_run` audit row with its counts and the archive file name.
- **Archive storage:** ship the files to cold storage (object storage or a warehouse) on whatever schedule your backups use. Alternatively, register a second sink with `setAuditSink()` in `src/lib/audit.ts` so every event is copied there as it happens.

Tested on synthetic rows (3 at 500 days, 4 at 200 days, 2 at 5 days): 7 anonymised, 3 archived and deleted, recent rows untouched, a second run changed nothing, and an invalid configuration was refused (`docs/evidence/limitations-fixes.txt`).

## What is never deleted early

- Nothing else in DeskLine updates or deletes audit rows.
- Rows store ids as plain strings with no foreign keys, so deleting a user, ticket or membership leaves its audit history intact. This was checked in the rollback rehearsal and the account-deletion tests.
- AI cost rows (`ai_usage`) also outlive their user: when an account is deleted, its rows stay with `user_id` set to null, so an org's cost totals don't change.
