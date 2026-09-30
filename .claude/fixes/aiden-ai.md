# aiden-ai Fixes

- **[2026-09-30]** Structured output (`responseSchema`) silently returns `parsed: undefined` on Anthropic (aiden-ai 2.0.1)
  - **Symptom**: `TriageSchema.safeParse(res.parsed)` failed on every call; `res.text` started with ```` ```json ````.
  - **Wrong approach**: Tightening the system prompt ("no code fences", "first character must be {") — `claude-haiku-4-5` still fenced 6/6; a trailing format rule in the user message reached only 4/6 (always failing on the prompt-injection ticket).
  - **Root cause**: The Anthropic adapter never sends `responseSchema` to the API (`toRequest` ignores it); it only `JSON.parse`s the reply text, so any markdown wrapper → `parsed` is `undefined`.
  - **Fix**: Use a model that follows the JSON-only instruction reliably: `claude-sonnet-4-6` (6/6 valid over two runs, priced in the SDK's cost table). Keep Zod validation of `parsed` as the guard; no regex/`JSON.parse` in app code.
  - **Prevention**: Live-test structured output per model before relying on it. Raise upstream: the adapter should use Anthropic's native structured output (or at least strip a code fence before parsing).

- **[2026-09-30]** `400 "temperature" is deprecated for this model` on `claude-sonnet-5-5`
  - **Fix**: Don't pass `temperature` in shared call sites (`src/lib/triage.ts`), so switching `ai.models` can't break them.

- **[2026-09-30]** Running `src/lib/*` outside Next (tsx scripts) fails: `Cannot find module 'server-only'`, then `ERR_PACKAGE_PATH_NOT_EXPORTED` for `@upstart13-com/aiden-ai`
  - **Root cause**: `server-only` is aliased by Next, not installed; `aiden-*` packages are ESM-only and tsx compiles `.ts` in this (CommonJS) package as CJS.
  - **Fix**: For one-off checks, write the script as `.mts`, import `aiden-ai` directly, and stub `server-only` via `NODE_PATH`. Test app code paths through the dev server instead.
