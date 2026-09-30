import "server-only";
import type { SecuritySession } from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { ORG_ROLES, type OrgRole } from "@/config/rbac";

/** The caller's org and role, read from `Membership` on every request (plan D2). */
export type Member = { orgId: string; role: OrgRole };

/**
 * Sentinel org id for callers with no membership (plan D4). No row has it,
 * so every org-filtered query matches nothing → empty list / 404.
 */
export const NO_ORG = "__none__";

/** One membership per user (`@@unique([userId])`), so this is a unique lookup. */
export async function getMembership(userId: string): Promise<Member | null> {
  const m = await prisma.membership.findUnique({
    where: { userId },
    select: { orgId: true, role: true },
  });
  if (!m || !isOrgRole(m.role)) return null;
  return { orgId: m.orgId, role: m.role };
}

/**
 * The session `assertCan` should see: the caller's org role replaces the
 * global starter roles, so DeskLine abilities are always evaluated against
 * the current Membership, and a role change applies on the next request.
 */
export function orgSession(
  session: SecuritySession,
  member: Member | null
): SecuritySession {
  return {
    user: { ...session.user, roles: member ? [member.role] : [] },
  };
}

/** The caller's org id for query filters, or the no-match sentinel. */
export function orgIdOf(member: Member | null): string {
  return member?.orgId ?? NO_ORG;
}

/**
 * Step 1 of two-step tenant scoping (plan §4, D1): the ticket `where` for
 * this caller. Always filtered to their org; agents are further limited to
 * tickets they own. Owners and viewers see the whole org.
 */
export function ticketScope(
  member: Member | null,
  userId: string,
  id?: string
): { orgId: string; ownerId?: string; id?: string } {
  const base = { orgId: orgIdOf(member), ...(id ? { id } : {}) };
  return member?.role === "agent" ? { ...base, ownerId: userId } : base;
}

/**
 * Step 2 input (plan D1): project a row the scoped query already returned
 * onto the `{ userId }` shape `assertOwnership` checks. The query applied
 * visibility, so any returned row is visible to the caller; `null` stays
 * `null` and `assertOwnership` turns it into a 404.
 */
export function toOwnable<T extends object>(
  row: T | null,
  userId: string
): (T & { userId: string }) | null {
  return row ? { ...row, userId } : null;
}

function isOrgRole(role: string): role is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(role);
}
