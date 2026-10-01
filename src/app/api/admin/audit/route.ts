import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { listOrgAudit } from "@/lib/deskline-data";

/**
 * The caller's org audit trail (owner only). The shipped AuditLog has no
 * orgId, so rows are scoped to events whose actor is a member of the
 * caller's org (plan D3).
 */
export const GET = withAuth(async (_req, { session }) => {
  const member = await getMembership(session.user.id);
  assertCan(abilities, orgSession(session, member), "audit.read");

  const rows = await listOrgAudit(member);
  return NextResponse.json({ rows });
});
