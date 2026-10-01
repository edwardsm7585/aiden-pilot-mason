import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Plus, UserRoundX } from "lucide-react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { listTickets, type TicketStatus } from "@/lib/deskline-data";
import { ListTicketsQuery } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/format";
import {
  CategoryBadge,
  PriorityBadge,
  StatusBadge,
} from "@/components/tickets/ticket-badges";
import { NewTicketForm } from "./new-ticket-form";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; status?: TicketStatus }[] = [
  { label: "All" },
  { label: "Open", status: "open" },
  { label: "Pending", status: "pending" },
  { label: "Closed", status: "closed" },
];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/tickets");

  const parsed = ListTicketsQuery.safeParse(await searchParams);
  const status = parsed.success ? parsed.data.status : undefined;

  const member = await getMembership(session.user.id);
  if (!member) return <NoOrganisation />;

  const scoped = orgSession(
    { user: { id: session.user.id, roles: [] } },
    member
  );
  const canCreate = abilities.can(scoped, "ticket.create");
  const [tickets, org] = await Promise.all([
    listTickets(member, session.user.id, status),
    prisma.org.findUnique({
      where: { id: member.orgId },
      select: { name: true },
    }),
  ]);
  const showOwner = member.role !== "agent";

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={
          member.role === "agent"
            ? `Tickets you own in ${org?.name ?? "your organisation"}.`
            : `All tickets in ${org?.name ?? "your organisation"}.`
        }
      />

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-4" aria-label="Ticket list">
          <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
            {FILTERS.map((f) => {
              const active = f.status === status;
              return (
                <Link
                  key={f.label}
                  href={
                    f.status
                      ? `/dashboard/tickets?status=${f.status}`
                      : "/dashboard/tickets"
                  }
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </nav>

          {tickets.length === 0 ? (
            <EmptyTickets status={status} canCreate={canCreate} />
          ) : (
            <div className="border-border overflow-x-auto rounded-sm border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="text-foreground font-semibold">
                      Subject
                    </TableHead>
                    {showOwner && (
                      <TableHead className="text-foreground hidden font-semibold md:table-cell">
                        Owner
                      </TableHead>
                    )}
                    <TableHead className="text-foreground font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="text-foreground font-semibold">
                      Priority
                    </TableHead>
                    <TableHead className="text-foreground hidden font-semibold sm:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="text-foreground hidden text-right font-semibold sm:table-cell">
                      Updated
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="max-w-36 sm:max-w-72">
                        <Link
                          href={`/dashboard/tickets/${t.id}`}
                          className="focus-visible:ring-ring block truncate rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {t.subject}
                        </Link>
                      </TableCell>
                      {showOwner && (
                        <TableCell className="text-muted-foreground hidden truncate md:table-cell">
                          {t.owner.name ?? t.owner.email}
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <CategoryBadge category={t.category} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                        {formatRelative(t.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <aside>
          {canCreate ? (
            <NewTicketForm />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Read-only access</CardTitle>
                <CardDescription>
                  Viewers can read every ticket in the organisation but can’t
                  create, edit, or draft replies. Ask an owner if you need to
                  work tickets.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function EmptyTickets({
  status,
  canCreate,
}: {
  status?: TicketStatus;
  canCreate: boolean;
}) {
  return (
    <div className="border-border flex flex-col items-center justify-center rounded-sm border py-16 text-center">
      <div className="bg-muted mb-4 rounded-sm p-3">
        <Inbox className="text-muted-foreground size-6" strokeWidth={1.5} />
      </div>
      {status ? (
        <>
          <h2 className="text-base font-semibold">No {status} tickets</h2>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            Nothing matches this filter right now.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/dashboard/tickets">Show all tickets</Link>
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold">No tickets yet</h2>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            {canCreate
              ? "Log the first customer request and AI will triage it."
              : "Tickets will appear here as your team logs them."}
          </p>
          {canCreate && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <a href="#new-ticket">
                <Plus className="mr-2 size-4" strokeWidth={1.5} />
                Write a ticket
              </a>
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function NoOrganisation() {
  return (
    <div>
      <PageHeader title="Tickets" subtitle="You’re not in an organisation yet." />
      <div className="px-6 py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-muted mb-4 rounded-sm p-3">
            <UserRoundX
              className="text-muted-foreground size-6"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="text-base font-semibold">No organisation access</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Your account isn’t a member of any organisation, so there are no
            tickets to show. Ask an organisation owner to add you.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/dashboard/settings/profile">View your profile</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
