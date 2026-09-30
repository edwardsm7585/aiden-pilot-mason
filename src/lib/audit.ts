import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { headers } from "next/headers";
import {
  createAuditReader,
  createPrismaAuditSink,
  setAuditSink,
  type AuditSink,
} from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Wire the Prisma-backed audit sink, so audit events from `aiden-auth`
 * (sign-in, sign-out, register) and `aiden-security` (ownership / ability
 * failures) land in the `audit_logs` table. Imported from
 * `instrumentation.ts` and from `src/lib/auth.ts` — the latter puts the
 * registration in the route module graph (see the note there).
 *
 * Request metadata (IP, user-agent) comes from Next.js's per-request
 * `headers()`. In Next 16 that returns a Promise, but the SDK calls
 * `captureRequestMeta` synchronously — so the sink awaits `headers()`
 * first and hands the result to the SDK's Prisma sink. Outside a request
 * (e.g. background jobs) `headers()` throws and the columns stay null.
 *
 * `AUDIT_SINK=jsonl` swaps storage to `.audit/audit.jsonl` (gitignored)
 * without code changes (plan D7). Retention/archival of either store is
 * customer-owned; DeskLine never deletes audit rows.
 */
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

async function readRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
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
}

const prismaSink: AuditSink = async (record) => {
  const meta = await readRequestMeta();
  await createPrismaAuditSink({ prisma, captureRequestMeta: () => meta })(
    record
  );
};

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
