# Design system: checklist against DeskLine (2026-10-01)

Each requirement in the AIDEN design-system guide, checked against the code (static sweep of every `.tsx` file in `src/app` and `src/components`, DeskLine and starter alike) and the running production build. Gaps found by this check were fixed and tested; they are marked **fixed**. Runtime proof: `design-system-runtime.txt` (17/17, 0 page or console errors). Regression on the same build: smoke 7/7, extended matrix 37/37.

## The mandatory UI workflow

| Step | Status |
|---|---|
| Invoke `/frontend-design` before UI code | ✔ every UI change in this pass and the F3/F4/F5 fixes was preceded by the skill (dialog copy, root Toaster, audit badge, this DS pass). Phase 5's dated pre-UI pre-flight table is in `docs/plans/deskline.md` |
| Read `00-overview.md` | ✔ golden rules and anti-patterns were the yardstick for this check |
| Read the relevant DS files | ✔ 01 (icons), 02 (buttons, tabs), 04 (dialogs), 05 (empty states, tables), 06 (active pill), 07 (skeletons, toasts), 08 (layout rules, auth pages) |
| Rules re-injected after context compaction | **fixed**: `.claude/hooks/inject-compact-context.sh` (unmodified starter) contradicted the DS. It banned `rounded-lg/xl/2xl`, said "shadcn/ui is the component library", and pointed schema edits at the generated `schema.prisma`. It now matches CLAUDE.md |

## ThemeProvider wiring

| Rule | Status | Evidence |
|---|---|---|
| `ThemeProvider` at the app root | ✔ | `src/app/layout.tsx` (with the CSP nonce passed through, F5) |
| `suppressHydrationWarning` on `<html>` | ✔ | `src/app/layout.tsx` |
| `globals.css` loaded | ✔ | `src/lib/styles.css` imports `@upstart13-com/aiden-ui/styles/globals.css`; nothing else in it |
| Theme control actually flips the document | ✔ | `ThemeSelector` on Settings → Appearance: Dark sets `.dark` on `<html>`, Light removes it (runtime check; `34-ds-theme-dark.png`); `aiden doctor` SDK wiring green |

## Primitive vs extend vs customise

| Rule | Status | Evidence |
|---|---|---|
| Standard controls use the primitive | **fixed** | three hand-built controls replaced with aiden-ui `Button`: the ticket status filter (styled `<Link>`s), the AI-draft tone picker (raw `<button>` radios), and the starter's role toggles in Admin → Users (raw `<button>`, no focus ring, no `aria-pressed`) |
| Variants extended with tokens via `cn()`, not forked | ✔ | selected state = `selectedPill` (`src/components/selected-pill.ts`) applied with `cn()` on `Button variant="outline"` |
| Layout primitives | ✔ | `PageHeader`, `DashboardNav`, `DashboardHeader`, `MobileNav`, `Tabs` from aiden-ui |
| shadcn primitive not in aiden-ui: install + theme | ✔ | `src/components/ui/select.tsx` (`npx shadcn add select`), tokens only, Lucide 1.5 |

## Non-negotiable rules

| Rule | Status | Evidence |
|---|---|---|
| No hardcoded colours | ✔ | no palette utilities (including `white`/`black`), no arbitrary colour values, no inline `style` (`verify.sh`, 3 checks). Gradients exist only on the public marketing page and use the `background` token |
| Radius scale | ✔ | default `rounded-sm`; `rounded-full` only on dot indicators; `rounded-xl` on card-like panels; nothing above `rounded-2xl` (`verify.sh` "off-scale radius") |
| No `bg-gray-*` / `text-zinc-*` / `border-slate-*` | ✔ | `verify.sh` |
| aiden-ui first | **fixed** | see above; `verify.sh` now fails on any raw `<button>`/`<input>`/`<select>`/`<textarea>` outside `src/components/ui/` |
| One primary CTA per section | ✔ | primary buttons: Create ticket (new-ticket card), Draft reply (draft card), Save changes (edit tab), plus one each in starter settings/admin dialogs. Filters and tone are outline |
| Tailwind utilities only | ✔ | the only CSS file is the token import |
| Responsive: mobile, tablet, desktop | ✔ | no horizontal page scroll on 10 signed-in pages and 3 signed-out pages at 390, 820 and 1440 px (runtime check); `35-ds-mobile-detail-tabs.png` |
| Every page has a PageHeader | ✔ | `verify.sh` E2 (auth pages follow DS 08's own centered auth pattern; settings pages render it once from their layout; `/dashboard` only redirects) |
| Lucide only, `strokeWidth={1.5}`, `size-4` default | ✔ | `verify.sh` now checks *missing* stroke widths too (`scripts/check-icons.mjs`, which handles multi-line JSX and `<Icon>` aliases). `size-6` appears only in DS 05 empty-state tiles |

## Golden rules in `00-overview.md` beyond the summary

| Rule | Status | Evidence |
|---|---|---|
| 7. Interactive elements have focus states | **fixed** | the starter role toggles had none; all choice controls are now `Button` (focus ring built in) |
| 8. Empty states: icon + title + description + action | **fixed** | Audit log, AI cost and Members empty states had no action; each now has "Go to tickets" (`36-ds-empty-state-action.png`) |
| 9. Loading states are skeleton-first | **fixed** | the admin pages had no loading state, which matters now that every page renders per request (F5). `src/app/admin/loading.tsx` (DS 07 table skeleton); the tickets skeleton now matches the button shape, and the detail skeleton includes the tabs |
| 10. Errors are specific | **fixed** | starter copy "Something went wrong. Please try again.", "Search failed" and two "please try again" fallbacks replaced with messages that say what happened and what to do (by status: session expired → sign in again). `verify.sh` fails on "something went wrong" |
| DS 06: active items use the violet pill, not inverted surfaces | **fixed** | DeskLine's filters and tone picker (and the starter's role toggles) showed selection as an inverted black surface. They now use the DS pill tokens (`bg-sidebar-accent text-sidebar-accent-foreground`), the same as the active sidebar item and `ThemeSelector` |
| DS 08 rule 2/5: content `px-6 py-8`, sections `space-y-8` | **fixed** | Members page used `space-y-4`; the ticket not-found page used `py-24` |
| DS 08 rule 7: detail pages use Tabs for 2+ sections | **fixed** | ticket detail: **Reply** (customer message and AI draft together, so the agent reads while drafting) and **Edit ticket** tabs right under the page header; Details stays in the sidebar on both. Panels stay mounted, so a finished draft survives switching tabs (runtime check: 1,063 characters before and after). Viewers have one section and see no tabs |

## Not changed

- **Formatting:** 36 files across the repo (starter and DeskLine) aren't Prettier-formatted under any settings; the repo has no Prettier config. This is code style, not part of the design system, so they were left as they are to keep this change reviewable.
- **The SDK `LoginForm`** shows "Invalid email or password" for every sign-in failure, including rate limits. That needs an upstream change (`.claude/fixes/aiden-auth.md`).
