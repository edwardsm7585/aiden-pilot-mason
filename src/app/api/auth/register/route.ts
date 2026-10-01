import { createRegisterHandler } from "@upstart13-com/aiden-auth";
import { withRateLimit } from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";

/**
 * Self-service registration, rate-limited per IP to blunt account
 * enumeration and signup spam (each register runs bcrypt, a CPU-DoS
 * amplifier). The in-memory store suits single-instance deploys; swap in
 * a shared `RateLimitStore` (Redis/Upstash) for multi-instance setups.
 */
export const POST = withRateLimit(createRegisterHandler({ prisma }), {
  limit: 5,
  windowMs: 60_000,
  keyFor: (req) => `register:${clientIp(req)}`,
});
