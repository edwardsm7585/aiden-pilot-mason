import { NextResponse } from "next/server";
import { withAuth, parseRequest, assertCan, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { getMembership, orgSession } from "@/lib/tenancy";
import { listTickets } from "@/lib/deskline-data";
import { parseInput } from "@/lib/validation";
import { CreateTicketBody, ListTicketsQuery } from "@/lib/schemas";
import { classifyTicket } from "@/lib/triage";

/** List tickets visible to the caller (org-wide, or own tickets for agents). */
export const GET = withAuth(async (req, { session }) => {
  const query = parseInput(
    ListTicketsQuery,
    Object.fromEntries(new URL(req.url).searchParams)
  );
  const member = await getMembership(session.user.id);
  // D4: no org yet (e.g. just registered) → empty state, not an error.
  if (!member) return NextResponse.json({ tickets: [] });
  assertCan(abilities, orgSession(session, member), "ticket.read");

  // Org-scoped (own tickets only for agents) via ticketScope in listTickets.
  const tickets = await listTickets(member, session.user.id, query.status);
  return NextResponse.json({ tickets });
});

/** Create a ticket owned by the caller in their org, then AI-triage it. */
export const POST = withAuth(async (req, { session }) => {
  const input = await parseRequest(req, CreateTicketBody);
  const member = await getMembership(session.user.id);
  const scoped = orgSession(session, member);
  // Viewers and callers without a membership are denied here (403).
  assertCan(abilities, scoped, "ticket.create");

  const ticket = await prisma.ticket.create({
    data: { ...input, orgId: member!.orgId, ownerId: session.user.id },
  });
  auditLog({
    event: "ticket.create",
    resourceId: ticket.id,
    metadata: { status: ticket.status },
  });

  const triage = await classifyTicket(scoped, ticket);
  return NextResponse.json(
    {
      ticket: {
        id: ticket.id,
        status: ticket.status,
        priority: triage?.priority ?? null,
        category: triage?.category ?? null,
        sentiment: triage?.sentiment ?? null,
      },
    },
    { status: 201 }
  );
});
