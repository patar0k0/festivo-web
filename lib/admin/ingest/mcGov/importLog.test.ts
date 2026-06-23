import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readImportLog,
  writeImportLog,
  hasImportLogEntry,
  setImportLogEntry,
} from "./importLog.js";

function withTempLogPath(run: (logPath: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "mc-gov-import-log-"));
  const logPath = path.join(dir, "log.json");
  try {
    run(logPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("readImportLog returns an empty log when the file does not exist", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    assert.deepEqual(log, { entries: {} });
  });
});

test("setImportLogEntry + writeImportLog + readImportLog round-trips an entry", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    setImportLogEntry(log, "https://mc.government.bg/?p=123", {
      status: "inserted",
      title: "Тест фестивал",
      ingest_job_id: "job-1",
      processed_at: "2026-06-23T10:00:00.000Z",
    });
    writeImportLog(logPath, log);

    const reloaded = readImportLog(logPath);
    assert.equal(hasImportLogEntry(reloaded, "https://mc.government.bg/?p=123"), true);
    assert.equal(reloaded.entries["https://mc.government.bg/?p=123"].status, "inserted");
  });
});

test("hasImportLogEntry returns false for an unseen source_url", () => {
  withTempLogPath((logPath) => {
    const log = readImportLog(logPath);
    assert.equal(hasImportLogEntry(log, "https://mc.government.bg/?p=999"), false);
  });
});
