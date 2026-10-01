import { NextResponse } from "next/server";
import { updateProfileSchema } from "@upstart13-com/aiden-auth";
import { withAuth, parseRequest, auditLog } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import {
  AccountDeletionRefused,
  deleteAccountKeepingOrgData,
  type AccountDeletionRefusal,
} from "@/lib/account-deletion";
import { isSerializationConflict } from "@/lib/db-errors";

export const GET = withAuth(async (_req, { session }) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      accounts: {
        select: { provider: true, providerAccountId: true, type: true },
      },
      roles: { select: { name: true, description: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Derive `hasPassword` from a separate, minimal query so the bcrypt hash
  // is never materialized into the rich `user` object above (avoids
  // widening the blast radius of any future log/serialize of `user`).
  const credentials = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    hasPassword: credentials?.passwordHash != null,
    accounts: user.accounts,
    roles: user.roles,
  });
});

export const PATCH = withAuth(async (req, { session }) => {
  const jsonCheck = requireJson(req);
  if (jsonCheck) return jsonCheck;

  const body = await parseRequest(req, updateProfileSchema);

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: body,
    select: { id: true, name: true, email: true, image: true },
  });

  auditLog({
    event: "user.update",
    actorId: session.user.id,
    resourceId: session.user.id,
    metadata: { fields: Object.keys(body) },
  });

  return NextResponse.json({ ok: true, user });
});

const DELETE_REFUSED: Record<AccountDeletionRefusal, string> = {
  last_owner:
    "You're the only owner of your organisation. Make another member an owner, then delete your account.",
  no_owner_for_tickets:
    "Your tickets have no organisation owner to go to. Ask for an owner to be added, then try again.",
};

// DeskLine: tickets belong to the org, so they are handed to an org owner
// rather than deleted with the user, and the last owner can't leave
// (security finding F3; see src/lib/account-deletion.ts).
export const DELETE = withAuth(async (_req, { session }) => {
  let result;
  try {
    result = await deleteAccountKeepingOrgData(session.user.id);
  } catch (err) {
    if (err instanceof AccountDeletionRefused) {
      return NextResponse.json(
        { error: DELETE_REFUSED[err.reason] },
        { status: 409 }
      );
    }
    if (isSerializationConflict(err)) {
      return NextResponse.json(
        { error: "Your organisation changed while deleting. Try again." },
        { status: 409 }
      );
    }
    log.error({ err }, "account deletion failed");
    throw err;
  }

  if (result.reassignedTickets > 0) {
    auditLog({
      event: "ticket.reassign",
      actorId: session.user.id,
      resourceId: result.reassignedTo ?? undefined,
      metadata: { count: result.reassignedTickets, reason: "account.delete" },
    });
  }
  auditLog({
    event: "user.delete",
    actorId: session.user.id,
    resourceId: session.user.id,
  });

  return new NextResponse(null, { status: 204 });
});

function requireJson(req: Request): NextResponse | null {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  return null;
}
