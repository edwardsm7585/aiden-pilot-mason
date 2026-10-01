import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { REDACT_PATHS } from "@/lib/logger";

/** Log `obj` through pino with `paths` and return the JSON line written. */
function logged(paths: string[], obj: Record<string, unknown>): string {
  let out = "";
  const sink = new Writable({
    write(chunk, _enc, done) {
      out += chunk.toString();
      done();
    },
  });
  pino({ redact: paths }, sink).info(obj, "test");
  return out;
}

const SECRET = "s3cr3t-value-do-not-log";

// Every shape a secret could reach the logger in: top level, one level deep
// (the only shape the SDK's "*.x" defaults cover), and request headers.
const CASES: Record<string, Record<string, unknown>> = {
  "top-level password": { password: SECRET },
  "nested password": { user: { password: SECRET } },
  "top-level token": { token: SECRET },
  "nested apiKey": { provider: { apiKey: SECRET } },
  "top-level apiKey": { apiKey: SECRET },
  "client secret": { clientSecret: SECRET },
  "nested secret": { config: { secret: SECRET } },
  "access token": { accessToken: SECRET },
  "refresh token": { session: { refreshToken: SECRET } },
  "authorization header": { req: { headers: { authorization: SECRET } } },
  "cookie header": { req: { headers: { cookie: SECRET } } },
  "set-cookie header": { res: { headers: { "set-cookie": SECRET } } },
  "bare headers object": { headers: { authorization: SECRET, cookie: SECRET } },
  "password hash": { user: { passwordHash: SECRET } },
};

describe("log redaction (src/lib/logger.ts REDACT_PATHS)", () => {
  for (const [name, obj] of Object.entries(CASES)) {
    it(`redacts ${name}`, () => {
      const line = logged(REDACT_PATHS, obj);
      expect(line).not.toContain(SECRET);
      expect(line).toContain("[Redacted]");
    });
  }

  it("keeps usage metadata (what ai.usage logs) readable", () => {
    const line = logged(REDACT_PATHS, {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptTokens: 120,
      costUSD: 0.0012,
    });
    expect(line).toContain('"promptTokens":120');
    expect(line).not.toContain("[Redacted]");
  });
});
