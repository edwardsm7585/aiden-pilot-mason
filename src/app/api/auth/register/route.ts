import { createRegisterHandler } from "@upstart13-com/aiden-auth";
import { withRateLimit } from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { log } from "@/lib/logger";
import { clientIp } from "@/lib/client-ip";
import { rateLimitStore } from "@/lib/rate-limit-store";
import { withPublicRequestContext } from "@/lib/request-context";

/**
 * Self-service registration, rate-limited per IP to blunt account
 * enumeration and signup spam (each register runs bcrypt, a CPU-DoS
 * amplifier). Counts live in Postgres (src/lib/rate-limit-store.ts), shared
 * by every instance.
 *
 * Audit: aiden-auth emits `auth.register` from NextAuth's `createUser`
 * event, which only fires for adapter-created (OAuth) users. Password
 * sign-ups go through this handler instead, so it audits them via
 * `onPostRegister`, the SDK's hook for this. The hook only runs for a new
 * account (an existing email gets the same 201 without it).
 */
const register = createRegisterHandler({
  prisma,
  onPostRegister: async ({ email }) => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      log.warn("auth.register audit skipped: new user not found");
      return;
    }
    auditLog({ event: "auth.register", actorId: user.id });
  },
});

export const POST = withPublicRequestContext(
  withRateLimit(register, {
    limit: 5,
    store: rateLimitStore,
    windowMs: 60_000,
    keyFor: (req) => `register:${clientIp(req)}`,
  })
);
