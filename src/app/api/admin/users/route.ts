import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { parseInput } from "@/lib/validation";

const MAX_LIMIT = 100;

// Query strings are validated like bodies (plan D5): bad input is a 400,
// not a silently clamped or passed-through value.
const UsersQuery = z.object({
  q: z.string().trim().max(200).default(""),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(25),
});

export const GET = withAuth(async (req, { session }) => {
  // parse → assertCan → read: a global-role ability needs no row, so it is
  // checked before any query (see admin/users/[id]/roles for why).
  const { q, cursor, limit } = parseInput(
    UsersQuery,
    Object.fromEntries(new URL(req.url).searchParams)
  );
  assertCan(abilities, session, "users.manage");

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      roles: { select: { name: true } },
    },
  });

  const hasMore = users.length > limit;
  const rows = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? rows[rows.length - 1]!.id : null;

  return NextResponse.json({ users: rows, nextCursor });
});
