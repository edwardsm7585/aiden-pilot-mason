/** Display formatting per the DS data-display rules. Safe on server and client. */

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** `Sep 30, 2026` */
export function formatDate(d: Date | string): string {
  return DATE.format(new Date(d));
}

/** `Sep 30, 2026, 5:36 PM` */
export function formatDateTime(d: Date | string): string {
  return DATE_TIME.format(new Date(d));
}

/** `3 hours ago`, falling back to the date after a week. */
export function formatRelative(d: Date | string, now = Date.now()): string {
  const seconds = Math.round((new Date(d).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return RELATIVE.format(seconds, "second");
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400)
    return RELATIVE.format(Math.round(seconds / 86_400), "day");
  return formatDate(d);
}

/** AI spend is fractions of a cent per call, so show 4 decimals below $1. */
export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n > 0 && n < 1 ? 4 : 2,
    maximumFractionDigits: n > 0 && n < 1 ? 4 : 2,
  }).format(n);
}

/** `1,284` */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
