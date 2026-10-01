import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import {
  Button,
  Card,
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
import { getOrgUsage } from "@/lib/deskline-data";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/cost");
  const member = await getMembership(session.user.id);
  const scoped = orgSession(
    { user: { id: session.user.id, roles: [] } },
    member
  );
  if (!abilities.can(scoped, "usage.read")) redirect("/dashboard/tickets");

  const { total, byUser, recent } = await getOrgUsage(member);
  const tokens = total.promptTokens + total.completionTokens;
  const perCall = total.calls ? total.costUsd / total.calls : 0;

  const metrics = [
    {
      label: "AI spend",
      value: formatUsd(total.costUsd),
      note: `${formatUsd(perCall)} per call on average`,
    },
    {
      label: "AI calls",
      value: formatNumber(total.calls),
      note: "Triage and draft replies",
    },
    {
      label: "Tokens",
      value: formatNumber(tokens),
      note: `${formatNumber(total.promptTokens)} in, ${formatNumber(total.completionTokens)} out`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="AI cost"
        subtitle="What AI triage and draft replies cost your organisation, all time."
      />
      <div className="space-y-8 px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label} className="p-5 shadow-none">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                {m.label}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{m.value}</p>
              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                {m.note}
              </p>
            </Card>
          ))}
        </div>

        {total.calls === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted mb-4 rounded-sm p-3">
              <Receipt
                className="text-muted-foreground size-6"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="text-base font-semibold">No AI usage yet</h2>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              Spend appears here after the first ticket is triaged or a reply is
              drafted.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/tickets">Go to tickets</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">By member</h2>
              <div className="border-border overflow-x-auto rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="text-foreground font-semibold">
                        Member
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Calls
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Tokens
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Spend
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byUser.map((u) => (
                      <TableRow
                        key={u.userId ?? "former-members"}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {u.email ?? "Former member"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(u.calls)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(u.tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUsd(u.costUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Recent calls</h2>
              <div className="border-border overflow-x-auto rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="text-foreground font-semibold">
                        Time
                      </TableHead>
                      <TableHead className="text-foreground font-semibold">
                        Member
                      </TableHead>
                      <TableHead className="text-foreground font-semibold">
                        Model
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Tokens in / out
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Latency
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Cost
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDateTime(r.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.email ?? "Former member"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.model}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(r.promptTokens)} /{" "}
                          {formatNumber(r.completionTokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(r.latencyMs / 1000).toFixed(1)} s
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUsd(r.costUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
