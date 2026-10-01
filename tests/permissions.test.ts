import { describe, expect, it, vi } from "vitest";
import {
  AbilityError,
  OwnershipError,
  assertCan,
  assertOwnership,
  type SecuritySession,
} from "@upstart13-com/aiden-security";

// tenancy.ts imports the Prisma client; these tests only use its pure helpers.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { abilities } = await import("@/lib/abilities");
const { NO_ORG, orgIdOf, orgSession, ticketScope, toOwnable } =
  await import("@/lib/tenancy");

const session = (roles: string[] = []): SecuritySession => ({
  user: { id: "user_1", roles },
});
const as = (role: "owner" | "agent" | "viewer" | null) =>
  orgSession(session(["admin"]), role ? { orgId: "org_a", role } : null);

describe("ability matrix (plan §3)", () => {
  // action → [owner, agent, viewer]
  const MATRIX: Record<string, [boolean, boolean, boolean]> = {
    "ticket.read": [true, true, true],
    "ticket.create": [true, true, false],
    "ticket.update": [true, true, false],
    "ticket.close": [true, true, false],
    "ai.draft": [true, true, false],
    "ai.classify": [true, true, false],
    "member.manage": [true, false, false],
    "audit.read": [true, false, false],
    "usage.read": [true, false, false],
  };
  for (const [action, [owner, agent, viewer]] of Object.entries(MATRIX)) {
    it(`${action}: owner ${owner}, agent ${agent}, viewer ${viewer}`, () => {
      expect(abilities.can(as("owner"), action)).toBe(owner);
      expect(abilities.can(as("agent"), action)).toBe(agent);
      expect(abilities.can(as("viewer"), action)).toBe(viewer);
    });
  }

  it("a user with no membership can do nothing (D4)", () => {
    for (const action of Object.keys(MATRIX)) {
      expect(abilities.can(as(null), action)).toBe(false);
    }
  });

  it("assertCan throws AbilityError (→ 403) for a viewer drafting", () => {
    expect(() => assertCan(abilities, as("viewer"), "ai.draft")).toThrow(
      AbilityError
    );
  });
});

describe("orgSession (D2)", () => {
  it("replaces global roles with the org role, so admin can't leak into org checks", () => {
    expect(as("viewer").user.roles).toEqual(["viewer"]);
    expect(abilities.can(as("viewer"), "member.manage")).toBe(false);
  });
  it("gives no roles without a membership", () => {
    expect(as(null).user.roles).toEqual([]);
  });
  it("keeps global admin abilities on the raw session only", () => {
    expect(abilities.can(session(["admin"]), "users.manage")).toBe(true);
    expect(abilities.can(as("owner"), "users.manage")).toBe(false);
  });
});

describe("two-step tenant scoping (plan §4, D1)", () => {
  it("agents are limited to their own tickets in their org", () => {
    expect(
      ticketScope({ orgId: "org_a", role: "agent" }, "user_1", "t1")
    ).toEqual({ orgId: "org_a", id: "t1", ownerId: "user_1" });
  });
  it("owners and viewers see the whole org", () => {
    for (const role of ["owner", "viewer"] as const) {
      expect(ticketScope({ orgId: "org_a", role }, "user_1")).toEqual({
        orgId: "org_a",
      });
    }
  });
  it("no membership scopes to a sentinel org that matches nothing (D4)", () => {
    expect(orgIdOf(null)).toBe(NO_ORG);
    expect(ticketScope(null, "user_1", "t1")).toEqual({
      orgId: NO_ORG,
      id: "t1",
    });
  });
  it("a scoped miss (missing, other org, other agent) becomes OwnershipError (→ 404)", () => {
    expect(() => assertOwnership(toOwnable(null, "user_1"), "user_1")).toThrow(
      OwnershipError
    );
  });
  it("a row the scoped query returned passes step 2", () => {
    const row = toOwnable({ id: "t1", ownerId: "someone_else" }, "user_1");
    expect(() => assertOwnership(row, "user_1")).not.toThrow();
  });
});
