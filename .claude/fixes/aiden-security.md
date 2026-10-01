# aiden-security Fixes

- **[2026-10-01]** `withRateLimit` 500s on Auth.js failed sign-ins ("TypeError: immutable")
  - **Symptom**: wrapping `handlers.POST` with `withRateLimit` made every *wrong-password* sign-in return 500; correct passwords still worked. Server log: `TypeError: immutable`.
  - **Root cause**: `withRateLimit` sets `X-RateLimit-*` by mutating the handler's response headers. Auth.js answers a failed credentials sign-in with `Response.redirect()`, whose headers are immutable.
  - **Fix**: wrap the inner handler to return a copy: `new Response(res.body, { status, statusText, headers: new Headers(res.headers) })` (Set-Cookie entries are preserved). See `src/app/api/auth/[...nextauth]/route.ts`.
  - **Prevention**: raise upstream: `withRateLimit` should build a new Response instead of mutating. Always test the *failure* path of a wrapped handler, not just the happy path.

- **[2026-10-01]** `withRateLimit`'s default 429 breaks next-auth's `signIn()`
  - **Symptom**: `signIn("credentials", { redirect: false })` does `new URL(data.url)` on the JSON response; the SDK's default `{ error }` body has no `url`, so the login form throws and stays on its spinner.
  - **Fix**: on 429, answer in Auth.js's shape: `{ url: "/login?error=RateLimited&code=rate_limited" }` (absolute) when `X-Auth-Return-Redirect: 1`, else a 303 to that URL. `Retry-After` is kept.
  - **Known gap**: the SDK `LoginForm` toasts "Invalid email or password" for any `result.error`, so a rate-limited user sees that text. Raise upstream: map `result.code` to a specific message.

- **[2026-10-01]** Per-IP limits trust `X-Forwarded-For`
  - **Note**: `src/lib/client-ip.ts` (shared by register and sign-in) keys on the first `X-Forwarded-For` hop. Behind a proxy that overwrites XFF this is the client IP; exposed directly, a client can rotate the header to dodge the per-IP limit (the per-account sign-in limit still applies), and requests with no XFF share one `unknown` bucket. Deploy behind a proxy that sets XFF, or switch the key to a trusted platform header.

- **[2026-10-01]** Public routes have no request context, so their audit rows lack `requestId`
  - **Symptom**: `auth.signin` rows (emitted inside NextAuth's handler) had `request_id` NULL; only `withAuth` routes open `withRequestContext`.
  - **Fix**: `src/lib/request-context.ts` `withPublicRequestContext()` (same `x-request-id`-or-UUID rule) wraps NextAuth GET/POST and register.

- **[2026-10-01]** Per-IP limit spoofable and per-instance (closed)
  - **Root cause**: `clientIp` read the leftmost `X-Forwarded-For` entry (client-controlled even behind a proxy; Next only fills the header when absent, with `??=`), and the SDK default store is in memory.
  - **Fix**: take entry `len - TRUSTED_PROXY_HOPS` (the one the outermost trusted proxy appended); Postgres `RateLimitStore` with SHA-256 keys (`src/lib/rate-limit-store.ts`). Proven with two instances, a restart, and spoofed left-hand entries.
  - **Note**: `npx shadcn add` can't resolve the `utils` alias when it points at `@upstart13-com/aiden-ui`, and it silently installs an unrelated npm package `cn` and imports from it. Shim `@/lib/utils` → aiden-ui `cn`, add the component, then restore the alias, fix the import and `npm uninstall cn`.
