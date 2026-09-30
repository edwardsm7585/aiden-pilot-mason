import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { headers } from "next/headers";
import {
  createAuditReader,
  createPrismaAuditSink,
  setAuditSink,
} from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Wire the Prisma-backed audit sink. Imported once from
 * `instrumentation.ts` so audit events from `aiden-auth` (sign-in,
 * sign-out, register) and `aiden-security` (ownership / ability
 * failures) land in the `audit_logs` table.
 *
 * `captureRequestMeta` reads from Next.js's per-request `headers()`
 * helper. It returns `{}` outside a request (e.g. background jobs)
 * because `headers()` throws there — the sink falls back to nulls.
 *
 * `AUDIT_SINK=jsonl` swaps storage to `.audit/audit.jsonl` (gitignored)
 * without code changes (plan D7). Retention/archival of either store is
 * customer-owned; DeskLine never deletes audit rows.
 */
const prismaSink = createPrismaAuditSink({
  prisma,
  captureRequestMeta: () => {
    try {
      const h = headers() as unknown as Headers;
      return {
        ipAddress:
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          null,
        userAgent: h.get("user-agent") ?? null,
      };
    } catch {
      return {};
    }
  },
});

setAuditSink(
  process.env.AUDIT_SINK === "jsonl"
    ? async (record) => {
        try {
          await mkdir(".audit", { recursive: true });
          await appendFile(".audit/audit.jsonl", JSON.stringify(record) + "\n");
        } catch (err) {
          log.error({ err, event: record.event }, "audit jsonl write failed");
        }
      }
    : prismaSink
);

export const auditReader = createAuditReader({ prisma });
