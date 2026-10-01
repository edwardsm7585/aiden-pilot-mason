import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for src/lib (pure logic: permissions, tenancy scoping, prompt
// fencing, input schemas, client IP, conflict detection, log redaction).
// End-to-end behaviour is covered by scripts/smoke.sh and the evidence suites.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server Component bundle; tests
      // run in plain Node, so give it an empty module.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
