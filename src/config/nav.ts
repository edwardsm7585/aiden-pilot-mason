import type { DashboardNavItem } from "@upstart13-com/aiden-ui";

/**
 * Source of truth for the dashboard sidebar navigation. Imported by
 * the app shell, which decides at render-time whether the user can see
 * each item (admin entries are gated by abilities).
 *
 * Icon names are resolved against `defaultNavIconRegistry` from
 * `@upstart13-com/aiden-ui` at render time. Pass a custom registry to
 * `DashboardNav`/`MobileNav`/`DashboardHeader` to register additional
 * icons; see `@upstart13-com/aiden-ui/layout/nav-icons`.
 */

export const primaryNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard/tickets",
    label: "Tickets",
    icon: "Inbox",
    exact: false,
  },
];

export const settingsNavItem: DashboardNavItem = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: "Settings",
  exact: false,
};

/** Starter screen for the global `admin` role (`users.manage`). */
export const adminUsersNavItem: DashboardNavItem = {
  href: "/admin/users",
  label: "Users",
  icon: "Users",
  exact: false,
};

/** DeskLine owner-only admin screens (`member.manage` / `audit.read` / `usage.read`). */
export const orgAdminNavItems: DashboardNavItem[] = [
  { href: "/admin/members", label: "Members", icon: "Users", exact: false },
  { href: "/admin/audit", label: "Audit log", icon: "Shield", exact: false },
  { href: "/admin/cost", label: "AI cost", icon: "Receipt", exact: false },
];
