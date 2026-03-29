import { geminiExtractJson } from "@/lib/admin/research/gemini-provider";

export type GeminiRawExtraction = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  description: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  is_free: boolean | null;
  category: string | null;
  tags: string[] | null;
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    start_date: { type: "string", nullable: true },
    end_date: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    location_name: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    organizer_name: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    website_url: { type: "string", nullable: true },
    facebook_url: { type: "string", nullable: true },
    instagram_url: { type: "string", nullable: true },
    ticket_url: { type: "string", nullable: true },
    hero_image: { type: "string", nullable: true },
    is_free: { type: "boolean", nullable: true },
    category: { type: "string", nullable: true },
    tags: { type: "array", items: { type: "string" }, nullable: true },
  },
  required: [
    "title",
    "start_date",
    "end_date",
    "city",
    "location_name",
    "address",
    "organizer_name",
    "description",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "hero_image",
    "is_free",
    "category",
    "tags",
  ],
};

const SYSTEM = `Ти извличаш структурирани данни за български фестивал САМО от предоставения текст (доказателство).
Правила:
- Използвай САМО информация, явно подкрепена от текста. Не измисляй факти.
- Непознато или непотвърдено → null (или празен масив за tags).
- Дати само във формат YYYY-MM-DD ако са ясни от текста; иначе null.
- Кратко описание на български (до 4 изречения) само ако се поддържа от текста.
- URL полета: само ако се появяват като връзки или ясно в текста; иначе null.
- is_free: true само ако текстъе изрично сочи безплатно/вход свободен; иначе null или false ако има такса.`;

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

  try {
    return await geminiExtractJson<GeminiRawExtraction>({
      systemInstruction: SYSTEM,
      userText,
      responseSchema: EXTRACTION_SCHEMA,
    });
  } catch {
    return geminiExtractJson<GeminiRawExtraction>({
      systemInstruction: SYSTEM,
      userText,
    });
  }
}
