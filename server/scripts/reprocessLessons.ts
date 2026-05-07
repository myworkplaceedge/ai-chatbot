/**
 * Lesson cleanup pipeline (issues #41 + #42).
 *
 * Runs the same `stripDesignerSections` cleaner that the upload route uses,
 * but as a batch over every Lesson row in the database. Designed to be:
 *
 *   - Idempotent: rows whose cleaned content equals their stored content are
 *     left untouched. Re-running is a true no-op for already-clean rows.
 *   - Re-runnable: safe to invoke again as new lessons land or as the
 *     cleanup rules evolve. Each run produces an audit summary.
 *   - Audit-logged per file: for every changed row we emit the lesson id,
 *     name, byte/line deltas, the designer-heading lines that triggered
 *     block strips, and the count of inline `(designer: ...)` asides
 *     removed. Optionally writes the full audit to a JSON file.
 *
 * Usage (from /server):
 *   npx tsx scripts/reprocessLessons.ts                # apply changes
 *   npx tsx scripts/reprocessLessons.ts --dry          # preview only
 *   npx tsx scripts/reprocessLessons.ts --only=<id>    # one lesson
 *   npx tsx scripts/reprocessLessons.ts --report=path  # write JSON audit
 *   npx tsx scripts/reprocessLessons.ts --json         # JSON to stdout
 *
 * Or via npm:
 *   npm run lessons:cleanup
 *   npm run lessons:cleanup:dry
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import {
  cleanLessonContentWithAudit,
  type LessonCleanupAudit,
} from "../src/lib/lessonCleanup";

interface LessonRecord {
  lessonId: string;
  name: string;
  audit: LessonCleanupAudit;
  /** "updated" when the row was written, "would-update" in dry-run, "skipped" when unchanged. */
  action: "updated" | "would-update" | "skipped";
}

interface RunReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  onlyId: string | null;
  totals: {
    scanned: number;
    changed: number;
    unchanged: number;
    bytesRemoved: number;
    linesRemoved: number;
    inlineAsidesRemoved: number;
  };
  lessons: LessonRecord[];
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const dryRun =
    process.argv.includes("--dry") || process.argv.includes("--dry-run");
  const jsonStdout = process.argv.includes("--json");
  const onlyId = parseArg("only");
  const reportPath = parseArg("report");

  const startedAt = new Date().toISOString();
  const where = onlyId ? { id: onlyId } : undefined;
  const lessons = await prisma.lesson.findMany({
    where,
    select: { id: true, name: true, content: true },
  });

  if (onlyId && lessons.length === 0) {
    console.error(`No lesson found with id=${onlyId}`);
    await prisma.$disconnect();
    process.exit(2);
  }

  const records: LessonRecord[] = [];
  let changed = 0;
  let unchanged = 0;
  let totalBytes = 0;
  let totalLines = 0;
  let totalInline = 0;

  for (const l of lessons) {
    const { cleaned, audit } = cleanLessonContentWithAudit(l.content);

    if (!audit.changed) {
      unchanged += 1;
      records.push({
        lessonId: l.id,
        name: l.name,
        audit,
        action: "skipped",
      });
      continue;
    }

    changed += 1;
    totalBytes += audit.bytesRemoved;
    totalLines += audit.linesRemoved;
    totalInline += audit.inlineAsidesRemoved;

    let action: LessonRecord["action"] = "would-update";
    if (!dryRun) {
      await prisma.lesson.update({
        where: { id: l.id },
        data: { content: cleaned },
      });
      action = "updated";
    }
    records.push({ lessonId: l.id, name: l.name, audit, action });

    if (!jsonStdout) {
      const headingPreview =
        audit.designerHeadingsMatched.length > 0
          ? `; headings=${JSON.stringify(audit.designerHeadingsMatched.slice(0, 3))}`
          : "";
      const inlinePreview =
        audit.inlineAsidesRemoved > 0
          ? `; inline=${audit.inlineAsidesRemoved}`
          : "";
      console.log(
        `[clean] ${l.name} (${l.id}): -${audit.bytesRemoved}B / -${audit.linesRemoved} lines${headingPreview}${inlinePreview} [${action}]`,
      );
    }
  }

  const finishedAt = new Date().toISOString();
  const report: RunReport = {
    startedAt,
    finishedAt,
    dryRun,
    onlyId: onlyId ?? null,
    totals: {
      scanned: lessons.length,
      changed,
      unchanged,
      bytesRemoved: totalBytes,
      linesRemoved: totalLines,
      inlineAsidesRemoved: totalInline,
    },
    lessons: records,
  };

  if (reportPath) {
    const abs = resolve(reportPath);
    writeFileSync(abs, JSON.stringify(report, null, 2), "utf8");
    if (!jsonStdout) {
      console.log(`\nAudit report written to ${abs}`);
    }
  }

  if (jsonStdout) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const verb = dryRun ? "would be" : "were";
    console.log(
      `\nDone. ${changed} lesson(s) ${verb} updated, ${unchanged} unchanged. ` +
        `Total stripped: ${totalBytes}B / ${totalLines} lines / ${totalInline} inline asides.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
