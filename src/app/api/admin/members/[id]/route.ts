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
  orgIdOf,
  orgSession,
  toOwnable,
} from "@/lib/tenancy";
import { parseInput } from "@/lib/validation";
import { MemberId, RoleChangeBody } from "@/lib/schemas";

type RouteParams = Promise<{ id: string }>;

/** Change a member's org role (owner only). The org must keep one owner. */
export const PATCH = withAuth<RouteParams>(async (req, { session, params }) => {
  const { id } = parseInput(MemberId, await params);
  const input = await parseRequest(req, RoleChangeBody);
  const member = await getMembership(session.user.id);
  // Org-scoped read: a membership in another org is a 404, same as missing.
  const row = toOwnable(
    await prisma.membership.findFirst({
      where: { id, orgId: orgIdOf(member) },
    }),
    session.user.id
  );
  assertOwnership(row, session.user.id);
  assertCan(abilities, orgSession(session, member), "member.manage", row);

  if (row.role === "owner" && input.role !== "owner") {
    const owners = await prisma.membership.count({
      where: { orgId: row.orgId, role: "owner" },
    });
    if (owners <= 1) {
      return NextResponse.json(
        { error: "The organisation must keep at least one owner" },
        { status: 409 }
      );
    }
  }

  await prisma.membership.update({
    where: { id },
    data: { role: input.role },
  });
  auditLog({
    event: "member.role_change",
    resourceId: id,
    metadata: { from: row.role, to: input.role },
  });
  return NextResponse.json({ ok: true });
});
