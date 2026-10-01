import type { NextRequest } from "next/server";
import { withRateLimit } from "@upstart13-com/aiden-security";
import { handlers } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";

export const { GET } = handlers;

/**
 * Credentials sign-in is rate-limited (security finding F4); every other
 * Auth.js POST (sign-out, session update, OAuth) passes straight through.
 * Two sliding windows, both from the SDK's `withRateLimit`:
 * - per IP: 10 attempts a minute, against one client guessing quickly;
 * - per account: 20 attempts in 15 minutes, against a slow or distributed
 *   attack on one email (high enough that a real user isn't locked out by
 *   a few typos). Successful sign-ins count too.
 * The in-memory store suits single-instance deploys; use a shared
 * `RateLimitStore` (Redis/Upstash) when running several instances.
 */
const isCredentialsSignIn = (req: Request) =>
  new URL(req.url).pathname.endsWith("/callback/credentials");

async function accountKey(req: Request): Promise<string | null> {
  if (!isCredentialsSignIn(req)) return null;
  const form = await req
    .clone()
    .formData()
    .catch(() => null);
  const email = form?.get("email");
  // No email means Auth.js rejects the request anyway; the per-IP limit still applies.
  return typeof email === "string" && email.trim()
    ? `signin:account:${email.trim().toLowerCase()}`
    : null;
}

/**
 * `withRateLimit` writes X-RateLimit-* onto the handler's response, but
 * Auth.js answers a failed sign-in with `Response.redirect()`, whose headers
 * are immutable ("TypeError: immutable" → 500). Hand it a mutable copy
 * (same body, status and headers, including every Set-Cookie).
 * Upstream: aiden-security should copy instead of mutating.
 */
async function authPost(req: Request): Promise<Response> {
  const res = await handlers.POST(req as NextRequest);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
}

const limited = withRateLimit(
  withRateLimit(authPost, {
    limit: 20,
    windowMs: 15 * 60_000,
    keyFor: accountKey,
  }),
  {
    limit: 10,
    windowMs: 60_000,
    keyFor: (req) =>
      isCredentialsSignIn(req) ? `signin:ip:${clientIp(req)}` : null,
  }
);

export async function POST(req: NextRequest): Promise<Response> {
  const res = await limited(req, undefined);
  if (res.status !== 429) return res;
  // next-auth's `signIn()` reads `data.url` and its `error` param, so a bare
  // `{ error }` 429 would throw in the login form. Answer in Auth.js's shape.
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "RateLimited");
  url.searchParams.set("code", "rate_limited");
  // Keep Retry-After and X-RateLimit-* from the SDK's 429.
  const headers = new Headers(res.headers);
  if (req.headers.get("x-auth-return-redirect") === "1") {
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify({ url: url.toString() }), {
      status: 429,
      headers,
    });
  }
  headers.delete("content-type");
  headers.set("location", url.toString());
  return new Response(null, { status: 303, headers });
}
