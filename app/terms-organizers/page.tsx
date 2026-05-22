import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const canonical = `${getBaseUrl().replace(/\/$/, "")}/terms-organizers`;

export const metadata: Metadata = {
  title: "Условия за организатори",
  description:
    "Условия за организатори на festivo.bg — регистрация на организаторски профил, одобрение, публикуване на фестивали, права върху съдържанието и платени услуги.",
  alternates: {
    canonical,
  },
  openGraph: {
    title: "Условия за организатори · Festivo",
    description:
      "Условия за регистрация и работа на организатори във festivo.bg.",
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

export default function OrganizerTermsPage() {
  return (
    <div className={cn(pub.pageOverflow, pub.sectionLoose)}>
      <Container>
        <article className="mx-auto max-w-2xl">
          <p className={cn(pub.eyebrowMuted, "leading-relaxed")}>Festivo.bg</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Условия за организатори
          </h1>
          <p className={cn(pub.body, "mt-5 leading-relaxed")}>В сила от: 28 май 2026 г.</p>

          <p className={cn(pub.body, "mt-6 leading-relaxed")}>
            Тези условия се прилагат за всички организатори, които използват festivo.bg за
            публикуване на фестивали и културни събития. Те допълват{" "}
            <a className={externalLinkClass} href="/terms">
              Общите условия за ползване
            </a>{" "}
            и{" "}
            <a className={externalLinkClass} href="/privacy">
              Политиката за поверителност
            </a>
            . При противоречие, специфичните условия по-долу имат предимство пред общите.
          </p>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">1. Кой може да бъде организатор</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Като „организатор“ може да се регистрира физическо или юридическо лице,
              което организира фестивали или културни събития в България.
            </p>
            <ul className={listClass}>
              <li>Юридически лица (фирми, общини, фондации, сдружения)</li>
              <li>Физически лица — само за лични фестивални проекти, не за препродажба</li>
              <li>Възрастта на представителя е минимум 18 години</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">2. Регистрация и одобрение на профил</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Организаторски профил се създава чрез процес на „claim“ (заявка за достъп до
              съществуващ профил) или подаване на нов фестивал чрез публичната форма.
            </p>
            <ul className={listClass}>
              <li>
                Всички организаторски профили подлежат на ръчна проверка и одобрение от
                екипа на festivo.bg
              </li>
              <li>Проверката отнема обикновено 1–3 работни дни</li>
              <li>
                Festivo.bg може да поиска допълнителни данни за потвърждение (документ за
                регистрация, връзка със събитие, контактна информация)
              </li>
              <li>
                Заявка може да бъде отказана без задължение за обяснение, но обичайно
                посочваме причината
              </li>
              <li>
                Един потребител може да управлява няколко организатора, ако докаже връзка с
                всеки от тях
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">3. Възможности на одобрения организатор</h2>
            <ul className={listClass}>
              <li>Публикуване на фестивали (всеки подлежи на отделно одобрение)</li>
              <li>Редактиране на собствения организаторски профил</li>
              <li>Качване на лого, описание, контактни данни и социални мрежи</li>
              <li>Получаване на имейл известия за статуса на одобрения и заявки</li>
              <li>Достъп до базови статистики за интерес към публикуваните фестивали</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">4. Изисквания към съдържанието</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Организаторът се задължава да публикува само точна и актуална информация.
            </p>
            <ul className={listClass}>
              <li>Заглавията и описанията трябва да отразяват реалното събитие</li>
              <li>
                Датите, локацията и програмата трябва да са актуални — при промяна,
                организаторът обновява профила незабавно
              </li>
              <li>
                Качените изображения трябва да бъдат притежавани от организатора или с
                ясно лицензирани права (включително разрешение от автора/фотографа)
              </li>
              <li>
                Забранено е публикуването на: фалшива или подвеждаща информация; чужди
                изображения без право; съдържание, нарушаващо закона; реклама на трети
                лица, която не е свързана пряко с фестивала
              </li>
              <li>
                Контактни данни (телефон, имейл) трябва да са валидни и да принадлежат на
                организацията
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">5. Преглед и редакция от Festivo.bg</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg си запазва правото да:
            </p>
            <ul className={listClass}>
              <li>Редактира заглавия, описания, тагове и категории за яснота и SEO</li>
              <li>Преразмерява или преформатира изображения за технически нужди</li>
              <li>Отказва, отлага или премахва публикации, които не отговарят на условията</li>
              <li>
                Извършва промени без предварително уведомление, ако са свързани с
                техническа поддръжка или съответствие с правни изисквания
              </li>
              <li>
                При съществени съдържателни промени, се стремим да уведомяваме организатора
                по имейл
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">6. Права върху съдържанието</h2>
            <ul className={listClass}>
              <li>
                Организаторът запазва всички права върху съдържанието, което качва (текст,
                изображения, лого, програма)
              </li>
              <li>
                С качването на съдържание, организаторът предоставя на Festivo.bg
                неизключителен, безсрочен (за периода на присъствие на сайта),
                безвъзмезден лиценз да го показва, обработва, копира и разпространява в
                рамките на платформата (включително в имейл нотификации, социални мрежи на
                Festivo и маркетингови материали, свързани с фестивала)
              </li>
              <li>
                Festivo.bg не претендира собственост върху съдържанието на организатора
              </li>
              <li>
                При премахване на профил или фестивал, Festivo.bg прекратява използването
                на съдържанието в разумен срок (до 30 дни)
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">7. Безплатни и платени услуги</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Базовата регистрация и публикуване на фестивали във festivo.bg е{" "}
              <strong>безплатна</strong>.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg предлага и платени услуги, които организаторът може да активира
              доброволно:
            </p>
            <ul className={listClass}>
              <li>
                <strong>VIP план</strong> — приоритетно показване на профила и фестивалите
                на организатора в листинги и резултати
              </li>
              <li>
                <strong>Промотиран фестивал</strong> — конкретен фестивал получава засилена
                видимост (рекламно място, по-високо подреждане в листинги, акцент в
                календара)
              </li>
              <li>
                <strong>Promotion credits</strong> — кредити за промотиране, които
                организаторът използва по своя преценка. Кредитите имат валидност за една
                календарна година от деня на закупуване
              </li>
            </ul>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Конкретните цени, обхват и срокове на платените услуги се обявяват в
              организаторския портал преди активиране. Организаторът потвърждава активирането
              изрично — не се таксува автоматично.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">8. Възстановяване на суми</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              При неизпълнение на промотирано показване по причина, дължаща се на
              Festivo.bg (техническа авария, неправилно класиране), организаторът има
              право на пропорционално възстановяване или удължаване на услугата.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Заявки за възстановяване се изпращат на{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>{" "}
              в срок до 30 дни от събитието.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Не се възстановяват суми за услуги, които вече са били консумирани, или при
              нарушение на условията от страна на организатора.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">9. Комуникация и нотификации</h2>
            <ul className={listClass}>
              <li>
                Festivo.bg изпраща транзакционни имейли (одобрение на заявка, статус на
                фестивал, технически известия) на адреса, посочен при регистрация
              </li>
              <li>
                Тези имейли са задължителни за работата на платформата и не подлежат на
                отписване, докато организаторът има активен профил
              </li>
              <li>
                Маркетингови имейли (новини, нови функционалности, бюлетин) подлежат на
                съгласие и отписване по всяко време
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">10. Поверителност на данните на организатора</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg обработва данните на организатора съгласно{" "}
              <a className={externalLinkClass} href="/privacy">
                Политиката за поверителност
              </a>
              .
            </p>
            <ul className={listClass}>
              <li>
                Публично видими са: име на организатора, лого, описание, контактна
                информация (която организаторът сам реши да направи публична)
              </li>
              <li>
                Не публикуваме данни от вътрешни заявки (документи за регистрация,
                кореспонденция за одобрение), освен ако не сме задължени по закон
              </li>
              <li>
                Организаторът може да поиска изтриване на своя профил по всяко време чрез{" "}
                <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                  admin@festivo.bg
                </a>
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">11. Отговорност</h2>
            <ul className={listClass}>
              <li>
                Организаторът носи пълна отговорност за точността и законосъобразността
                на публикуваното съдържание
              </li>
              <li>
                Организаторът носи отговорност за провеждането на самия фестивал —
                Festivo.bg е каталог и не участва в организацията на събитията
              </li>
              <li>
                При претенции на трети лица към съдържание, публикувано от организатора,
                отговорността е изцяло негова
              </li>
              <li>
                Festivo.bg не носи отговорност за пропуснати ползи на организатора в
                резултат на временна недостъпност на платформата, технически проблеми или
                модерационни решения
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">12. Прекратяване на достъп</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg може да прекрати достъпа на организатор или да премахне профил
              при:
            </p>
            <ul className={listClass}>
              <li>Нарушение на условията или приложимото българско или европейско законодателство</li>
              <li>Системно публикуване на неточна или подвеждаща информация</li>
              <li>Злоупотреба с платформата (спам, нерегламентирана реклама)</li>
              <li>Нарушение на правата на трети лица (авторско право, лични данни)</li>
              <li>Опит за заобикаляне на технически или модерационни ограничения</li>
            </ul>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Преди прекратяване, при възможност, се изпраща предупреждение и възможност за
              реакция. При сериозни нарушения, прекратяването е незабавно.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Организаторът може да прекрати своя профил по всяко време като пише на{" "}
              <a className={externalLinkClass} href="mailto:admin@festivo.bg">
                admin@festivo.bg
              </a>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">13. Промени в условията</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Festivo.bg си запазва правото да актуализира тези условия. При съществени
              промени уведомяваме организаторите по имейл поне 14 дни преди влизането в
              сила.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Ако организаторът не е съгласен с промените, може да прекрати профила си
              преди тяхното влизане в сила.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">14. Приложимо право и спорове</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Тези условия се регулират от законодателството на Република България.
            </p>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Спорове се разрешават първо чрез добронамерен диалог. При невъзможност, чрез
              медиация или от компетентните съдилища в България.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mt-8 mb-2 text-lg font-semibold">15. Контакт</h2>
            <p className={cn(pub.body, "mt-3 leading-relaxed")}>
              Въпроси, заявки за одобрение, жалби или искания за изтриване на профил:
            </p>
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
