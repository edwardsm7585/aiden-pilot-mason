import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { securityHeaders } from "@upstart13-com/aiden-security/middleware";

/**
 * Security headers on every response (HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP).
 * Next 16 renamed `middleware.ts` to `proxy.ts`.
 *
 * CSP uses a per-request nonce (security finding F5), following Next's CSP
 * guide (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 * scripts run only with this request's nonce ('strict-dynamic' lets those
 * scripts load Next's chunks), so an injected inline script is blocked.
 * Next adds the nonce to its own scripts from the request's CSP header; the
 * root layout passes `x-nonce` to next-themes' no-flash script.
 * `securityHeaders` takes a static CSP, so it sets every other header with
 * `csp: false` and the nonce CSP is added here (upstream: nonce option).
 * Styles keep 'unsafe-inline': Radix and sonner set inline style attributes,
 * which nonces can't cover. 'unsafe-eval' is dev-only (React debugging).
 * HSTS is omitted in dev, where the app is served over plain HTTP.
 */
const isProd = process.env.NODE_ENV === "production";

const sdkHeaders = securityHeaders(
  isProd ? { csp: false } : { csp: false, hsts: false }
);

function cspFor(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    "connect-src 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = cspFor(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const sdk = await sdkHeaders(req, event);
  sdk?.headers.forEach((value, key) => res.headers.set(key, value));
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // Skip static assets; every page and API route gets the headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
