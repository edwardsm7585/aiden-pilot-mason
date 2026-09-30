import { NextResponse } from "next/server";
import { createAIStreamResponse } from "@upstart13-com/aiden-realtime";
import {
  withAuth,
  parseRequest,
  assertOwnership,
  assertCan,
  auditLog,
} from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import {
  getMembership,
  orgSession,
  ticketScope,
  toOwnable,
} from "@/lib/tenancy";
import { parseInput } from "@/lib/validation";
import { DraftBody, TicketId } from "@/lib/schemas";
import { AIUnavailableError, getAI } from "@/lib/ai";
import { DRAFT_SYSTEM, fenceTicket } from "@/lib/ticket-prompt";
import { log } from "@/lib/logger";

type RouteParams = Promise<{ id: string }>;

/** Stream an AI-drafted reply to the ticket as SSE (pair with `useAIStream`). */
export const POST = withAuth<RouteParams>(async (req, { session, params }) => {
  const { id } = parseInput(TicketId, await params);
  const input = await parseRequest(req, DraftBody);
  const member = await getMembership(session.user.id);
  const row = toOwnable(
    await prisma.ticket.findFirst({
      where: ticketScope(member, session.user.id, id),
    }),
    session.user.id
  );
  assertOwnership(row, session.user.id);
  // Viewers can see org tickets (ownership passes) but can't draft → 403.
  assertCan(abilities, orgSession(session, member), "ai.draft", row);

  let ai;
  try {
    ai = await getAI();
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
    }
    throw err;
  }

  auditLog({
    event: "ai.draft",
    resourceId: id,
    metadata: { tone: input.tone, provider: ai.provider, model: ai.model },
  });

  const stream = await ai.stream({
    system: DRAFT_SYSTEM,
    messages: [
      { role: "user", content: `Tone: ${input.tone}\n${fenceTicket(row)}` },
    ],
    maxTokens: 700,
  });
  return createAIStreamResponse(stream, {
    signal: req.signal,
    onError: (err) => log.error({ err, ticketId: id }, "ai.draft stream failed"),
  });
});
