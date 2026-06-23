import * as cheerio from "cheerio";

export type McGovScrapedEvent = {
  postId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  locationName: string | null;
  organizerName: string | null;
  sourceUrl: string;
};

const POST_ID_CLASS_RE = /\be-loop-item-(\d+)\b/;
const DATE_PROVEJDANE_RE = /Дата на провеждане:\s*([\d.]{8,10})\s*-\s*([\d.]{8,10})/;
const DATE_SHTE_SE_RE = /Ще се проведе на\s*([\d.-]{8,10})\s*до\s*([\d.-]{8,10})/;

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();

  const dmy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parses one mc.gov.bg event-calendar list page. Two card templates exist on
 * the live site (confirmed by fetching both during planning): one splits the
 * date across two heading widgets ("Дата на провеждане: X -" + "Y"), the
 * other puts both dates in one "Ще се проведе на X до Y" string. Location and
 * organizer text is read directly from the relevant <p> elements rather than
 * a joined-text regex, since joined text concatenation across sibling tags is
 * not reliably whitespace-separated.
 */
export function parseMcGovListPage(html: string): McGovScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: McGovScrapedEvent[] = [];

  $('[data-elementor-type="loop-item"]').each((_, el) => {
    const node = $(el);
    const classAttr = node.attr("class") ?? "";
    const postIdMatch = classAttr.match(POST_ID_CLASS_RE);
    if (!postIdMatch) return;
    const postId = postIdMatch[1];

    const headingTexts = node
      .find(".elementor-heading-title")
      .map((__, h) => $(h).text().trim())
      .toArray();
    const title = headingTexts[0] ?? "";
    if (!title) return;

    const dateText = headingTexts.slice(1).join(" ");
    let startDate: string | null = null;
    let endDate: string | null = null;
    const provejdaneMatch = dateText.match(DATE_PROVEJDANE_RE);
    const shteSeMatch = dateText.match(DATE_SHTE_SE_RE);
    if (provejdaneMatch) {
      startDate = normalizeDate(provejdaneMatch[1]);
      endDate = normalizeDate(provejdaneMatch[2]);
    } else if (shteSeMatch) {
      startDate = normalizeDate(shteSeMatch[1]);
      endDate = normalizeDate(shteSeMatch[2]);
    }

    let locationName: string | null = null;
    let organizerName: string | null = null;
    node.find(".elementor-widget-theme-post-content p").each((__, p) => {
      const text = $(p).text().trim();
      if (text.startsWith("Място:")) {
        locationName = text.slice("Място:".length).trim();
      } else if (text.startsWith("Организатор:")) {
        organizerName = text.slice("Организатор:".length).trim();
      }
    });

    events.push({
      postId,
      title,
      startDate,
      endDate,
      locationName,
      organizerName,
      sourceUrl: `https://mc.government.bg/?p=${postId}`,
    });
  });

  return events;
}
