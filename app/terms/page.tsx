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
          <p className={cn(pub.body, "mt-5 leading-relaxed")}>В сила от: 28 май 2026 г.</p>

          <p className={cn(pub.body, "mt-6 leading-relaxed")}>
            Тези Общи условия уреждат достъпа и използването на платформата festivo.bg от всички
            посетители и регистрирани потребители. Те следва да се четат заедно с{" "}
            <a className={externalLinkClass} href="/privacy">
              Политиката за поверителност
            </a>{" "}
            и{" "}
            <a className={externalLinkClass} href="/cookies">
              Политиката за бисквитки
            </a>
            . За лицата, които публикуват съдържание като организатори, се прилагат и допълнителните{" "}
            <a className={externalLinkClass} href="/terms-organizers">
              Условия за организатори
            </a>
            , които при противоречие имат предимство по отношение на организаторската дейност.
          </p>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">1. За платформата</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg е платформа за откриване на фестивали и културни събития в България.
              Платформата предоставя каталог с информация, инструменти за планиране (списъци,
              напомняния) и известия.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Услугата се предоставя „във вида, в който е“ и „според наличността“. Festivo.bg не е
              организатор на събитията и не продава билети за тях.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Администратор: Festivo.bg |{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">2. Дефиниции</h2>
            <ul className={listClass}>
              <li>
                <strong>Платформа</strong> — уебсайтът festivo.bg и свързаните с него услуги.
              </li>
              <li>
                <strong>Потребител</strong> — всяко лице, което достъпва или използва платформата,
                със или без регистрация.
              </li>
              <li>
                <strong>Организатор</strong> — лице, което публикува или управлява информация за
                фестивали чрез организаторски профил (виж{" "}
                <a className={externalLinkClass} href="/terms-organizers">
                  Условия за организатори
                </a>
                ).
              </li>
              <li>
                <strong>Съдържание</strong> — текст, изображения, програма, лога и други материали,
                публикувани на платформата.
              </li>
              <li>
                <strong>Верифицирано съдържание</strong> — информация, добавена и проверена от екипа
                на Festivo.bg от публични източници.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">3. Приемане на условията</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              С достъпа до или използването на платформата потвърждавате, че сте прочели, разбрали и
              приемате тези условия, както и{" "}
              <a className={externalLinkClass} href="/privacy">
                Политиката за поверителност
              </a>
              .
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              При регистрация на акаунт приемането на условията е изрично.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Ако не сте съгласни с условията — не използвайте услугата.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">4. Минимална възраст</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              За регистрация на акаунт е необходима минимална възраст от 14 години.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              14 години е възрастта за самостоятелно съгласие при услуги на информационното общество
              в Република България (чл. 8 от GDPR във връзка с приложимото българско законодателство
              за защита на личните данни).
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Лица под 14 години могат да използват платформата само със съгласие и под надзора на
              родител или настойник.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">5. Акаунти</h2>
            <ul className={listClass}>
              <li>Данните, които предоставяте при регистрация, трябва да са верни и актуални</li>
              <li>Отговорни сте за сигурността на акаунта си и за всички действия през него</li>
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
            <h2 className="mt-8 mb-2 text-lg font-semibold">6. Правила за поведение на потребителите</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              При използване на платформата се задължавате да не:
            </p>
            <ul className={listClass}>
              <li>
                публикувате или разпространявате незаконно, обидно, дискриминационно или подвеждащо
                съдържание
              </li>
              <li>
                нарушавате права на трети лица (авторски права, лични данни, търговски марки)
              </li>
              <li>
                извличате данни автоматизирано (scraping) или препубликувате съдържанието на
                платформата без изрично писмено разрешение
              </li>
              <li>
                се опитвате да получите неоторизиран достъп, да заобиколите технически или
                модерационни ограничения или да нарушите сигурността на платформата
              </li>
              <li>използвате платформата за спам, нерегламентирана реклама или измама</li>
              <li>се представяте за друго лице или организация</li>
            </ul>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg може да ограничи или прекрати достъпа при нарушение на тези правила.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">7. Добавяне на съдържание от организатори</h2>
            <ul className={listClass}>
              <li>Информацията трябва да е точна и актуална</li>
              <li>Разрешено е качването само на изображения с притежавани или лицензирани права</li>
              <li>Забранено е публикуването на фалшива, подвеждаща или незаконна информация</li>
              <li>Festivo.bg си запазва правото да редактира, отлага или отказва публикуване без уведомление</li>
            </ul>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Подробните правила за организаторите са описани в{" "}
              <a className={externalLinkClass} href="/terms-organizers">
                Условията за организатори
              </a>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">8. Верифицирано съдържание</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg може да добавя и верифицира информация за фестивали от публични източници.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Полагаме усилия за точност, но не гарантираме пълнота на информацията.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">9. Интелектуална собственост</h2>
            <ul className={listClass}>
              <li>Съдържанието на платформата (дизайн, код, текстове) е собственост на Festivo.bg</li>
              <li>Организаторите запазват правата върху съдържанието което качват</li>
              <li>С публикуването организаторът предоставя на Festivo.bg неизключителен лиценз за показване на съдържанието</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">10. Отговорност и гаранции</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg полага разумни усилия платформата да е достъпна и информацията — точна, но
              не дава гаранции за непрекъснат достъп, липса на грешки или пълнота на съдържанието.
            </p>
            <ul className={listClass}>
              <li>Festivo.bg не носи отговорност за неточности в съдържание, предоставено от организатори</li>
              <li>Не носим отговорност за промени в програмата, отмяна или достъп до събития</li>
              <li>
                Festivo.bg не носи отговорност за вреди или пропуснати ползи в резултат на временна
                недостъпност, технически проблеми или модерационни решения
              </li>
              <li>Препоръчваме да проверявате детайлите директно при организатора</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">11. Платени планове (предстоящо)</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg планира въвеждане на платени планове за организатори.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Конкретните условия се описват в{" "}
              <a className={externalLinkClass} href="/terms-organizers">
                Условията за организатори
              </a>{" "}
              и ще бъдат публикувани преди активирането им.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">12. Прекратяване на акаунт</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg си запазва правото да прекрати акаунт при нарушение на условията.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Потребителят може да изтрие акаунта си по всяко време от настройките.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">13. Промени в условията</h2>
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
            <h2 className="mt-8 mb-2 text-lg font-semibold">14. Приложимо право</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Тези условия се регулират от законодателството на Република България.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Спорове се разрешават от компетентните съдилища в България.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">15. Извънсъдебно решаване на спорове</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              При спор се стремим към разрешаване чрез добронамерен диалог — пишете ни на{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
              .
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Потребител по смисъла на Закона за защита на потребителите има право да отнесе спор към
              Комисията за защита на потребителите (КЗП) и към действащите към нея помирителни
              комисии —{" "}
              <a className={externalLinkClass} href="https://kzp.bg" target="_blank" rel="noopener noreferrer">
                kzp.bg
              </a>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">16. Контакт</h2>
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
