# UI & Frontend Fixes

- **[2026-02-10]** `{value && (<Component />)}` where value is `unknown` causes TypeScript error `Type 'unknown' is not assignable to type 'ReactNode'` → Use `{value !== null && (<Component />)}` to narrow the type, or cast/type-guard the value first.
- **[2026-02-10]** `[STRUCTURALLY PREVENTED]` Hardcoded Tailwind colors (`bg-emerald-500`, `bg-red-500`, `bg-amber-500`) violate design system → Use CSS variable tokens: `bg-chart-2` (green/success), `bg-destructive` (red/danger), `bg-chart-3` (amber/warning). See `docs/design-system/01-foundations.md`. ESLint `no-restricted-syntax` rule in `eslint.config.mjs` now flags hardcoded color class names at lint time.
- **[2026-02-10]** Calling `res.json()` twice on the same Response object throws "body already consumed" → Extract the JSON once into a variable and reuse it for both error checking and data extraction.
- **[2026-02-20]** UI fetch code assumed wrong API response shape, silently returning empty data
  - **Symptom**: UI selector always empty despite data existing. No error shown.
  - **Root cause**: Page assumed `{ items: [...] }` but route returned `{ data: [...] }`. The mismatch silently produced an empty array.
  - **Fix**: Read the exact `return NextResponse.json(...)` line in the route handler before writing UI fetch code.
  - **Prevention**: Before writing any fetch call in a page, **read the corresponding API route handler** to confirm the exact response shape. Never assume `{ items }`, `{ data }`, or `{ <resourceName> }`. Note: `ApiResponse<T>` in `src/types/index.ts` provides a shared type — use it for all route return types and the fetch caller to get type safety.
- **[2026-02-20]** Tailwind v4 `@utility container` does not reliably apply `margin-inline` or `padding-inline` — only `max-width` is honoured
  - **Symptom**: All `.container` elements flush against the left edge; devtools shows `marginLeft: 0px`, `paddingLeft: 0px` despite `@utility container { margin-inline: auto; padding-inline: 1.5rem }` being defined.
  - **Root cause**: In Tailwind v4, `@utility` declarations are placed inside `@layer utilities`. For the built-in `container` utility, `margin` and `padding` overrides are silently ignored — only `max-width` takes effect.
  - **Fix**: Keep `@utility container { max-width: 1280px }` and add plain un-layered CSS in `globals.css` (outside any `@layer`): `.container { margin-left: auto; margin-right: auto; padding-left: 1.5rem; padding-right: 1.5rem }` with responsive media queries. Un-layered CSS wins over all `@layer` declarations in the cascade.
  - **Prevention**: Never use `@utility` alone to configure container centering/padding in Tailwind v4. Always pair with un-layered CSS overrides. See `docs/design-system/01-foundations.md` Container section.

- **[2026-10-01]** No `<Toaster />` on auth pages: sign-in errors were invisible
  - **Symptom**: the SDK `LoginForm` calls `toast.error("Invalid email or password")`, but nothing appeared on `/login`; the starter mounted `<Toaster />` only in the dashboard shell.
  - **Fix**: mount it once in `src/app/layout.tsx` (DS 07: "Mount the themed `<Toaster />` once in your root layout") and remove the shell's copy.

- **[2026-10-01]** Hand-built choice controls copied from the starter
  - **Symptom**: the starter's Admin → Users role toggles are raw `<button>`s with an inverted `bg-foreground` selected state and no focus ring; DeskLine's status filter and tone picker copied that look. DS 02 says filter/category controls are `Button variant="outline"`, and DS 06 says active items use the violet pill, not inverted surfaces.
  - **Fix**: `<Button variant="outline" size="sm" className={cn(selected && selectedPill)}>` (`src/components/selected-pill.ts`: `bg-sidebar-accent text-sidebar-accent-foreground`). `verify.sh` now fails on raw HTML controls outside `src/components/ui/`.
  - **Also**: the starter's `.claude/hooks/inject-compact-context.sh` re-injected wrong DS rules after compaction (banned `rounded-lg/xl/2xl`; "shadcn/ui first"). It's aligned with CLAUDE.md now; raise upstream.
