/**
 * Audit-log retention (decision D7; policy in docs/audit-retention.md).
 *
 *   npm run audit:retention -- --dry-run   # report only
 *   npm run audit:retention                # apply
 *
 * 1. Anonymise: clear ip_address / user_agent on rows older than
 *    AUDIT_PII_DAYS (default 180).
 * 2. Archive + purge: rows older than AUDIT_RETENTION_DAYS (default 400) are
 *    appended to a JSONL file in AUDIT_ARCHIVE_DIR (default .audit/archive),
 *    flushed to disk, and only then deleted, one batch at a time. A crash can
 *    duplicate archive lines but can never lose a row.
 * 3. Records the run as an `audit.retention_run` audit row.
 *
 * Schedule it daily (cron, a platform scheduler, or CI with DB access).
 */
import dotenv from "dotenv";
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

dotenv.config({ path: ".env.local" });

const DAY_MS = 24 * 60 * 60_000;
const BATCH = 1000;

function days(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${name} must be a whole number of days (got "${raw}")`);
  }
  return n;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const retentionDays = days("AUDIT_RETENTION_DAYS", 400);
  const piiDays = days("AUDIT_PII_DAYS", 180);
  if (piiDays > retentionDays) {
    throw new Error("AUDIT_PII_DAYS can't be longer than AUDIT_RETENTION_DAYS");
  }
  const archiveDir = resolve(
    process.env.AUDIT_ARCHIVE_DIR ?? join(".audit", "archive")
  );
  const now = Date.now();
  const piiCutoff = new Date(now - piiDays * DAY_MS);
  const purgeCutoff = new Date(now - retentionDays * DAY_MS);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const toAnonymise = {
      timestamp: { lt: piiCutoff },
      OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }],
    };
    const anonymiseCount = await prisma.auditLog.count({ where: toAnonymise });
    const purgeCount = await prisma.auditLog.count({
      where: { timestamp: { lt: purgeCutoff } },
    });
    console.log(
      `policy: anonymise after ${piiDays} days, archive + delete after ${retentionDays} days`
    );
    console.log(`rows to anonymise: ${anonymiseCount}`);
    console.log(`rows to archive and delete: ${purgeCount}`);
    if (dryRun) {
      console.log("dry run: nothing changed");
      return;
    }

    const anonymised = await prisma.auditLog.updateMany({
      where: toAnonymise,
      data: { ipAddress: null, userAgent: null },
    });

    let archived = 0;
    let archiveFile: string | null = null;
    if (purgeCount > 0) {
      mkdirSync(archiveDir, { recursive: true });
      archiveFile = join(
        archiveDir,
        `audit-before-${purgeCutoff.toISOString().slice(0, 10)}-run-${new Date(now).toISOString().replace(/[:.]/g, "-")}.jsonl`
      );
      const fd = openSync(archiveFile, "a");
      try {
        for (;;) {
          const batch = await prisma.auditLog.findMany({
            where: { timestamp: { lt: purgeCutoff } },
            orderBy: [{ timestamp: "asc" }, { id: "asc" }],
            take: BATCH,
          });
          if (batch.length === 0) break;
          writeSync(fd, batch.map((r) => JSON.stringify(r)).join("\n") + "\n");
          fsyncSync(fd); // on disk before the rows are deleted
          await prisma.auditLog.deleteMany({
            where: { id: { in: batch.map((r) => r.id) } },
          });
          archived += batch.length;
        }
      } finally {
        closeSync(fd);
      }
    }

    await prisma.auditLog.create({
      data: {
        event: "audit.retention_run",
        metadata: {
          retentionDays,
          piiDays,
          anonymised: anonymised.count,
          archivedAndDeleted: archived,
          archiveFile: archiveFile ? archiveFile.split(/[\\/]/).pop() : null,
        },
      },
    });
    console.log(`anonymised: ${anonymised.count}`);
    console.log(`archived and deleted: ${archived}`);
    if (archiveFile) console.log(`archive: ${archiveFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
