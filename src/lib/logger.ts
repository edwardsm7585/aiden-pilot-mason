import { createLogger } from "@upstart13-com/aiden-logging";

/**
 * Redaction paths: aiden-logging's defaults, extended. The defaults use pino's
 * "*.key" form, which only matches one level deep, so `log.info({ password })`
 * or `{ session: { refreshToken } }` reached the logs unredacted
 * (tests/logger-redaction.test.ts: 9 of 14 shapes leaked). Each sensitive key
 * is now covered at the top level and up to two levels deep, plus header
 * shapes. Upstream: the SDK defaults should do this.
 */
const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "apiKey",
  "secret",
  "clientSecret",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
];

export const REDACT_PATHS = [
  // aiden-logging defaults
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.apiKey",
  "*.token",
  // extensions
  ...SENSITIVE_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
  'res.headers["set-cookie"]',
  'headers["set-cookie"]',
  '*.headers["set-cookie"]',
];

export const log = createLogger({
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "aiden-app",
  level: process.env.LOG_LEVEL as never,
  redact: [...new Set(REDACT_PATHS)],
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
