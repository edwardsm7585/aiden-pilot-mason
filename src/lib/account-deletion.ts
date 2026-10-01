import "server-only";
import { deleteUserAccount } from "@upstart13-com/aiden-auth";
import { prisma } from "@/lib/prisma";

/**
 * Self-service account deletion that keeps DeskLine's org invariants
 * (security finding F3):
 * - tickets belong to the org, so the user's tickets are handed to another
 *   org owner before the user is deleted (`Ticket.owner` is `Restrict`);
 * - the org must keep at least one owner, so a sole owner is refused.
 *
 * Runs as one Serializable transaction, so two owners deleting themselves
 * at the same moment can't both pass the "another owner exists" check.
 */

export type AccountDeletionRefusal = "last_owner" | "no_owner_for_tickets";

export class AccountDeletionRefused extends Error {
  constructor(readonly reason: AccountDeletionRefusal) {
    super(reason);
  }
}

export type AccountDeletionResult = {
  reassignedTickets: number;
  reassignedTo: string | null;
};

export async function deleteAccountKeepingOrgData(
  userId: string
): Promise<AccountDeletionResult> {
  return prisma.$transaction(
    async (tx) => {
      const member = await tx.membership.findUnique({
        where: { userId },
        select: { orgId: true, role: true },
      });
      const heir = member
        ? await tx.membership.findFirst({
            where: {
              orgId: member.orgId,
              role: "owner",
              userId: { not: userId },
            },
            orderBy: { createdAt: "asc" },
            select: { userId: true },
          })
        : null;

      if (member?.role === "owner" && !heir) {
        throw new AccountDeletionRefused("last_owner");
      }

      const owned = await tx.ticket.count({ where: { ownerId: userId } });
      let reassignedTickets = 0;
      if (owned > 0) {
        // Tickets can only go to an owner of the org they belong to.
        if (!member || !heir) {
          throw new AccountDeletionRefused("no_owner_for_tickets");
        }
        const moved = await tx.ticket.updateMany({
          where: { ownerId: userId, orgId: member.orgId },
          data: { ownerId: heir.userId },
        });
        reassignedTickets = moved.count;
        if (moved.count !== owned) {
          throw new AccountDeletionRefused("no_owner_for_tickets");
        }
      }

      await deleteUserAccount(tx, userId);
      return {
        reassignedTickets,
        reassignedTo: reassignedTickets > 0 ? heir!.userId : null,
      };
    },
    { isolationLevel: "Serializable" }
  );
}
