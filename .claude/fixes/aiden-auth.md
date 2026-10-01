# aiden-auth Fixes

- **[2026-10-01]** Password sign-ups are never audited (`auth.register` missing)
  - **Symptom**: no `auth.register` rows in `audit_logs`, though users registered.
  - **Root cause**: `createAuth` emits `auth.register` from NextAuth's `createUser` event, which only fires for adapter-created (OAuth) users. `createRegisterHandler` writes the user with Prisma directly.
  - **Fix**: audit in the register route via the handler's `onPostRegister` hook (look up the id by email; it only runs for a new account). Raise upstream: `createRegisterHandler` should emit `auth.register` itself.
  - **Also**: the SDK `LoginForm` toasts "Invalid email or password" for any `result.error` (including rate limits), and it needs a `<Toaster />` mounted on auth pages (see `ui.md`).
