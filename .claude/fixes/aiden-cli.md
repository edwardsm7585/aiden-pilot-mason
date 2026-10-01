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

- **[2026-10-01]** `aiden doctor` exits 0 when osv-scanner is missing (CVE scan silently skipped)
  - **Symptom**: doctor prints `! osv-scanner not on PATH` as a warning and still exits 0, so checkpoints read green without a CVE scan (happened when a shell didn't inherit the winget PATH entry).
  - **Fix**: `scripts/checkpoint.sh` adds a winget `Google.OSVScanner_*` dir to PATH if needed and treats the warning as a red doctor (`doctor=4`). Raise upstream: a missing required scanner should fail doctor.

- **[2026-10-01]** `aiden migrate` exits 0 without migrating (Windows)
  - **Symptom**: empty DB → `aiden migrate` prints nothing, exit 0, 0 tables.
  - **Root cause**: `spawnSync("npx", …)` without a shell → ENOENT on Windows (`npx.cmd`); `process.exit(r.status ?? 0)` treats the null status of a failed spawn as success.
  - **Fix**: on Windows run `npx prisma migrate deploy` (what it wraps). Upstream item 16 in `docs/upstream-sdk-issues.md`.
