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
