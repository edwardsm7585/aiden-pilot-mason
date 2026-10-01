# AI switch proofs (Phase 6.3), 2026-10-01

No `OPENAI_API_KEY` is available, so a second *provider* can't be called. The same mechanism is shown by switching the **model** with one line; switching provider is the same one-line edit to `ai.active` (plan D6), with no edits to `src/lib/ai.ts` or any route.

## 1. One-line model switch (`provider-switch.diff`)

```diff
-      anthropic: "claude-sonnet-4-6",
+      anthropic: "claude-opus-4-6",
```

Restarted, then created a ticket (triage) and drafted a reply. `AIUsage` (newest first; `event` joined from `audit_logs` on `request_id`):

| time | model | in | out | cost USD | event |
|---|---|---|---|---|---|
| 00:14:55 | claude-opus-4-6 | 207 | 128 | 0.012705 | ai.draft |
| 00:14:50 | claude-opus-4-6 | 237 | 16 | 0.004755 | ai.classify |
| 00:13:41 | claude-sonnet-4-6 | 217 | 60 | 0.001551 | ai.draft |
| 00:13:39 | claude-sonnet-4-6 | 216 | 154 | 0.002958 | ai.draft |

Rows 1-2 ran on the switched model with its own pricing; rows 3-4 are the previous model. Reverted afterwards (`git diff` empty).

## 2. AI kill-switch (plan §7) (`kill-switch.diff`)

```diff
-      anthropic: true,
+      anthropic: false,
```

| Check | Result |
|---|---|
| `POST /api/tickets` | **201**, triage fields `null`; the ticket is still saved |
| audit | `ticket.create {status:"open"}` then `ai.classify {ok:false}` |
| `POST /api/tickets/{A_T2}/draft` | **503** `{"error":"AI unavailable"}` |
| `AIUsage` rows added | **0** (no provider calls) |
| `aiden doctor` | green; required vars drop to 2 (no AI key needed while disabled) |

Reverted afterwards (`git diff` empty).
