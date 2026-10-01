# Database after Phase 6 verification — Prisma Studio (2026-10-01)

| File | Shows |
|---|---|
| `01-tickets.png` | 14 tickets, including the injection-probe tickets V2 (fence break) and V3 (output-format injection), the model-switch check, and the kill-switch check (triage left empty, as designed) |
| `02-ai_usage.png` | 35 AI calls, including the two `claude-opus-4-6` rows from the one-line model switch; no rows for the kill-switch request |
| `03-audit_logs.png` | All 121 audit rows (last row confirmed in frame), including `ai.classify {ok:false}` from the kill-switch run |
| `04-memberships.png` | Roles at seeded values |
| `05-trace-requests-audit-plus-ai-usage.png` | 55-row request trace (audit events joined to `ai_usage` on `request_id`), covering the 18 injection-probe calls and the model switch (model column changes to `claude-opus-4-6`) |

The `AUDIT_SINK=jsonl` test request is deliberately absent from `audit_logs`: its events went to `.audit/audit.jsonl` (see `../../audit-sink-jsonl.txt`).
