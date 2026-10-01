# Next.js & App Router Fixes

- **[2026-02-12]** `useSearchParams()` in a page component causes build error `useSearchParams() should be wrapped in a suspense boundary` → In Next.js 15+, pages that use `useSearchParams()` must wrap the consuming component in a `<Suspense>` boundary. Extract the page content into a separate component (e.g., `PageContent`) and wrap it with `<Suspense fallback={...}>` in the default export page component.
- **[2026-02-12]** `window.history.replaceState()` inside a `useEffect` that depends on `[searchParams]` causes the effect to immediately re-run and cleanup → In Next.js 14+, `replaceState`/`pushState` are intercepted and sync with `useSearchParams()`. If you clean URL params via `replaceState` at the top of an effect that depends on `searchParams`, the params change triggers re-run. Fix: defer URL cleaning until inside the async callback (after capturing the params), or use a `useRef` to store params before cleaning.
- **[2026-02-15]** `npm run build` fails with `Cannot find module './XXXX.js'` in `.next/server/webpack-runtime.js` → This is a stale Next.js build cache issue, not a code error. TypeScript compilation and linting succeed but the "Collecting page data" step fails on a missing chunk. Fix: delete `.next/` directory (`rm -rf .next`) and rebuild.

- **[2026-09-30]** aiden-security `securityHeaders()` default CSP blocks App Router hydration
  - **Root cause**: Default `script-src 'self'` disallows the inline scripts Next's App Router and next-themes emit; `securityHeaders` accepts only a static `csp` string (no per-request nonce).
  - **Fix**: In `src/proxy.ts` (Next 16's rename of `middleware.ts`), pass `csp` with `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev). Note `securityHeaders` is a factory — call it; don't `export { securityHeaders as middleware }` as its README shows.
  - **Prevention**: Raise upstream for nonce support.

- **[2026-09-30]** Audit / AI-usage sinks registered in `instrumentation.ts` never fire from routes (Next 16 + Turbopack)
  - **Symptom**: Sign-ins logged `"event":"audit.auth.signin"` to the console (aiden-security's fallback sink); `audit_logs` stayed empty.
  - **Wrong approach**: `serverExternalPackages: ["@upstart13-com/aiden-security", ...]` — `aiden-security/dist/middleware.js` imports `next/server` without `.js`; native ESM rejects it and every page 500s.
  - **Root cause**: `instrumentation.ts` is bundled separately from route handlers; each bundle has its own copy of the aiden-* module state, so `setAuditSink`/`setAIUsageSink` in instrumentation don't affect routes.
  - **Fix**: Side-effect import the sink module from a module every emitting route already loads: `src/lib/auth.ts` → `import "@/lib/audit"`, `src/lib/ai.ts` → `import "@/lib/ai-usage"`.
  - **Prevention**: After wiring any sink, trigger one real event through the dev server and check the table. Raise upstream: the starter's instrumentation-only wiring is broken.

- **[2026-09-30]** `headers()` used synchronously in the starter's audit `captureRequestMeta`
  - **Symptom**: `Route "..." used headers().get. headers() returns a Promise` on every audit event; `ip_address`/`user_agent` always NULL.
  - **Fix**: In the (async) sink, `await headers()` first, then call `createPrismaAuditSink({ prisma, captureRequestMeta: () => meta })(record)`. Raise upstream: make `captureRequestMeta` async-capable.

- **[2026-10-01]** `next-env.d.ts` dirties the tree and made checkpoints skip the upgrade dry-run
  - **Symptom**: `next dev` and `next build` write different `next-env.d.ts` contents; the tracked file flipped, `checkpoint.sh` saw a dirty tree and SKIPPED `aiden upgrade --dry-run`.
  - **Fix**: Untrack + gitignore it (guarded in `checkpoint.sh` and `verify.sh`). `aiden upgrade --dry-run` itself works on a dirty tree, so `checkpoint.sh` now always runs it and only fails *afterwards* on a dirty tree (recording `tree=`/`head=`), so a safety check is never silently skipped.

- **[2026-10-01]** Nonce CSP needs every page dynamic, and Zod 4 trips `script-src` on every page
  - **Symptom 1**: with a nonce CSP, `/login`, `/register` and `/_not-found` were prerendered static, so their scripts would carry no nonce and hydration would be blocked.
  - **Fix 1**: the root layout reads `(await headers()).get("x-nonce")` (passed to next-themes' `ThemeProvider nonce`), which also makes every route dynamic. Build output must show 0 `○` routes. Guide: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
  - **Symptom 2**: a `script-src` `securitypolicyviolation` (blockedURI `eval`) on every page load, from Zod 4's `allowsEval` probe in a client chunk. Harmless (try/catch, falls back) but noisy.
  - **Fix 2**: `src/instrumentation-client.ts` → `z.config({ jitless: true })`.
  - **Test note**: `'strict-dynamic'` trusts scripts created by already-running JS; test CSP with injected-HTML vectors (`<img onerror>`, parser-inserted `<script>`, `javascript:` URLs), not `createElement` from page code.

- **[2026-10-01]** `⨯ Error: The destination stream closed early` in the prod server log
  - **Cause**: the client cancelled a page/RSC stream mid-response (e.g. a test navigating away during the login form's post-sign-in `router.refresh()`). Reproduced: aborted RSC fetches log it; complete ones never do.
  - **Action**: none; it's a client disconnect, not a server fault. Don't chase it unless it appears without aborted navigations.

- **[2026-10-01]** Fresh clone: no generated Prisma client after `npm install` (Windows)
  - **Symptom**: `npm run db:seed` → `Cannot find module '../src/generated/prisma/client'`; the original checkout hid it because `src/generated` already existed.
  - **Root cause**: starter `scripts/postinstall.mjs` spawned `npm.cmd` without a shell → `EINVAL` on Node ≥ 18.20.2/20.12.2 (CVE-2024-27980), and `?? 0` reported success.
  - **Fix**: `spawnSync("npm run prisma:generate", { shell: true })` and exit 1 when it never ran; README step 3 runs `npm run prisma:generate` explicitly. **Lesson**: test the README on a fresh clone, never only on the working checkout.
