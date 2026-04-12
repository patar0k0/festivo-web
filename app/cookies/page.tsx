import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const canonical = `${getBaseUrl().replace(/\/$/, "")}/cookies`;

export const metadata: Metadata = {
  title: "Политика за бисквитки",
  description:
    "Информация за бисквитките и подобните технологии, които festivo.bg използва — задължителни, аналитични и маркетингови.",
  alternates: {
    canonical,
  },
  openGraph: {
    title: "Политика за бисквитки · Festivo",
    description:
      "Как festivo.bg използва бисквитки за сесия и предпочитания, опционална аналитика чрез Vercel Analytics, и как да управляваш предпочитанията си.",
    url: canonical,
    siteName: "Festivo",
    locale: "bg_BG",
    type: "website",
  },
};

const listClass = cn(pub.body, "mt-3 list-disc space-y-2 pl-5 marker:text-black/35");

const externalLinkClass = cn(
  "font-semibold text-[#7c2d12] underline decoration-black/20 underline-offset-[3px]",
  "transition hover:decoration-[#7c2d12]/60",
  pub.focusRing,
  "rounded-sm",
);

export default function CookiesPolicyPage() {
  return (
    <div className={cn(pub.pageOverflow, pub.sectionLoose)}>
      <Container>
        <article className="mx-auto max-w-2xl">
          <p className={cn(pub.eyebrowMuted, "leading-relaxed")}>Festivo.bg</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Политика за бисквитки</h1>
          <p className={cn(pub.body, "mt-5 leading-relaxed")}>
            Тази страница обяснява какво са бисквитките, защо ги използваме и как можеш да ги управляваш. Тя се отнася
            за уебсайта{" "}
            <Link href="/" className={externalLinkClass}>
              festivo.bg
            </Link>
            .
          </p>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">Какво са бисквитките?</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Бисквитките са малки текстови файлове, които браузърът ти запазва на устройството, когато посещаваш сайт.
              Те помагат сайтът да помни сесията ти, настройките ти и (когато е приложимо) да разбере как се ползва
              страницата или дали рекламите достигат до хората. Част от технологиите са подобни на бисквитки
              (например локално съхранение) и по-долу ги обхващаме заедно като „бисквитки“ в широк смисъл.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">Какви бисквитки използва festivo.bg?</h2>

            <h3 className={cn(pub.sectionTitleMd, "mt-6")}>Задължителни</h3>
            <p className={cn(pub.body, "mt-2 leading-relaxed")}>
              Нужни са, за да работи сайтът безопасно и според избора ти:
            </p>
            <ul className={listClass}>
              <li>
                <span className="font-semibold text-[#0c0e14]/88">Сесия и автентикация</span> — поддържане на входа и
                защита на акаунта чрез Supabase Auth (например сесионни маркери).
              </li>
              <li>
                <span className="font-semibold text-[#0c0e14]/88">Предпочитания</span> — запомняне на настройки,
                които изрично избираш на сайта (например език или режим на преглед, когато са налични).
              </li>
            </ul>

            <h3 className={cn(pub.sectionTitleMd, "mt-8")}>Аналитични</h3>
            <p className={cn(pub.body, "mt-2 leading-relaxed")}>
              Помагат ни да разберем агрегирано как се ползва сайтът (например посещения и навигация), за да го
              подобряваме:
            </p>
            <ul className={listClass}>
              <li>
                <span className="font-semibold text-[#0c0e14]/88">Vercel Analytics</span> — анонимизирана статистика
                за посещения (без лични данни).
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">Как да управляваш или изключиш бисквитките?</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Можеш по всяко време да изчистиш или блокираш бисквитки от настройките на браузъра си. Имай предвид, че
              изключването на задължителните бисквитки може да влоши входа, сигурността или някои функции на сайта.
            </p>
            <p className={cn(pub.body, "mt-4 leading-relaxed")}>
              За аналитика и реклама можеш да ползваш и официалните инструменти за отказ (opt-out), където са налични:
            </p>
            <ul className={listClass}>
              <li>
                Google —{" "}
                <a
                  className={externalLinkClass}
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  добавка за браузър за отказ от Google Analytics
                </a>
                ; персонализация на реклами в Google —{" "}
                <a
                  className={externalLinkClass}
                  href="https://adssettings.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  настройки за реклами на Google
                </a>
                .
              </li>
              <li>
                Meta —{" "}
                <a
                  className={externalLinkClass}
                  href="https://www.facebook.com/settings?tab=ads"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  настройки за реклами във Facebook
                </a>{" "}
                (включително информация за реклами, базирани на данни от партньори).
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">Контакт за въпроси</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Ако имаш въпроси относно бисквитките или тази политика, пиши ни през контактната форма на{" "}
              <Link href="/" className={externalLinkClass}>
                festivo.bg
              </Link>
              . Формата е в подвалa на сайта — секция „За организатори“, връзка „Контакт“.
            </p>
          </section>

          <p className={cn(pub.caption, "mt-12 border-t border-black/[0.08] pt-6 leading-relaxed")}>
            Последна актуализация: април 2026
          </p>
        </article>
      </Container>
    </div>
  );
}
