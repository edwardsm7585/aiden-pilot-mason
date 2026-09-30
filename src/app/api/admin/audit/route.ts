import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { getMembership, orgIdOf, orgSession } from "@/lib/tenancy";

const LIMIT = 200;

/**
 * The caller's org audit trail (owner only). The shipped AuditLog has no
 * orgId, so rows are scoped to events whose actor is a member of the
 * caller's org (plan D3).
 */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "audit.read");

  const members = await prisma.membership.findMany({
    where: { orgId: orgIdOf(member) },
    select: { userId: true, user: { select: { email: true } } },
  });
  const emailById = new Map(members.map((m) => [m.userId, m.user.email]));

  const rows = await prisma.auditLog.findMany({
    where: { actorId: { in: [...emailById.keys()] } },
    select: {
      id: true,
      event: true,
      actorId: true,
      resourceId: true,
      metadata: true,
      requestId: true,
      timestamp: true,
    },
    orderBy: { timestamp: "desc" },
    take: LIMIT,
  });

  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      actorEmail: r.actorId ? (emailById.get(r.actorId) ?? null) : null,
    })),
  });
});
