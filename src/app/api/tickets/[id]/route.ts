import { NextResponse } from "next/server";
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
import { TicketId, UpdateTicketBody } from "@/lib/schemas";
import { classifyTicket } from "@/lib/triage";

type RouteParams = Promise<{ id: string }>;

/** One ticket. Missing, another agent's, or another org's → identical 404. */
export const GET = withAuth<RouteParams>(async (_req, { session, params }) => {
  const { id } = parseInput(TicketId, await params);
  const member = await getMembership(session.user.id);
  const row = toOwnable(
    await prisma.ticket.findFirst({
      where: ticketScope(member, session.user.id, id),
    }),
    session.user.id
  );
  assertOwnership(row, session.user.id);
  assertCan(abilities, orgSession(session, member), "ticket.read", row);

  // Drop the D1 projection field; the real owner is `ownerId`.
  return NextResponse.json({ ticket: { ...row, userId: undefined } });
});

/** Edit subject/body/status; re-triage when the text changes. */
export const PATCH = withAuth<RouteParams>(async (req, { session, params }) => {
  const { id } = parseInput(TicketId, await params);
  const input = await parseRequest(req, UpdateTicketBody);
  const member = await getMembership(session.user.id);
  const row = toOwnable(
    await prisma.ticket.findFirst({
      where: ticketScope(member, session.user.id, id),
    }),
    session.user.id
  );
  assertOwnership(row, session.user.id);
  const scoped = orgSession(session, member);
  assertCan(abilities, scoped, "ticket.update", row);

  const updated = await prisma.ticket.update({ where: { id }, data: input });
  auditLog({
    event: "ticket.update",
    resourceId: id,
    metadata: { fields: Object.keys(input) },
  });

  const triage =
    input.subject !== undefined || input.body !== undefined
      ? await classifyTicket(scoped, updated)
      : null;
  return NextResponse.json({
    ticket: {
      id,
      status: updated.status,
      priority: triage?.priority ?? updated.priority,
      category: triage?.category ?? updated.category,
      sentiment: triage?.sentiment ?? updated.sentiment,
    },
  });
});
