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
