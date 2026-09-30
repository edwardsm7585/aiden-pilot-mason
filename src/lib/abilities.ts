import "server-only";
import { defineAbilities } from "@upstart13-com/aiden-security";
import { ROLES, type OrgRole } from "@/config/rbac";

/**
 * App-wide RBAC rules. Add new actions here; pair role-based rules
 * (`{ roles: [...] }`) with predicate rules (`(session, resource) => boolean`)
 * for resource-level checks.
 *
 * Role and permission strings come from `@/config/rbac` — the single
 * source of truth shared with `prisma/seed.ts` — so renaming a role
 * touches one place and is checked at compile time.
 *
 * DeskLine rules take the caller's org role, supplied per request by
 * `orgSession()` in `@/lib/tenancy` (plan D2). Resource visibility is
 * enforced by the org-scoped query + `assertOwnership`, not here.
 */
const ADMIN = ROLES.find((r) => r.name === "admin")!.name;

const ALL: OrgRole[] = ["owner", "agent", "viewer"];
const WRITERS: OrgRole[] = ["owner", "agent"];
const OWNER: OrgRole[] = ["owner"];

export const abilities = defineAbilities({
  rules: {
    // Starter admin screens (/admin/users) — global admin role.
    "audit.export": { roles: [ADMIN] },
    "users.manage": { roles: [ADMIN] },

    // DeskLine (plan §3 ability matrix).
    "ticket.read": { roles: ALL },
    "ticket.create": { roles: WRITERS },
    "ticket.update": { roles: WRITERS },
    "ticket.close": { roles: WRITERS },
    "ai.draft": { roles: WRITERS },
    "ai.classify": { roles: WRITERS },
    "member.manage": { roles: OWNER },
    "audit.read": { roles: OWNER },
    "usage.read": { roles: OWNER },
  },
});
