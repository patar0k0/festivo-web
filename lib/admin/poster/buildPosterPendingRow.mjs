import { resolveEventYear } from "./resolveMissingYear.mjs";

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Date components → "YYYY-MM-DD" (year resolved if missing), or null. */
export function isoFromComponents(comp, today) {
  if (!comp || typeof comp.day !== "number" || typeof comp.month !== "number") return null;
  const resolved = resolveEventYear({
    day: comp.day,
    month: comp.month,
    weekday: comp.weekday ?? null,
    explicitYear: comp.year_explicit ? comp.year ?? null : null,
    today,
  });
  return `${resolved.year}-${pad(comp.month)}-${pad(comp.day)}`;
}

/** Zod program ({days:[{day,month,title,items}]}) → Gemini program shape with ISO dates. */
export function programToGeminiShape(program, festivalYear) {
  if (!program || !Array.isArray(program.days) || program.days.length === 0) return null;
  const days = [];
  for (const d of program.days) {
    if (typeof d.day !== "number" || typeof d.month !== "number") continue;
    days.push({
      date: `${festivalYear}-${pad(d.month)}-${pad(d.day)}`,
      title: d.title ?? null,
      items: Array.isArray(d.items) ? d.items : [],
    });
  }
  return days.length ? { days } : null;
}

export function contactNote(contact) {
  const person = contact?.person?.trim?.() || "";
  const phone = contact?.phone?.trim?.() || "";
  if (!person && !phone) return "";
  return `За информация: ${[person, phone].filter(Boolean).join(", ")}`;
}
