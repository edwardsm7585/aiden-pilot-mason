import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { getOrgUsage } from "@/lib/deskline-data";

/** AI spend for the caller's org: totals, per user, and recent calls (owner only). */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "usage.read");

  return NextResponse.json(await getOrgUsage(member));
});
