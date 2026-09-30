import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { getMembership, orgIdOf, orgSession } from "@/lib/tenancy";

/** AI spend for the caller's org: totals, per user, and recent calls (owner only). */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "usage.read");

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
      _sum: { costUsd: true },
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

  return NextResponse.json({
    total: {
      calls: total._count,
      costUsd: Number(total._sum.costUsd ?? 0),
      promptTokens: total._sum.promptTokens ?? 0,
      completionTokens: total._sum.completionTokens ?? 0,
    },
    byUser: byUser.map((u) => ({
      userId: u.userId,
      email: emailById.get(u.userId) ?? null,
      calls: u._count,
      costUsd: Number(u._sum.costUsd ?? 0),
    })),
    recent: recent.map((r) => ({
      ...r,
      email: emailById.get(r.userId) ?? null,
      costUsd: Number(r.costUsd),
    })),
  });
});
