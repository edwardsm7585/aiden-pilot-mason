# aiden-cli Fixes

- **[2026-09-30]** `aiden doctor` / `aiden upgrade` can't read the scaffold's own `aiden.config.ts` (aiden-cli 2.0.1)
  - **Symptom**: `aiden-cli: failed to parse aiden.config.ts literal: Bad control character in string literal in JSON at position 287 (line 12 column 19)`
  - **Wrong approach**: Assuming the em dash in the comment on that line was the cause. Line/column refer to the CLI's post-processed JSON, not the source file.
  - **Root cause**: The CLI doesn't evaluate the file — `parseTsConfigLiteral` regex-strips comments (`//.*$` also eats `//example.com` inside the `url` string), drops only `as const`, then `JSON.parse`s. The scaffold also uses `as {…}[]` casts and `undefined`, and nests `ai.providers.x` as `{ enabled, model }` while the CLI schema wants booleans.
  - **Fix**: Keep the `aidenConfig` literal JSON-compatible: explicit named type annotation instead of `as` casts, no `undefined`, `\/\/` inside strings, `ai.providers` as booleans with default models in a sibling `ai.models` block (read by `src/lib/ai.ts`).
  - **Prevention**: Run `npx @upstart13-com/aiden-cli doctor` after any `aiden.config.ts` edit.

- **[2026-09-30]** `aiden upgrade` on Windows → `✗ Could not resolve latest version from registry.` (aiden-cli 2.0.1)
  - **Root cause**: `fetchLatestVersion` calls `spawnSync("npm", …)` without `shell: true`; on Windows `npm` is `npm.cmd`, so spawn fails with ENOENT. `npm view` itself works.
  - **Fix**: Pass the version explicitly: `aiden upgrade --dry-run --target "$(npm view @upstart13-com/aiden-ai version)"` (done in `scripts/checkpoint.sh`). Raise upstream. Raise upstream: the CLI should evaluate the config (e.g. via jiti/tsx) and its schema should match what `aiden init` scaffolds.
