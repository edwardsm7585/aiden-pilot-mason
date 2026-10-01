import { NextResponse } from "next/server";
import { withAuth, assertOwnership, assertCan, auditLog } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import {
  getMembership,
  orgSession,
  ticketScope,
  toOwnable,
} from "@/lib/tenancy";
import { parseInput } from "@/lib/validation";
import { TicketId } from "@/lib/schemas";

type RouteParams = Promise<{ id: string }>;

/** Close a ticket. */
export const POST = withAuth<RouteParams>(async (_req, { session, params }) => {
  const { id } = parseInput(TicketId, await params);
  const member = await getMembership(session.user.id);
  const row = toOwnable(
    await prisma.ticket.findFirst({
      where: ticketScope(member, session.user.id, id),
    }),
    session.user.id
  );
  assertOwnership(row, session.user.id);
  assertCan(abilities, orgSession(session, member), "ticket.close", row);

  await prisma.ticket.update({ where: { id }, data: { status: "closed" } });
  auditLog({
    event: "ticket.close",
    resourceId: id,
    metadata: { from: row.status },
  });
  return NextResponse.json({ ok: true });
});
