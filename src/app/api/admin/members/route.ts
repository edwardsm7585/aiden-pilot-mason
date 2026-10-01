import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { listMembers } from "@/lib/deskline-data";

/** Members of the caller's org (owner only). */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "member.manage");

  return NextResponse.json({ members: await listMembers(member) });
});
