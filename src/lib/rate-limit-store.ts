import "server-only";
import { createHash } from "node:crypto";
import {
  getDefaultRateLimitStore,
  type RateLimitStore,
} from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Postgres-backed `RateLimitStore` for the SDK's `withRateLimit`. Every app
 * instance shares the same counts, and they survive restarts (the SDK's
 * default in-memory store is per process). Keys are SHA-256 hashed, so the
 * table never holds emails or IP addresses.
 *
 * Set RATE_LIMIT_STORE=memory to use the SDK's in-memory store instead
 * (single instance only, e.g. a throwaway local run).
 */
const LONGEST_WINDOW_MS = 24 * 60 * 60_000; // rows older than this are swept

const postgresStore: RateLimitStore = {
  async hit(key, now, windowMs) {
    const hashed = createHash("sha256").update(key).digest("hex");
    const cutoff = new Date(now - windowMs);
    const rows = await prisma.$transaction([
      prisma.rateLimitHit.create({ data: { key: hashed, at: new Date(now) } }),
      prisma.rateLimitHit.deleteMany({
        where: { key: hashed, at: { lt: cutoff } },
      }),
      prisma.rateLimitHit.findMany({
        where: { key: hashed, at: { gte: cutoff } },
        select: { at: true },
        orderBy: { at: "asc" },
      }),
    ]);
    // Occasionally sweep keys nobody has hit for a day.
    if (Math.random() < 0.01) {
      prisma.rateLimitHit
        .deleteMany({
          where: { at: { lt: new Date(now - LONGEST_WINDOW_MS) } },
        })
        .catch((err: unknown) => log.error({ err }, "rate-limit sweep failed"));
    }
    return rows[2].map((r) => r.at.getTime());
  },
};

export const rateLimitStore: RateLimitStore =
  process.env.RATE_LIMIT_STORE === "memory"
    ? getDefaultRateLimitStore()
    : postgresStore;
