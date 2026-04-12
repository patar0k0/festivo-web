import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const canonical = `${getBaseUrl().replace(/\/$/, "")}/privacy`;

export const metadata: Metadata = {
  title: "Политика за поверителност",
  description:
    "Как festivo.bg събира, обработва и защитава личните данни — GDPR основания, трети страни, права на субектите и контакт.",
  alternates: {
    canonical,
  },
  openGraph: {
    title: "Политика за поверителност · Festivo",
    description:
      "Информация за обработката на лични данни в платформата festivo.bg — основания, доставчици, срокове и твоите права.",
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

export default function PrivacyPolicyPage() {
  return (
    <div className={cn(pub.pageOverflow, pub.sectionLoose)}>
      <Container>
        <article className="mx-auto max-w-2xl">
          <p className={cn(pub.eyebrowMuted, "leading-relaxed")}>Festivo.bg</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Политика за поверителност</h1>
          <p className={cn(pub.body, "mt-5 leading-relaxed")}>В сила от: 12 април 2026 г.</p>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">1. Администратор на данни</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg |{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">2. Какви данни събираме</h2>
            <ul className={listClass}>
              <li>Имейл адрес</li>
              <li>Име (ако е предоставено)</li>
              <li>Потребителски предпочитания</li>
              <li>IP адрес и device информация</li>
              <li>Логове за сигурност и анти-абуз защита</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">3. Правно основание (GDPR Art. 6)</h2>
            <ul className={listClass}>
              <li>Изпълнение на договор – акаунт и основни функции</li>
              <li>Легитимен интерес – сигурност, анти-фрод, подобрения</li>
              <li>Съгласие – маркетинг, аналитика, cookies</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">4. Трети страни и обработващи</h2>
            <ul className={listClass}>
              <li>Supabase – база данни и authentication</li>
              <li>Vercel – хостинг и инфраструктура</li>
              <li>Resend – имейл нотификации</li>
              <li>Vercel Analytics – анонимизирана статистика</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">5. Трансфер на данни извън ЕС</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Част от доставчиците ни могат да обработват данни извън ЕС (включително САЩ). В тези случаи се прилагат
              Standard Contractual Clauses (SCC) съгласно GDPR.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">6. Защо обработваме данните</h2>
            <ul className={listClass}>
              <li>Създаване и поддръжка на акаунти</li>
              <li>Персонализиране на съдържание</li>
              <li>Изпращане на нотификации</li>
              <li>Сигурност и предотвратяване на злоупотреби</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">7. Бисквитки и проследяване</h2>
            <ul className={listClass}>
              <li>Задължителни cookies – функционалност</li>
              <li>Аналитични cookies – поведение в платформата</li>
              <li>Маркетинг cookies – реклами (ако се използват)</li>
            </ul>
            <p className={cn(pub.body, "mt-4 leading-relaxed")}>
              Вижте пълната Политика за бисквитки на{" "}
              <Link href="/cookies" className={externalLinkClass}>
                /cookies
              </Link>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">8. Публично достъпна информация</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo може да използва публично достъпни данни за събития от официални източници и API-та, единствено с
              цел показване на информация за фестивали в платформата.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">9. Сигурност</h2>
            <ul className={listClass}>
              <li>HTTPS криптиране</li>
              <li>Row-level security (Supabase RLS)</li>
              <li>Access control и role-based permissions</li>
              <li>Rate limiting срещу злоупотреби</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">10. Срок на съхранение</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Данните се съхраняват докато акаунтът е активен или до изтриването му. Логове се пазят до 90 дни.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">11. Твоите права</h2>
            <ul className={listClass}>
              <li>Право на достъп</li>
              <li>Право на корекция</li>
              <li>Право на изтриване (&quot;right to be forgotten&quot;)</li>
              <li>Право на ограничаване на обработката</li>
              <li>Право на преносимост на данните</li>
            </ul>
            <p className={cn(pub.body, "mt-4 leading-relaxed")}>
              За упражняване на права използвай{" "}
              <Link href="/contact" className={externalLinkClass}>
                формата за контакт
              </Link>{" "}
              или пиши на{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">12. Право на жалба</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Имате право да подадете жалба до Комисия за защита на личните данни (КЗЛД), България —{" "}
              <a
                className={externalLinkClass}
                href="https://www.cpdp.bg"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.cpdp.bg
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">13. Контакт</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
            </p>
          </section>
        </article>
      </Container>
    </div>
  );
}
