import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const canonical = `${getBaseUrl().replace(/\/$/, "")}/terms`;

export const metadata: Metadata = {
  title: "Общи условия за ползване",
  description:
    "Общи условия за ползване на festivo.bg — акаунти, съдържание от организатори, отговорност, интелектуална собственост и контакт.",
  alternates: {
    canonical,
  },
  openGraph: {
    title: "Общи условия за ползване · Festivo",
    description:
      "Условия за използване на платформата festivo.bg — права и задължения на потребители и организатори.",
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

export default function TermsOfUsePage() {
  return (
    <div className={cn(pub.pageOverflow, pub.sectionLoose)}>
      <Container>
        <article className="mx-auto max-w-2xl">
          <p className={cn(pub.eyebrowMuted, "leading-relaxed")}>Festivo.bg</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Общи условия за ползване</h1>
          <p className={cn(pub.body, "mt-5 leading-relaxed")}>В сила от: 12 април 2026 г.</p>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">1. За платформата</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg е платформа за откриване на фестивали и културни събития в България.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Администратор: Festivo.bg |{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">2. Приемане на условията</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              С използването на платформата приемате тези условия.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Ако не сте съгласни — не използвайте услугата.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">3. Минимална възраст</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              За регистрация е необходима минимална възраст от 16 години съгласно GDPR.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">4. Акаунти</h2>
            <ul className={listClass}>
              <li>Отговорни сте за сигурността на акаунта си</li>
              <li>Не споделяйте достъп с трети лица</li>
              <li>
                При съмнение за компрометиран акаунт — уведомете ни на{" "}
                <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                  admin@festivo.bg
                </a>
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">5. Добавяне на съдържание от организатори</h2>
            <ul className={listClass}>
              <li>Информацията трябва да е точна и актуална</li>
              <li>Разрешено е качването само на изображения с притежавани или лицензирани права</li>
              <li>Забранено е публикуването на фалшива, подвеждаща или незаконна информация</li>
              <li>Festivo.bg си запазва правото да редактира, отлага или отказва публикуване без уведомление</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">6. Верифицирано съдържание</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg може да добавя и верифицира информация за фестивали от публични източници.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Полагаме усилия за точност, но не гарантираме пълнота на информацията.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">7. Отговорност</h2>
            <ul className={listClass}>
              <li>Festivo.bg не носи отговорност за неточности в съдържание, предоставено от организатори</li>
              <li>Не носим отговорност за промени в програмата, отмяна или достъп до събития</li>
              <li>Препоръчваме да проверявате детайлите директно при организатора</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">8. Интелектуална собственост</h2>
            <ul className={listClass}>
              <li>Съдържанието на платформата (дизайн, код, текстове) е собственост на Festivo.bg</li>
              <li>Организаторите запазват правата върху съдържанието което качват</li>
              <li>С публикуването организаторът предоставя на Festivo.bg неизключителен лиценз за показване на съдържанието</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">9. Платени планове (предстоящо)</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg планира въвеждане на платени планове за организатори.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Конкретните условия ще бъдат публикувани преди активирането им.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">10. Прекратяване на акаунт</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg си запазва правото да прекрати акаунт при нарушение на условията.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Потребителят може да изтрие акаунта си по всяко време от настройките или като се свърже с{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">11. Промени в условията</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg си запазва правото да актуализира условията.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              При съществени промени ще уведомим потребителите по имейл.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Продължаването на използването означава приемане на новите условия.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">12. Приложимо право</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Тези условия се регулират от законодателството на Република България.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Спорове се разрешават от компетентните съдилища в България.
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
