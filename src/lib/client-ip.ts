/**
 * The client IP for rate limiting.
 *
 * `X-Forwarded-For` is a list: the client can put anything at the start, and
 * each proxy appends the address it saw on the right. So the trustworthy
 * entry is the one added by your own outermost trusted proxy: counting from
 * the right, entry number TRUSTED_PROXY_HOPS (default 1, a single load
 * balancer or reverse proxy). Next.js fills in the socket address only when
 * the header is absent, so with no proxy and no header this is the real peer.
 *
 * Reading the leftmost entry (what the starter did) lets any client pick its
 * own "IP" even behind a proper proxy. When nothing usable is present, all
 * such requests share one bucket (fail closed, not open).
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    chain[chain.length - hops] ??
    chain[0] ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
