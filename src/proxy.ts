import { securityHeaders } from "@upstart13-com/aiden-security/middleware";

/**
 * Security headers on every response (HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP).
 * Next 16 renamed `middleware.ts` to `proxy.ts`. `securityHeaders()` is a
 * factory, so it's called here rather than re-exported (plan §4).
 *
 * CSP: the SDK default's `script-src 'self'` blocks the inline scripts the
 * App Router hydrates with (and next-themes' no-flash script), and
 * `securityHeaders` takes a static CSP, not a per-request nonce. So scripts
 * allow 'unsafe-inline' (+ 'unsafe-eval' for dev tooling); everything else
 * matches the SDK default. Nonce support is an upstream request.
 * HSTS is omitted in dev, where the app is served over plain HTTP.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "connect-src 'self'",
  "object-src 'none'",
].join("; ");

export const proxy = securityHeaders(isProd ? { csp } : { csp, hsts: false });

export const config = {
  // Skip static assets; every page and API route gets the headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
