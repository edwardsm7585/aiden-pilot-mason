import type { ReactNode } from "react";
import type { Session, User } from "next-auth";
import {
  DashboardHeader,
  DashboardNav,
  type DashboardNavItem,
} from "@upstart13-com/aiden-ui";
import { abilities } from "@/lib/abilities";
import { getMembership, orgSession } from "@/lib/tenancy";
import { brand } from "@/config/brand";
import { aidenConfig } from "@/../aiden.config";
import {
  primaryNavItems,
  settingsNavItem,
  adminUsersNavItem,
  orgAdminNavItems,
} from "@/config/nav";

interface AppShellProps {
  session: Session;
  children: ReactNode;
}

/**
 * Signed-in app chrome shared by `/dashboard` and `/admin`: desktop sidebar,
 * mobile header, toasts. Admin nav entries are derived from abilities at
 * render time — never a static list — so non-owners never see them.
 */
export async function AppShell({ session, children }: AppShellProps) {
  const user = session.user as User & { id: string };
  const member = await getMembership(user.id);
  const scoped = orgSession(
    { user: { ...user, roles: (user as { roles?: string[] }).roles ?? [] } },
    member
  );

  const secondaryNavItems: DashboardNavItem[] = [
    ...(abilities.can(scoped, "member.manage") ? orgAdminNavItems : []),
    ...(abilities.can(session as never, "users.manage")
      ? [adminUsersNavItem]
      : []),
    settingsNavItem,
  ];

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DashboardNav
        user={user}
        primaryNavItems={primaryNavItems}
        secondaryNavItems={secondaryNavItems}
        brand={brand}
        settingsHref={settingsNavItem.href}
        showBilling={aidenConfig.billing.enabled}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          user={user}
          primaryNavItems={primaryNavItems}
          secondaryNavItems={secondaryNavItems}
          brand={brand}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
