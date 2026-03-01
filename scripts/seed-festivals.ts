import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

type FestivalSeed = {
  title: string;
  slug: string;
  description: string;
  city: string;
  region: string;
  start_date: string;
  end_date?: string;
  category: "music" | "folk" | "arts" | "food" | "cultural" | "sports" | "film" | "theater";
  is_free: boolean;
  status: "verified";
  is_verified: true;
  lat: number;
  lng: number;
  tags: string[];
  website_url?: string;
  image_url?: string;
  price_range?: string;
  ticket_url?: string;
};

function loadEnvFromDotenvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const festivals: FestivalSeed[] = [
  {
    title: "Пловдивски панаир",
    slug: "plovdiv-international-fair-2026",
    description:
      "Пловдивският панаир е едно от най-големите изложбени събития в Югоизточна Европа. Събира бизнес, иновации и международни участници от различни индустрии. Програмата включва презентации, B2B срещи и тематични дни за широката публика.",
    city: "Пловдив",
    region: "Пловдивска",
    start_date: "2026-09-21",
    end_date: "2026-09-27",
    category: "cultural",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.1354,
    lng: 24.7453,
    tags: ["изложение", "бизнес", "международно"],
    website_url: "https://fair.bg",
    image_url: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800",
    price_range: "10-30 лв.",
    ticket_url: "https://fair.bg",
  },
  {
    title: "Spirit of Burgas",
    slug: "spirit-of-burgas-2026",
    description:
      "Spirit of Burgas е емблематичен морски музикален фестивал с електронна, рок и поп сцена. Провежда се в края на лятото и привлича публика от цялата страна. Концертите често са на открито край плажа с късни сетове.",
    city: "Бургас",
    region: "Бургаска",
    start_date: "2026-08-14",
    end_date: "2026-08-16",
    category: "music",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.5048,
    lng: 27.4626,
    tags: ["музика", "лято", "море"],
    website_url: "https://spiritofburgas.com",
    image_url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800",
    price_range: "120-220 лв.",
    ticket_url: "https://spiritofburgas.com",
  },
  {
    title: "Hills of Rock",
    slug: "hills-of-rock-2026",
    description:
      "Hills of Rock е голям рок и метъл фестивал в Пловдив с няколко сцени и международни хедлайнери. Събитието събира фенове от България и Балканите. Освен концерти има зони за храна, мърч и активности.",
    city: "Пловдив",
    region: "Пловдивска",
    start_date: "2026-06-26",
    end_date: "2026-06-28",
    category: "music",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.1354,
    lng: 24.7453,
    tags: ["рок", "метъл", "открито"],
    website_url: "https://hillsofrock.com",
    image_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
    price_range: "150-300 лв.",
    ticket_url: "https://hillsofrock.com",
  },
  {
    title: "SofiaLive Festival",
    slug: "sofialive-festival-2026",
    description:
      "SofiaLive Festival представя съвременна музика с артисти от Европа и света. Концертите са в централни градски пространства и зали в София. Фестивалът комбинира дневни и вечерни изпълнения с градска атмосфера.",
    city: "София",
    region: "София-град",
    start_date: "2026-06-19",
    end_date: "2026-06-21",
    category: "music",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.6977,
    lng: 23.3219,
    tags: ["музика", "градски", "концерти"],
    website_url: "https://sofialivefest.com",
    image_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800",
    price_range: "80-180 лв.",
    ticket_url: "https://sofialivefest.com",
  },
  {
    title: "Празници на изкуствата Аполония",
    slug: "apollonia-arts-festival-2026",
    description:
      "Аполония е водещ културен форум в Созопол с музика, театър, литература и кино. В продължение на дни градът се превръща в сцена за български творци и гости. Събитията са в различни исторически и открити пространства.",
    city: "Созопол",
    region: "Бургаска",
    start_date: "2026-09-01",
    end_date: "2026-09-10",
    category: "arts",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.4178,
    lng: 27.696,
    tags: ["изкуства", "култура", "море"],
    website_url: "https://apollonia.bg",
    image_url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800",
    price_range: "20-100 лв.",
    ticket_url: "https://apollonia.bg",
  },
  {
    title: "Роженски събор",
    slug: "rozhen-national-folk-festival-2026",
    description:
      "Роженският събор е мащабен фолклорен празник в Родопите с гайди, народни песни и танци. На поляните се представят състави от цялата страна. Фестивалът подчертава традиционния бит и родопската култура.",
    city: "Родопи",
    region: "Смолянска",
    start_date: "2026-07-17",
    end_date: "2026-07-19",
    category: "folk",
    is_free: true,
    status: "verified",
    is_verified: true,
    lat: 41.7,
    lng: 24.7,
    tags: ["фолклор", "гайди", "традиции"],
    website_url: "https://rozhen.bg",
    image_url: "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=800",
    price_range: "Безплатен",
  },
  {
    title: "Национален събор на народното творчество Копривщица",
    slug: "koprivshtitsa-folk-festival-2025",
    description:
      "Националният събор в Копривщица се провежда традиционно през пет години и събира хиляди изпълнители. Представят се автентични песни, танци, обичаи и занаяти от всички етнографски области. Това е едно от най-значимите фолклорни събития в България.",
    city: "Копривщица",
    region: "Софийска",
    start_date: "2025-08-08",
    end_date: "2025-08-10",
    category: "folk",
    is_free: true,
    status: "verified",
    is_verified: true,
    lat: 42.6386,
    lng: 24.3619,
    tags: ["фолклор", "традиции", "национален"],
    website_url: "https://koprivshtitsa.bg",
    image_url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
    price_range: "Безплатен",
  },
  {
    title: "International Jazz Festival Bansko",
    slug: "bansko-jazz-festival-2026",
    description:
      "Джаз фестивалът в Банско е международно събитие с концерти на открито и клубна програма. На сцената участват утвърдени джаз музиканти и нови формации. Атмосферата съчетава планина, лято и богата музикална селекция.",
    city: "Банско",
    region: "Благоевградска",
    start_date: "2026-08-01",
    end_date: "2026-08-10",
    category: "music",
    is_free: true,
    status: "verified",
    is_verified: true,
    lat: 41.8394,
    lng: 23.4883,
    tags: ["джаз", "планина", "лято"],
    website_url: "https://banskojazzfest.bg",
    image_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800",
    price_range: "Безплатен",
  },
  {
    title: "Varna Summer International Music Festival",
    slug: "varna-summer-music-festival-2026",
    description:
      "Варненско лято е най-старият международен музикален фестивал в България. Програмата включва симфонични концерти, камерна музика и оперни продукции. Събитията се провеждат в рамките на цялото лято.",
    city: "Варна",
    region: "Варненска",
    start_date: "2026-06-20",
    end_date: "2026-08-31",
    category: "music",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 43.2141,
    lng: 27.9147,
    tags: ["класическа музика", "опера", "лято"],
    website_url: "https://varnasummerfest.org",
    image_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800",
    price_range: "15-120 лв.",
    ticket_url: "https://varnasummerfest.org",
  },
  {
    title: "Сурва – Международен фестивал на маскарадните игри",
    slug: "surva-masquerade-festival-2026",
    description:
      "Сурва в Перник е международен фестивал, посветен на маскарадните традиции и кукерските игри. Групи от България и чужбина дефилират с впечатляващи костюми и маски. Събитието съхранява обичаи, свързани с прогонване на злото и ново начало.",
    city: "Перник",
    region: "Пернишка",
    start_date: "2026-01-23",
    end_date: "2026-01-25",
    category: "folk",
    is_free: true,
    status: "verified",
    is_verified: true,
    lat: 42.6053,
    lng: 23.0383,
    tags: ["кукери", "маски", "традиции"],
    website_url: "https://surva.org",
    image_url: "https://images.unsplash.com/photo-1578926288207-32356a1099a4?w=800",
    price_range: "Безплатен",
  },
  {
    title: "Balkan Folklore Festival",
    slug: "balkan-folklore-festival-2026",
    description:
      "Balkan Folklore Festival е международна програма с фолклорни изпълнения в няколко български града. Участват танцови и певчески състави от различни държави. Фестивалът създава културен обмен и сценични срещи през летния сезон.",
    city: "Варна",
    region: "Варненска",
    start_date: "2026-07-05",
    end_date: "2026-07-09",
    category: "folk",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 43.2141,
    lng: 27.9147,
    tags: ["балкани", "фолклор", "международен"],
    website_url: "https://balkanfolkfest.com",
    image_url: "https://images.unsplash.com/photo-1469122312224-c5846569feb1?w=800",
    price_range: "15-40 лв.",
    ticket_url: "https://balkanfolkfest.com",
  },
  {
    title: "Kapana Fest",
    slug: "kapana-fest-spring-2026",
    description:
      "Капана Фест събира дизайн, ръчно изработени продукти, музика и градска култура в квартал Капана. Фестивалът се провежда няколко пъти годишно и активира малките улици и дворове. Посетителите откриват местни артисти, храна и творчески работилници.",
    city: "Пловдив",
    region: "Пловдивска",
    start_date: "2026-05-15",
    end_date: "2026-05-17",
    category: "arts",
    is_free: true,
    status: "verified",
    is_verified: true,
    lat: 42.1354,
    lng: 24.7453,
    tags: ["дизайн", "арт", "градска култура"],
    website_url: "https://kapanfest.bg",
    image_url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
    price_range: "Безплатен",
  },
  {
    title: "ONE DANCE WEEK",
    slug: "one-dance-week-2026",
    description:
      "ONE DANCE WEEK е международен фестивал за съвременен танц и пърформанс в Пловдив. Програмата включва спектакли, срещи с артисти и съпътстващи формати. Фестивалът представя силна селекция от български и чуждестранни продукции.",
    city: "Пловдив",
    region: "Пловдивска",
    start_date: "2026-10-02",
    end_date: "2026-10-11",
    category: "arts",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.1354,
    lng: 24.7453,
    tags: ["танц", "съвременно изкуство", "пърформанс"],
    website_url: "https://onedanceweek.com",
    image_url: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800",
    price_range: "20-70 лв.",
    ticket_url: "https://onedanceweek.com",
  },
  {
    title: "Night/Chaos Festival Sofia",
    slug: "night-chaos-festival-sofia-2026",
    description:
      "Night/Chaos Festival Sofia е градски електронен фестивал с дневни и нощни сетове. Акцентът е върху съвременната клубна сцена и аудиовизуални преживявания. Събитието обединява локални и международни DJ артисти.",
    city: "София",
    region: "София-град",
    start_date: "2026-09-12",
    end_date: "2026-09-13",
    category: "music",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.6977,
    lng: 23.3219,
    tags: ["електронна музика", "нощен живот", "клубна сцена"],
    website_url: "https://nightchaos.com",
    image_url: "https://images.unsplash.com/photo-1571266028243-d220c9adf418?w=800",
    price_range: "60-140 лв.",
    ticket_url: "https://nightchaos.com",
  },
  {
    title: "Sofia Film Fest",
    slug: "sofia-film-fest-2026",
    description:
      "Sofia Film Fest е международен кино фестивал с богата конкурсна и панорамна програма. Прожекциите са в различни кина и културни пространства в столицата. Събитието включва премиери, срещи с автори и професионални панели.",
    city: "София",
    region: "София-град",
    start_date: "2026-03-12",
    end_date: "2026-03-31",
    category: "film",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.6977,
    lng: 23.3219,
    tags: ["кино", "премиери", "авторско кино"],
    website_url: "https://siff.bg",
    image_url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",
    price_range: "12-25 лв.",
    ticket_url: "https://siff.bg",
  },
  {
    title: "София фестивал на науката",
    slug: "sofia-science-festival-2026",
    description:
      "Софийският фестивал на науката представя лекции, демонстрации и интерактивни формати за всички възрасти. Фокусът е върху достъпната комуникация на наука и технологии. Събитието включва международни гости и български изследователи.",
    city: "София",
    region: "София-град",
    start_date: "2026-05-07",
    end_date: "2026-05-10",
    category: "cultural",
    is_free: false,
    status: "verified",
    is_verified: true,
    lat: 42.6977,
    lng: 23.3219,
    tags: ["наука", "образование", "технологии"],
    website_url: "https://beautifulscience.bg",
    image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800",
    price_range: "5-20 лв.",
    ticket_url: "https://beautifulscience.bg",
  },
];

async function run() {
  loadEnvFromDotenvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const festival of festivals) {
    const { error } = await supabase
      .from("festivals")
      .upsert(festival, { onConflict: "slug" });

    if (error) {
      throw new Error(`Upsert failed for "${festival.title}" (${festival.slug}): ${error.message}`);
    }

    console.log(`Upserted festival: ${festival.title}`);
  }

  console.log(`Done. Seeded ${festivals.length} festivals.`);
}

run().catch((error) => {
  console.error("Festival seeding failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
