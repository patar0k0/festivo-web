import { geminiExtractJson } from "@/lib/admin/research/gemini-provider";
import type { FestivalSettlementType } from "@/lib/settlements/settlementType";

export type GeminiProgramDayRaw = {
  date: string | null;
  title: string | null;
  items: Array<{
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    stage: string | null;
    description: string | null;
  }> | null;
};

export type GeminiRawExtraction = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  /** HH:mm local start clock if explicitly stated; otherwise null */
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  /** When the text clearly indicates град / село / курорт (к.к.); null if not confident. */
  settlement_type: FestivalSettlementType | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  /** When multiple organizers are stated, list each separately (no comma-joined stuffing). */
  organizer_names: string[] | null;
  description: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  is_free: boolean | null;
  category: string | null;
  tags: string[] | null;
  /**
   * Optional day-by-day program when the evidence text lists times/lines clearly.
   * Evidence-only; null when no structured program is stated.
   */
  program: { days: GeminiProgramDayRaw[] | null } | null;
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    start_date: { type: "string", nullable: true },
    end_date: { type: "string", nullable: true },
    start_time: { type: "string", nullable: true },
    end_time: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    settlement_type: { type: "string", enum: ["city", "village", "resort"], nullable: true },
    location_name: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    organizer_name: { type: "string", nullable: true },
    organizer_names: { type: "array", items: { type: "string" }, nullable: true },
    description: { type: "string", nullable: true },
    website_url: { type: "string", nullable: true },
    facebook_url: { type: "string", nullable: true },
    instagram_url: { type: "string", nullable: true },
    ticket_url: { type: "string", nullable: true },
    hero_image: { type: "string", nullable: true },
    is_free: { type: "boolean", nullable: true },
    category: { type: "string", nullable: true },
    tags: { type: "array", items: { type: "string" }, nullable: true },
    program: {
      type: "object",
      nullable: true,
      properties: {
        days: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            properties: {
              date: { type: "string", nullable: true },
              title: { type: "string", nullable: true },
              items: {
                type: "array",
                nullable: true,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", nullable: true },
                    start_time: { type: "string", nullable: true },
                    end_time: { type: "string", nullable: true },
                    stage: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                  },
                  required: ["title", "start_time", "end_time", "stage", "description"],
                },
              },
            },
            required: ["date", "title", "items"],
          },
        },
      },
      required: ["days"],
    },
  },
  required: [
    "title",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "city",
    "settlement_type",
    "location_name",
    "address",
    "organizer_name",
    "organizer_names",
    "description",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "hero_image",
    "is_free",
    "category",
    "tags",
    "program",
  ],
};

const SYSTEM = `Ти извличаш структурирани данни за български фестивал САМО от предоставения текст (доказателство).
Правила:
- Използвай САМО информация, явно подкрепена от текста. Не измисляй факти.
- Непознато или непотвърдено → null (или празен масив за tags).
- Дати само във формат YYYY-MM-DD ако са ясни от текста; иначе null.
- Часове само като HH:mm (24h) ако са изрично в текста; иначе null. Не измисляй часове.
- Кратко описание на български (до 4 изречения) само ако се поддържа от текста.
- Ако има няколко отделни организатора, попълни organizer_names с всеки поотделно; organizer_name може да е първият или null.
- URL полета: само ако се появяват като връзки или ясно в текста; иначе null.
- is_free: true само ако текстъе изрично сочи безплатно/вход свободен; иначе null или false ако има такса.
- program: попълни само ако в текста има ясна програма по дни (часове + заглавия/артисти). Поле program.days: масив от дни с date (YYYY-MM-DD) и items с title; start_time/end_time като HH:mm само ако са изрично в текста; stage/description само от текста. Ако няма структурирана програма → program=null.
- settlement_type: попълни САМО ако типът на населеното място е ясен от текста — city за „град“/гр.; village за „село“/с.; resort за „курорт“, „к.к.“, курортен комплекс. Ако не си сигурен → null. Не гадай.`;

export async function extractFestivalFieldsFromEvidence(input: {
  userQuery: string;
  sourceUrl: string;
  pageTitle: string;
  excerpt: string;
}): Promise<GeminiRawExtraction> {
  const userText = JSON.stringify(
    {
      user_query: input.userQuery,
      source_url: input.sourceUrl,
      page_title: input.pageTitle,
      evidence_text: input.excerpt.slice(0, 24_000),
    },
    null,
    0,
  );

  const withProgram = (row: GeminiRawExtraction): GeminiRawExtraction => ({
    ...row,
    program: row.program ?? null,
    settlement_type: row.settlement_type ?? null,
  });

  try {
    return withProgram(
      await geminiExtractJson<GeminiRawExtraction>({
        systemInstruction: SYSTEM,
        userText,
        responseSchema: EXTRACTION_SCHEMA,
      }),
    );
  } catch {
    return withProgram(
      await geminiExtractJson<GeminiRawExtraction>({
        systemInstruction: SYSTEM,
        userText,
      }),
    );
  }
}
