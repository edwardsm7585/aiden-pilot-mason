import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import {
  Button,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { listMembers } from "@/lib/deskline-data";
import type { OrgRole } from "@/config/rbac";
import { RoleSelect } from "./role-select";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/members");
  const member = await getMembership(session.user.id);
  const scoped = orgSession(
    { user: { id: session.user.id, roles: [] } },
    member
  );
  if (!abilities.can(scoped, "member.manage")) redirect("/dashboard/tickets");

  const members = await listMembers(member);
  const userId = session.user.id;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Choose what each person can do. Changes apply on their next request."
      />
      <div className="space-y-8 px-6 py-8">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted mb-4 rounded-sm p-3">
              <Users
                className="text-muted-foreground size-6"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="text-base font-semibold">No members yet</h2>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              People appear here once they join your organisation.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/tickets">Go to tickets</Link>
            </Button>
          </div>
        ) : (
          <div className="border-border overflow-x-auto rounded-sm border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="text-foreground font-semibold">
                    Member
                  </TableHead>
                  <TableHead className="text-foreground w-56 font-semibold">
                    Role
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/50">
                    <TableCell>
                      <p className="font-medium">
                        {m.user.name ?? m.user.email}
                        {m.user.id === userId && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {m.user.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <RoleSelect
                        membershipId={m.id}
                        name={m.user.name ?? m.user.email}
                        role={m.role as OrgRole}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Owners manage members and see audit and cost. Agents work their own
          tickets. Viewers read every ticket. An organisation always keeps at
          least one owner.
        </p>
      </div>
    </div>
  );
}
