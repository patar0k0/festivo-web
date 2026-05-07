const BG_CITIES = [
  "софия",
  "пловдив",
  "варна",
  "бургас",
  "русе",
  "стара загора",
  "плевен",
  "велико търново",
  "шумен",
  "враца",
] as const;

function isValidYmd(y: number, m: number, d: number): boolean {
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

export function inferIsFree(text?: string | null): boolean {
  if (!text) return false;

  const t = text.toLowerCase();

  if (
    t.includes("вход свободен") ||
    t.includes("безплатен") ||
    t.includes("безплатно") ||
    t.includes("free entry") ||
    t.includes("free entrance")
  )
    return true;

  return false;
}

export function inferDateRange(text?: string | null): {
  start_date?: string;
  end_date?: string;
} {
  if (!text) return {};

  const match = text.match(/(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})/);

  if (!match) return {};

  const [, d, m, y] = match;
  const yi = Number(y);
  const mi = Number(m);
  const di = Number(d);
  if (!isValidYmd(yi, mi, di)) return {};

  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

  return {
    start_date: iso,
    end_date: iso,
  };
}

export function inferCity(text?: string | null): string | null {
  if (!text) return null;

  const t = text.toLowerCase();

  const sorted = [...BG_CITIES].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    if (t.includes(city)) {
      return city;
    }
  }

  return null;
}

/** Set `FESTIVO_INGEST_DEBUG=1` to log inferred fields (server/worker only). */
export function ingestDebugLog(
  level: string,
  tag: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (process.env.FESTIVO_INGEST_DEBUG !== "1") return;
  const line = { level, tag, message, ...(meta ?? {}) };
  if (level === "warn") console.warn(line);
  else console.log(line);
}
