#!/usr/bin/env node
/**
 * Starter postinstall — runs `prisma:generate` in customer apps so the
 * generated client lands without an extra command after `aiden init`.
 *
 * Skips when running inside the AIDEN SDK monorepo (detected by sibling
 * `packages/aiden-db` workspace), because the `aiden-db-merge-schema` bin
 * lives under `dist/` and isn't symlinked until packages are built.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const monorepoMarker = resolve(here, "..", "..", "..", "packages", "aiden-db");

if (existsSync(monorepoMarker)) {
  console.log(
    "[aiden-starter] SDK monorepo detected — skipping prisma:generate postinstall (will run via build)."
  );
  process.exit(0);
}

if (process.env.AIDEN_SKIP_POSTINSTALL === "1") {
  console.log(
    "[aiden-starter] AIDEN_SKIP_POSTINSTALL=1 — skipping prisma:generate postinstall."
  );
  process.exit(0);
}

// One command string through the shell: Node >= 18.20.2 / 20.12.2 refuses to
// spawn npm.cmd without a shell on Windows (CVE-2024-27980 fix, EINVAL), and a
// single string avoids the DEP0190 warning for shell + args.
const result = spawnSync("npm run prisma:generate", {
  shell: true,
  stdio: "inherit",
});
if (result.error || result.status === null) {
  // Never report success for a command that didn't run: the starter's
  // "result.status ?? 0" turned a failed spawn into a silent pass, leaving no
  // generated Prisma client.
  console.error(
    "[aiden-starter] could not run prisma:generate:",
    result.error?.message ?? "no exit status",
    "- run it yourself: npm run prisma:generate"
  );
  process.exit(1);
}
process.exit(result.status);
