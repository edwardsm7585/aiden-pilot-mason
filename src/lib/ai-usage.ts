import "server-only";
import { setAIUsageSink } from "@upstart13-com/aiden-logging";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getMembership } from "@/lib/tenancy";
import { auditLog } from "@/lib/security";

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
    // Cost telemetry in the log stream too: usage metadata only, never the
    // prompt or the output (requestId/userId come from the request context).
    const usage = {
      provider: record.provider,
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      costUSD: record.costUSD,
      latencyMs: Math.round(record.latencyMs),
    };
    log.info(usage, "ai.usage");
    await alertOnSpendSpike(record.userId, record.costUSD);
  } catch (err) {
    log.error({ err, requestId: record.requestId }, "ai.usage write failed");
  }
});

/**
 * Cost-runaway guard: alert when one user's AI spend in the last hour
 * crosses `AI_SPEND_ALERT_USD_PER_HOUR` (default $1). Fires once per
 * crossing, as a `log.warn` for ops and an `ai.spend_alert` audit row that
 * org owners see in the Audit log. Detection only: nothing is blocked, and
 * the per-call `maxTokens` caps still bound each request.
 */
const SPEND_WINDOW_MS = 60 * 60_000;

async function alertOnSpendSpike(userId: string, latestUsd: number) {
  const threshold = Number(process.env.AI_SPEND_ALERT_USD_PER_HOUR ?? "1");
  if (!(threshold > 0)) return;
  const { _sum } = await prisma.aIUsage.aggregate({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - SPEND_WINDOW_MS) },
    },
    _sum: { costUsd: true },
  });
  const spent = Number(_sum.costUsd ?? 0);
  if (spent < threshold || spent - latestUsd >= threshold) return;
  const metadata = {
    windowMinutes: SPEND_WINDOW_MS / 60_000,
    spentUsd: Number(spent.toFixed(6)),
    thresholdUsd: threshold,
  };
  log.warn({ userId, ...metadata }, "ai.spend_alert");
  auditLog({ event: "ai.spend_alert", actorId: userId, metadata });
}
