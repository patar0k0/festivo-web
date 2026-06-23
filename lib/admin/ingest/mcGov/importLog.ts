import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type ImportLogStatus =
  | "inserted"
  | "skipped_duplicate"
  | "skipped_low_score"
  | "skipped_not_festival_keyword"
  | "error";

export type ImportLogEntry = {
  status: ImportLogStatus;
  title?: string;
  ingest_job_id?: string;
  matched_id?: string;
  error?: string;
  processed_at: string;
};

export type ImportLog = {
  entries: Record<string, ImportLogEntry>;
};

export function readImportLog(logPath: string): ImportLog {
  if (!existsSync(logPath)) return { entries: {} };

  try {
    const raw = readFileSync(logPath, "utf-8");
    const parsed = JSON.parse(raw) as ImportLog;
    if (!parsed.entries || typeof parsed.entries !== "object") return { entries: {} };
    return parsed;
  } catch {
    return { entries: {} };
  }
}

export function writeImportLog(logPath: string, log: ImportLog): void {
  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
}

export function hasImportLogEntry(log: ImportLog, sourceUrl: string): boolean {
  return Object.prototype.hasOwnProperty.call(log.entries, sourceUrl);
}

export function setImportLogEntry(log: ImportLog, sourceUrl: string, entry: ImportLogEntry): void {
  log.entries[sourceUrl] = entry;
}
