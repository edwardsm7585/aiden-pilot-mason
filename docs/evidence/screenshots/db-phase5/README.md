# Database after Phase 5 — Prisma Studio (2026-10-01)

| File | Shows |
|---|---|
| `01-tickets.png` | 9 tickets: the 6 seeded ones now AI-triaged, plus tickets created through the API and the UI form |
| `02-ai_usage.png` | 12 AI calls (triage + drafts), each attributed to a user and org with tokens and cost |
| `03-audit_logs.png` | All 68 audit rows, including the browser-driven `ticket.create`, `ai.draft`, and `member.role_change` events |
| `04-memberships.png` | Roles back to seeded values after the role-change demo |
| `05-trace-requests-audit-plus-ai-usage.png` | 21-row request trace (audit events joined to `ai_usage` on `request_id`): seed triage pairs (`ticket.update` → `ai.classify`), browser drafts, and the form-created ticket |
