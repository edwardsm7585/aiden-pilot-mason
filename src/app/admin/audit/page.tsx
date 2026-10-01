import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import {
  Button,
  Badge,
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
import { listOrgAudit } from "@/lib/deskline-data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Built on the DS Table rather than aiden-ui's AuditLogTable because the
 * owner view needs the request id: it's the key that joins an audit event
 * to the AIUsage row for the same request (the trace).
 */
function eventVariant(event: string) {
  if (event === "security.ownership_failed") return "error" as const;
  if (event.startsWith("security.")) return "warning" as const;
  if (event === "ai.spend_alert") return "warning" as const;
  if (event.startsWith("auth.")) return "success" as const;
  if (event.startsWith("ai.")) return "primary" as const;
  return "secondary" as const;
}

function summarise(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const parts = Object.entries(metadata).map(
    ([k, v]) =>
      `${k}: ${Array.isArray(v) ? v.join(", ") || "none" : String(v)}`
  );
  return parts.length ? parts.join("; ") : "—";
}

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/audit");
  const member = await getMembership(session.user.id);
  const scoped = orgSession({ user: { id: session.user.id, roles: [] } }, member);
  if (!abilities.can(scoped, "audit.read")) redirect("/dashboard/tickets");

  const rows = await listOrgAudit(member);

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Who did what in your organisation, newest first. Shows the latest 200 events."
      />
      <div className="px-6 py-8">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted mb-4 rounded-sm p-3">
              <ScrollText className="text-muted-foreground size-6" strokeWidth={1.5} />
            </div>
            <h2 className="text-base font-semibold">No activity yet</h2>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              Sign-ins, ticket changes, and AI calls by your members will be
              recorded here.
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
                  <TableHead className="text-foreground font-semibold">Time</TableHead>
                  <TableHead className="text-foreground font-semibold">Event</TableHead>
                  <TableHead className="text-foreground font-semibold">Member</TableHead>
                  <TableHead className="text-foreground font-semibold">Resource</TableHead>
                  <TableHead className="text-foreground hidden font-semibold lg:table-cell">
                    Details
                  </TableHead>
                  <TableHead className="text-foreground font-semibold">Request</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDateTime(r.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={eventVariant(r.event)} className="font-mono">
                        {r.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.actorEmail ?? "—"}
                    </TableCell>
                    <TableCell
                      className="max-w-40 truncate font-mono text-xs"
                      title={r.resourceId ?? undefined}
                    >
                      {r.resourceId ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground hidden max-w-72 truncate text-xs lg:table-cell"
                      title={summarise(r.metadata)}
                    >
                      {summarise(r.metadata)}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground max-w-32 truncate font-mono text-xs"
                      title={r.requestId ?? undefined}
                    >
                      {r.requestId ? r.requestId.slice(0, 8) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
