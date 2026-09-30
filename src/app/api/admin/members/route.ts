import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { getMembership, orgIdOf, orgSession } from "@/lib/tenancy";

/** Members of the caller's org (owner only). */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "member.manage");

  const members = await prisma.membership.findMany({
    where: { orgId: orgIdOf(member) },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ members });
});
