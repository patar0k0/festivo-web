import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";

/**
 * Начална FAQ секция.
 *
 * Двойна цел:
 *  - SEO: разгърнат, постоянен текст в HTML (вдига text-to-code ratio и word
 *    count) + `FAQPage` JSON-LD за rich snippet в Google.
 *  - UX: native `<details>` accordion — без JS, достъпен, индексируем (текстът
 *    е в DOM дори когато панелът е затворен).
 *
 * `answer` се ползва ЕДНОВРЕМЕННО за видимия текст и за schema.org текста, за да
 * не се разминават. Затова го дръж като чист текст; линкове добавяй през `cta`.
 */
type FaqItem = {
  question: string;
  answer: string;
  cta?: { label: string; href: string };
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Как да намеря фестивали в моя град?",
    answer:
      "Използвай търсачката на началната страница или отвори страницата с фестивали, за да филтрираш по град, дата и интерес. Може да избереш конкретно населено място и да видиш само събитията около теб, както и бързо да разгледаш кои фестивали се случват този уикенд или този месец.",
    cta: { label: "Виж всички фестивали", href: "/festivals" },
  },
  {
    question: "Festivo безплатен ли е?",
    answer:
      "Да. Разглеждането на каталога, търсенето по град и дата и планирането на фестивали са напълно безплатни. Festivo е с фокус върху достъпни събития в България — с един клик можеш да филтрираш и само безплатните фестивали.",
  },
  {
    question: "Откъде идват събитията в Festivo?",
    answer:
      "Всеки фестивал минава през ръчна проверка, преди да се появи в каталога. Събитията идват от два източника: организатори, които добавят своите фестивали през организаторския портал, и проверени публични източници. Целта е да виждаш само реални, потвърдени събития.",
  },
  {
    question: "Мога ли да получавам напомняния за фестивали?",
    answer:
      "Да. Можеш да запазиш фестивали в своя план и да получаваш напомняния преди началото им. За най-пълно преживяване с напомняния и известия в реално време използвай мобилното приложение на Festivo.",
  },
  {
    question: "Какви видове фестивали ще намеря?",
    answer:
      "Каталогът покрива широк спектър събития в цяла България — фолклорни, музикални, винени, кулинарни, културни и сезонни фестивали. Можеш да филтрираш по категория, за да стесниш резултатите до това, което те интересува.",
  },
  {
    question: "Организатор съм — как да добавя своя фестивал?",
    answer:
      "Регистрирай се през организаторския портал и заяви или създай профил на организатор. След преглед от екипа ни можеш да добавяш и управляваш своите фестивали. Всички заявки минават през одобрение, за да се запази качеството на каталога.",
    cta: { label: "Към организаторите", href: "/organizer" },
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqSection() {
  return (
    <section id="home-faq" className={cn(pub.panelMuted, "p-5 md:p-6")}>
      <h2 className={cn(pub.pageTitle, "text-2xl")}>Често задавани въпроси</h2>
      <p className={cn(pub.body, "mt-2 max-w-2xl")}>
        Всичко за това как да откриваш, планираш и посещаваш фестивалите в България с Festivo.
      </p>

      <div className="mt-4 divide-y divide-black/[0.07]">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold text-[#0c0e14] [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="flex-shrink-0 text-amber-900/55 transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="pb-4 pr-7">
              <p className={cn(pub.body, "leading-relaxed")}>{item.answer}</p>
              {item.cta ? (
                <Link
                  href={item.cta.href}
                  className={cn(pub.linkInline, pub.focusRing, "mt-2 inline-block text-sm")}
                >
                  {item.cta.label} →
                </Link>
              ) : null}
            </div>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </section>
  );
}
