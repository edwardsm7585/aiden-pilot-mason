/**
 * Derive a per-request client IP for rate limiting. Falls back to a
 * shared bucket when no IP can be determined (fail closed, not open) so
 * a missing header can't bypass the limit.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}
