import path from "node:path";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findDuplicateFestivals } from "@/lib/admin/research/findDuplicateFestivals";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";
import { insertResearchIngestJob } from "@/lib/admin/ingest/insertResearchIngestJob";
import { fetchMcGovListPage } from "@/lib/admin/ingest/mcGov/fetchListPage";
import { parseMcGovListPage, type McGovScrapedEvent } from "@/lib/admin/ingest/mcGov/parseListPage";
import { matchesFestivalKeyword } from "@/lib/admin/ingest/mcGov/keywordFilter";
import { pickDuplicateWithDateGuard } from "@/lib/admin/ingest/mcGov/dedupDateGuard";
import {
  readImportLog,
  writeImportLog,
  hasImportLogEntry,
  setImportLogEntry,
} from "@/lib/admin/ingest/mcGov/importLog";
import { runPrescreen, PRESCREEN_SCORE_THRESHOLD } from "@/lib/admin/ingest/mcGov/prescreen";
import { buildAiResultFromSmartResearch } from "@/lib/admin/ingest/mcGov/buildAiResult";

const LOG_PATH = path.resolve(process.cwd(), "scripts/.mc-gov-import-log.json");

type CliArgs = { from: string; to: string; dryRun: boolean };

function parseArgs(argv: string[]): CliArgs {
  const parsed: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
  }

  const from = typeof parsed.from === "string" ? parsed.from : null;
  const to = typeof parsed.to === "string" ? parsed.to : null;
  if (!from || !to) {
    throw new Error("Usage: mc-gov-import.ts --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]");
  }

  return { from, to, dryRun: Boolean(parsed.dryRun) };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function main(): Promise<void> {
  const { from, to, dryRun } = parseArgs(process.argv.slice(2));
  const log = readImportLog(LOG_PATH);
  const supabase = createSupabaseAdmin();

  const counts = {
    scraped: 0,
    inWindow: 0,
    keywordPass: 0,
    dedupPass: 0,
    prescreenPass: 0,
    inserted: 0,
    errors: 0,
  };

  let page = 1;
  while (true) {
    const html = await fetchMcGovListPage(page);
    const events = parseMcGovListPage(html);
    if (events.length === 0) break;
    counts.scraped += events.length;

    for (const event of events) {
      await processEvent(event, { from, to, dryRun, log, supabase, counts });
    }

    writeImportLog(LOG_PATH, log);
    page += 1;
  }

  writeImportLog(LOG_PATH, log);
  console.log("[mc-gov-import] summary:", counts);
}

async function processEvent(
  event: McGovScrapedEvent,
  ctx: {
    from: string;
    to: string;
    dryRun: boolean;
    log: ReturnType<typeof readImportLog>;
    supabase: ReturnType<typeof createSupabaseAdmin>;
    counts: Record<string, number>;
  },
): Promise<void> {
  const { from, to, dryRun, log, supabase, counts } = ctx;

  if (!event.startDate || event.startDate < from || event.startDate > to) return;
  counts.inWindow += 1;

  if (hasImportLogEntry(log, event.sourceUrl)) return;

  if (!matchesFestivalKeyword(event.title)) {
    setImportLogEntry(log, event.sourceUrl, {
      status: "skipped_not_festival_keyword",
      title: event.title,
      processed_at: nowIso(),
    });
    return;
  }
  counts.keywordPass += 1;

  try {
    const matches = await findDuplicateFestivals({ title: event.title, startDate: event.startDate });
    const duplicate = pickDuplicateWithDateGuard(matches, event.startDate);
    if (duplicate) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "skipped_duplicate",
        title: event.title,
        matched_id: duplicate.id,
        processed_at: nowIso(),
      });
      return;
    }
    counts.dedupPass += 1;

    const prescreen = await runPrescreen(event);
    if (!prescreen || prescreen.score < PRESCREEN_SCORE_THRESHOLD) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "skipped_low_score",
        title: event.title,
        processed_at: nowIso(),
      });
      return;
    }
    counts.prescreenPass += 1;

    if (dryRun) {
      console.log(`[dry-run] would enrich + insert: "${event.title}" (prescreen score ${prescreen.score})`);
      return;
    }

    const query = [event.title, event.locationName].filter(Boolean).join(" ");
    const smart = await runSmartResearchPipeline(query);
    const aiResult = buildAiResultFromSmartResearch(smart);
    const inserted = await insertResearchIngestJob(supabase, { ai_result: aiResult });

    if (!inserted.ok) {
      setImportLogEntry(log, event.sourceUrl, {
        status: "error",
        title: event.title,
        error: inserted.error,
        processed_at: nowIso(),
      });
      counts.errors += 1;
      return;
    }

    setImportLogEntry(log, event.sourceUrl, {
      status: "inserted",
      title: event.title,
      ingest_job_id: inserted.jobId,
      processed_at: nowIso(),
    });
    counts.inserted += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setImportLogEntry(log, event.sourceUrl, { status: "error", title: event.title, error: message, processed_at: nowIso() });
    counts.errors += 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
