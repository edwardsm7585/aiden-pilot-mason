import type { NextRequest } from "next/server";
import { withRateLimit } from "@upstart13-com/aiden-security";
import { handlers } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { rateLimitStore } from "@/lib/rate-limit-store";
import { withPublicRequestContext } from "@/lib/request-context";

// Both methods run in a request context, so Auth.js audit events
// (auth.signin, auth.signout) carry a requestId like every other route.
export const GET = withPublicRequestContext((req: Request) =>
  handlers.GET(req as NextRequest)
);

/**
 * Credentials sign-in is rate-limited (security finding F4); every other
 * Auth.js POST (sign-out, session update, OAuth) passes straight through.
 * Two sliding windows, both from the SDK's `withRateLimit`:
 * - per IP: 10 attempts a minute, against one client guessing quickly;
 * - per account: 20 attempts in 15 minutes, against a slow or distributed
 *   attack on one email (high enough that a real user isn't locked out by
 *   a few typos). Successful sign-ins count too.
 * Counts live in Postgres (src/lib/rate-limit-store.ts), shared by every
 * instance and kept across restarts.
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
    store: rateLimitStore,
    windowMs: 15 * 60_000,
    keyFor: accountKey,
  }),
  {
    limit: 10,
    store: rateLimitStore,
    windowMs: 60_000,
    keyFor: (req) =>
      isCredentialsSignIn(req) ? `signin:ip:${clientIp(req)}` : null,
  }
);

export const POST = withPublicRequestContext(rateLimitedPost);

const SIGNIN_RETRY_COOKIE = "deskline_signin_retry_at";

async function rateLimitedPost(req: Request): Promise<Response> {
  const res = await limited(req, undefined);
  if (res.status !== 429) return res;
  // next-auth's `signIn()` reads `data.url` and its `error` param, so a bare
  // `{ error }` 429 would throw in the login form. Answer in Auth.js's shape.
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "RateLimited");
  url.searchParams.set("code", "rate_limited");
  // Keep Retry-After and X-RateLimit-* from the SDK's 429.
  const headers = new Headers(res.headers);
  // The SDK LoginForm shows "Invalid email or password" for any error, so
  // tell the login page when sign-in reopens (SignInLimitNotice reads this).
  // Only a timestamp; readable by the page on purpose, expires with the lock.
  const retryAfter = Math.max(1, Number(res.headers.get("retry-after")) || 60);
  headers.append(
    "set-cookie",
    `${SIGNIN_RETRY_COOKIE}=${Date.now() + retryAfter * 1000}; Path=/; Max-Age=${retryAfter}; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}`
  );
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
