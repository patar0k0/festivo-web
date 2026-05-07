const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function getSofiaOffset(date: Date) {
  const partsUTC = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const partsSofia = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  function toMillis(parts: Intl.DateTimeFormatPart[]) {
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }

    return Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
  }

  const utcMillis = toMillis(partsUTC);
  const sofiaMillis = toMillis(partsSofia);

  return (sofiaMillis - utcMillis) / 60000;
}

function parseInputDate(input: string | Date): Date {
  if (input instanceof Date) return input;

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const offset = getSofiaOffset(utc);
    return new Date(utc.getTime() - offset * 60000);
  }

  return new Date(input);
}

function partsToDate(parts: Intl.DateTimeFormatPart[]) {
  const map: Record<string, string> = {};

  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const utcDate = new Date(
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    ),
  );

  const offset = getSofiaOffset(utcDate);

  return new Date(utcDate.getTime() - offset * 60000);
}

export function toSofiaDate(input: string | Date) {
  const d = parseInputDate(input);
  return partsToDate(formatter.formatToParts(d));
}

export function endOfDaySofia(input: string | Date) {
  const d = parseInputDate(input);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const utcDate = new Date(
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      23,
      59,
      59,
      999,
    ),
  );

  const offset = getSofiaOffset(utcDate);

  return new Date(utcDate.getTime() - offset * 60000);
}

export function nowSofia() {
  return toSofiaDate(new Date());
}
