import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@upstart13-com/aiden-ui";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { prisma } from "@/lib/prisma";
import { getMembership, orgSession, ticketScope } from "@/lib/tenancy";
import { TicketId } from "@/lib/schemas";
import { formatDate, formatRelative } from "@/lib/format";
import {
  CategoryBadge,
  PriorityBadge,
  SentimentBadge,
  StatusBadge,
} from "@/components/tickets/ticket-badges";
import { TicketActions } from "./ticket-actions";
import { DraftPanel } from "./draft-panel";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/tickets");

  const parsed = TicketId.safeParse(await params);
  if (!parsed.success) notFound();

  const member = await getMembership(session.user.id);
  // Same org-scoped read as the API: another agent's or another org's
  // ticket is indistinguishable from a missing one.
  const ticket = await prisma.ticket.findFirst({
    where: ticketScope(member, session.user.id, parsed.data.id),
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!ticket) notFound();

  const scoped = orgSession(
    { user: { id: session.user.id, roles: [] } },
    member
  );
  const canUpdate = abilities.can(scoped, "ticket.update", ticket);
  const canClose = abilities.can(scoped, "ticket.close", ticket);
  const canDraft = abilities.can(scoped, "ai.draft", ticket);
  const ownerName = ticket.owner.name ?? ticket.owner.email;

  return (
    <div>
      <PageHeader
        title={ticket.subject}
        subtitle={`Opened ${formatDate(ticket.createdAt)} by ${ownerName}, updated ${formatRelative(ticket.updatedAt)}.`}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/tickets">
              <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
              All tickets
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Customer message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground max-w-prose text-sm leading-relaxed whitespace-pre-wrap">
                {ticket.body}
              </p>
            </CardContent>
          </Card>

          {canDraft ? (
            <DraftPanel ticketId={ticket.id} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>AI draft reply</CardTitle>
                <CardDescription>
                  Drafting replies is available to owners and agents. Your
                  role can read this ticket but not draft or edit it.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <aside className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Priority, category, and sentiment come from AI triage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {[
                  { label: "Status", value: <StatusBadge status={ticket.status} /> },
                  { label: "Priority", value: <PriorityBadge priority={ticket.priority} /> },
                  { label: "Category", value: <CategoryBadge category={ticket.category} /> },
                  { label: "Sentiment", value: <SentimentBadge sentiment={ticket.sentiment} /> },
                  { label: "Owner", value: ownerName },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd className="text-foreground truncate text-right text-sm font-medium">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {canUpdate && (
            <TicketActions
              ticket={{
                id: ticket.id,
                subject: ticket.subject,
                body: ticket.body,
                status: ticket.status,
              }}
              canClose={canClose}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
