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
import { getMembership, orgIdOf, orgSession, toOwnable } from "@/lib/tenancy";
import { parseInput } from "@/lib/validation";
import { isSerializationConflict } from "@/lib/db-errors";
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

  // Count and update in one Serializable transaction, so two owners demoting
  // each other at the same moment can't both pass the check (finding F3).
  let kept: boolean;
  try {
    kept = await prisma.$transaction(
      async (tx) => {
        if (row.role === "owner" && input.role !== "owner") {
          const owners = await tx.membership.count({
            where: { orgId: row.orgId, role: "owner" },
          });
          if (owners <= 1) return false;
        }
        await tx.membership.update({
          where: { id },
          data: { role: input.role },
        });
        return true;
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    if (!isSerializationConflict(err)) throw err;
    return NextResponse.json(
      { error: "Roles changed at the same time. Reload and try again." },
      { status: 409 }
    );
  }
  if (!kept) {
    return NextResponse.json(
      { error: "The organisation must keep at least one owner" },
      { status: 409 }
    );
  }
  auditLog({
    event: "member.role_change",
    resourceId: id,
    metadata: { from: row.role, to: input.role },
  });
  return NextResponse.json({ ok: true });
});
