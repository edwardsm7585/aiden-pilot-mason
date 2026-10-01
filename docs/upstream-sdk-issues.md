# AIDEN SDK and starter: issues found while building DeskLine

These defects were found in `@upstart13-com/aiden-*` 2.0.1 and the `aiden init` starter while building and verifying DeskLine (2026-09-30 → 10-01). Each one has a local workaround in this repo, so DeskLine is unaffected. Each also belongs upstream, so the fix reaches every AIDEN app through `aiden upgrade` (CLAUDE.md: "raise gaps upstream"). The full investigation notes are in `.claude/fixes/`.

They are ordered by impact; security-relevant ones come first.

## Security and correctness

### 1. aiden-security · `withRateLimit` crashes on immutable responses (500)

- **Symptom:** wrapping NextAuth's `handlers.POST` with `withRateLimit` turns every _failed_ credentials sign-in into a 500 (`TypeError: immutable`). Successful sign-ins still work.
- **Cause:** `withRateLimit` sets `X-RateLimit-*` by mutating `res.headers`. Auth.js answers failures with `Response.redirect()`, whose headers are immutable.
- **Workaround:** `src/app/api/auth/[...nextauth]/route.ts` hands it a copy, `new Response(res.body, { status, statusText, headers: new Headers(res.headers) })`.
- **Proposed fix:** build a new `Response` when adding headers (copy body, status and headers, keeping every `Set-Cookie`), instead of mutating.

### 2. aiden-auth · sign-in is not rate-limited, and `LoginForm` can't show a rate-limit message

- **Symptom:** no limit on `POST /api/auth/callback/credentials` by default, which allows password guessing. Once an app adds a limit, the SDK `LoginForm` still toasts "Invalid email or password" for _every_ failure, so a rate-limited user is told their correct password is wrong.
- **Cause:** `LoginForm` takes no props and does `if (result?.error) toast.error("Invalid email or password")`, ignoring `result.code`. `withRateLimit`'s default 429 body (`{ error }`) has no `url`, so `signIn()` throws on `new URL(data.url)` and the form stays on its spinner.
- **Workaround:** the NextAuth route rate-limits per IP and per account, and answers 429 in Auth.js's shape (`{ url: "/login?error=RateLimited&code=rate_limited" }`). The message stays generic; there is no non-fork fix.
- **Proposed fix:**
  - `createAuth({ rateLimit: { perIp, perAccount } })`, applied inside the SDK's handlers.
  - `onLimit` receives the request, so apps can answer in their framework's shape.
  - `LoginForm` maps `result.code`:

```tsx
const SIGN_IN_ERRORS: Record<string, string> = {
  rate_limited:
    "Too many sign-in attempts. Wait a few minutes, then try again.",
};
if (result?.error) {
  toast.error(SIGN_IN_ERRORS[result.code ?? ""] ?? "Invalid email or password");
}
```

### 3. aiden-auth · password sign-ups are never audited

- **Symptom:** no `auth.register` rows, although users register.
- **Cause:** `createAuth` emits `auth.register` from NextAuth's `createUser` event, which fires only for adapter-created (OAuth) users. `createRegisterHandler` writes the user with Prisma directly.
- **Workaround:** `src/app/api/auth/register/route.ts` audits through `onPostRegister`, looking the id up by email.
- **Proposed fix:** `createRegisterHandler` emits `auth.register` itself, and passes the new user's `id` to `onPostRegister`.

### 4. aiden-security · public routes have no request context

- **Symptom:** `auth.signin` / `auth.signout` audit rows have no `request_id`; only `withAuth` opens `withRequestContext`.
- **Workaround:** `src/lib/request-context.ts` `withPublicRequestContext()` around the NextAuth and register handlers.
- **Proposed fix:** export a `withRequestContext`-based wrapper for public routes, and use it in the starter's auth routes.

### 5. aiden-security · `securityHeaders()` can't do a nonce CSP

- **Symptom:** the default CSP (`script-src 'self'`) blocks App Router hydration. The only static alternative is `'unsafe-inline'`, which lets injected inline scripts run.
- **Workaround:** `src/proxy.ts` uses `securityHeaders({ csp: false })` for the other headers and adds a per-request nonce CSP with `'strict-dynamic'`. The root layout reads `x-nonce` (which makes every route dynamic) and passes it to next-themes.
- **Proposed fix:** `securityHeaders({ csp: { nonce: true } })` that sets `x-nonce` and the CSP header, plus a documented root-layout snippet.

### 6. aiden-cli · `aiden doctor` passes without running the CVE scan

- **Symptom:** when `osv-scanner` isn't on PATH, doctor prints a warning and **exits 0**, so a "green" doctor can mean no CVE scan ran.
- **Workaround:** `scripts/checkpoint.sh` finds a winget install and treats the warning as a failure.
- **Proposed fix:** a missing required scanner fails doctor (non-zero), or an explicit `--allow-missing-osv` flag.

## Tooling

### 7. aiden-cli · can't parse the scaffold's own `aiden.config.ts`

- **Symptom:** `aiden doctor` / `aiden upgrade` fail on a fresh `aiden init`.
- **Cause:** a regex parser expects a JSON-compatible object.
- **Workaround:** `aiden.config.ts` rewritten in that shape, and excluded from Prettier so it stays that way.
- **Proposed fix:** load the config with a real TS/JS loader (`jiti`/`tsx`), or ship a scaffold the parser accepts.

### 8. aiden-cli · `aiden upgrade` can't resolve "latest" on Windows

- **Symptom:** `✗ Could not resolve latest version from registry.`
- **Cause:** `spawnSync("npm")` without a shell, but `npm` is `npm.cmd` on Windows.
- **Workaround:** `scripts/checkpoint.sh` resolves the version and passes `--target`.
- **Proposed fix:** `spawnSync("npm", args, { shell: process.platform === "win32" })`, or query the registry over HTTP.

### 9. aiden-ai · `responseSchema` is ignored by the Anthropic adapter

- **Symptom:** structured output returns `parsed: undefined` when the model wraps JSON in a code fence. Only `JSON.parse` of the raw text is tried.
- **Workaround:** a model that returns bare JSON, plus Zod `safeParse` of `res.parsed` (`src/lib/triage.ts`).
- **Proposed fix:** use Anthropic tool use / JSON mode for `responseSchema`, or strip fences before parsing. Also drop `temperature` for models that reject it.

## Starter template

### 10. Sinks registered only in `instrumentation.ts` never fire from routes

- **Cause:** Next 16 bundles instrumentation separately, so routes get their own `aiden-security` instance with the default sink.
- **Workaround:** `src/lib/auth.ts` imports `@/lib/audit`, and `src/lib/ai.ts` imports `@/lib/ai-usage`.

### 11. The starter audit sink calls `headers()` synchronously

- **Symptom:** in Next 16 `headers()` returns a Promise, so `ip_address` and `user_agent` are always NULL, with a warning on every event.
- **Workaround:** `src/lib/audit.ts` awaits it.

### 12. No `<Toaster />` on auth pages

- **Symptom:** `LoginForm`'s error toasts never appear on `/login`; the starter mounts `<Toaster />` only in the dashboard shell.
- **Workaround:** mounted once in the root layout, as DS 07 prescribes.

### 13. The compaction hook contradicts the design system

- **Symptom:** `.claude/hooks/inject-compact-context.sh` told the agent to "NEVER use rounded-lg, rounded-xl, rounded-2xl" and "shadcn/ui is the component library", against CLAUDE.md and DS 00.
- **Workaround:** aligned with CLAUDE.md.

### 14. No formatter configuration

- **Symptom:** CLAUDE.md says `npx prettier --write .`, but the starter ships no Prettier config or dependency. That command uses Prettier's defaults and would reformat 35 files _away_ from the scaffold's own style; the scaffold matches `trailingComma: "es5"`.
- **Workaround:** `.prettierrc.json`, `.prettierignore` and `prettier` pinned as a dev dependency. `verify.sh` checks for drift.

### 15. Prisma 7 ignores the starter's seed config; `next-env.d.ts` is tracked

- **Seed:** `package.json` `"prisma": { "seed" }` is ignored by Prisma 7. Workaround: `migrations.seed` in `prisma.config.ts`.
- **`next-env.d.ts`:** `next dev` and `next build` write it differently, which dirties the tree. Workaround: untracked and gitignored.
- **Starter role toggles:** the Admin → Users toggles are raw `<button>`s with no focus ring or `aria-pressed`. Fixed locally with `Button` and the DS violet pill.
