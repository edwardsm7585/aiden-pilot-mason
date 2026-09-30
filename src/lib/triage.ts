import "server-only";
import { z } from "zod";
import type { SecuritySession } from "@upstart13-com/aiden-security";
import { assertCan, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { getAI } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { TriageSchema, type Triage } from "@/lib/schemas";
import { fenceTicket, TRIAGE_SYSTEM } from "@/lib/ticket-prompt";

const TRIAGE_JSON_SCHEMA = z.toJSONSchema(TriageSchema);

/**
 * AI triage (plan §5 `ai.classify`): structured-output call that sets a
 * ticket's priority / category / sentiment.
 *
 * `session` must be the caller's `orgSession(...)`, and `ticket` a row the
 * caller already fetched through the org-scoped query + `assertOwnership`.
 * The model's output is only trusted after `TriageSchema` validation — the
 * Anthropic adapter doesn't enforce `responseSchema`, it just parses text.
 *
 * Never throws for AI failures: ticket writes must succeed without triage.
 * Returns `null` (and audits `ok: false`) when triage is unavailable.
 */
export async function classifyTicket(
  session: SecuritySession,
  ticket: { id: string; subject: string; body: string }
): Promise<Triage | null> {
  assertCan(abilities, session, "ai.classify", ticket);

  let triage: Triage | null = null;
  try {
    const ai = await getAI();
    const res = await ai.complete({
      system: TRIAGE_SYSTEM,
      messages: [{ role: "user", content: fenceTicket(ticket) }],
      responseSchema: TRIAGE_JSON_SCHEMA,
      maxTokens: 150,
    });
    const parsed = TriageSchema.safeParse(res.parsed);
    if (parsed.success) {
      triage = parsed.data;
    } else {
      log.warn({ ticketId: ticket.id }, "ai.classify output failed schema");
    }
  } catch (err) {
    log.error({ err, ticketId: ticket.id }, "ai.classify failed");
  }

  if (triage) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: triage });
  }
  auditLog({
    event: "ai.classify",
    resourceId: ticket.id,
    metadata: triage
      ? { ok: true, priority: triage.priority, category: triage.category }
      : { ok: false },
  });
  return triage;
}
