import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { AppShell } from "@/components/app-shell";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Segment guard for everything under `/admin`, so any page added here is
 * protected without remembering a per-page redirect. Pages keep their own
 * ability check as defense-in-depth.
 *
 * Allowed: org owners (DeskLine members / audit / cost) and holders of the
 * starter's global `users.manage` (the /admin/users screen). Everyone else
 * goes to their tickets; signed-out users to /login.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/members");

  const member = await getMembership(session.user.id);
  const scoped = orgSession(
    { user: { id: session.user.id, roles: [] } },
    member
  );
  const isOrgOwner = abilities.can(scoped, "member.manage");
  const isGlobalAdmin = abilities.can(session as never, "users.manage");
  if (!isOrgOwner && !isGlobalAdmin) redirect("/dashboard/tickets");

  return <AppShell session={session}>{children}</AppShell>;
}
