import "server-only";
import { setAIUsageSink } from "@upstart13-com/aiden-logging";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getMembership } from "@/lib/tenancy";

/**
 * Persist every AI call's usage to `AIUsage` (plan §2). aiden-ai reports
 * usage through aiden-logging when a complete/stream finishes; `requestId`
 * and `userId` are attached from the request context `withAuth` opened.
 *
 * Metadata only — never prompts or outputs. Imported once from
 * `instrumentation.ts`. Errors are caught here: usage recording must never
 * break the request that triggered it.
 */
setAIUsageSink(async (record) => {
  try {
    const member = record.userId ? await getMembership(record.userId) : null;
    if (!record.userId || !member) {
      log.warn(
        { requestId: record.requestId, model: record.model },
        "ai.usage skipped: no user or org in context"
      );
      return;
    }
    await prisma.aIUsage.create({
      data: {
        orgId: member.orgId,
        userId: record.userId,
        requestId: record.requestId ?? null,
        provider: record.provider,
        model: record.model,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        costUsd: record.costUSD,
        latencyMs: Math.round(record.latencyMs),
      },
    });
  } catch (err) {
    log.error({ err, requestId: record.requestId }, "ai.usage write failed");
  }
});
