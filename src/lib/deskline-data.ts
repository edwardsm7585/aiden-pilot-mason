import "server-only";
import { prisma } from "@/lib/prisma";
import { orgIdOf, ticketScope, type Member } from "@/lib/tenancy";

/**
 * Org-scoped read queries shared by the API routes and the server pages,
 * so the two can't drift. Callers do their own `assertCan` / `abilities.can`
 * first; every query here is already filtered to the caller's org (and to
 * the caller's own tickets for agents), per plan §4 step 1.
 */

export type TicketStatus = "open" | "pending" | "closed";

export function listTickets(
  member: Member | null,
  userId: string,
  status?: TicketStatus
) {
  return prisma.ticket.findMany({
    where: { ...ticketScope(member, userId), ...(status ? { status } : {}) },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      sentiment: true,
      ownerId: true,
      owner: { select: { name: true, email: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function listMembers(member: Member | null) {
  return prisma.membership.findMany({
    where: { orgId: orgIdOf(member) },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Plan D3: AuditLog has no orgId, so scope by the org's member actor ids. */
export async function listOrgAudit(member: Member | null, take = 200) {
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
    take,
  });
  return rows.map((r) => ({
    ...r,
    metadata: (r.metadata ?? null) as Record<string, unknown> | null,
    actorEmail: r.actorId ? (emailById.get(r.actorId) ?? null) : null,
  }));
}

export async function getOrgUsage(member: Member | null) {
  const where = { orgId: orgIdOf(member) };
  const [total, byUser, recent, members] = await Promise.all([
    prisma.aIUsage.aggregate({
      where,
      _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    prisma.aIUsage.groupBy({
      by: ["userId"],
      where,
      _sum: {
        costUsd: true,
        promptTokens: true,
        completionTokens: true,
      },
      _count: true,
    }),
    prisma.aIUsage.findMany({
      where,
      select: {
        id: true,
        userId: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        costUsd: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.membership.findMany({
      where,
      select: { userId: true, user: { select: { email: true } } },
    }),
  ]);
  const emailById = new Map(members.map((m) => [m.userId, m.user.email]));

  return {
    total: {
      calls: total._count,
      costUsd: Number(total._sum.costUsd ?? 0),
      promptTokens: total._sum.promptTokens ?? 0,
      completionTokens: total._sum.completionTokens ?? 0,
    },
    byUser: byUser
      .map((u) => ({
        userId: u.userId,
        email: u.userId ? (emailById.get(u.userId) ?? null) : null,
        calls: u._count,
        tokens: (u._sum.promptTokens ?? 0) + (u._sum.completionTokens ?? 0),
        costUsd: Number(u._sum.costUsd ?? 0),
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    recent: recent.map((r) => ({
      ...r,
      email: r.userId ? (emailById.get(r.userId) ?? null) : null,
      costUsd: Number(r.costUsd),
    })),
  };
}
