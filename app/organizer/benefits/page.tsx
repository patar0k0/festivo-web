import Link from "next/link";

export default function OrganizerBenefitsPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/organizer" className="inline-flex text-sm text-black/70 transition hover:text-black">
          ← Обратно към таблото
        </Link>

        <header className="mt-6">
          <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-[#0c0e14]">VIP и промоция</h1>
          <p className="mt-2 text-sm text-black/65">Два различни инструмента за различни нужди.</p>
        </header>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0c0e14]">Промотирай фестивал</h2>
            <p className="mt-2 text-sm text-black/65">
              Тактически boost за конкретен фестивал. Показва събитието ти на по-видимо място за ограничен период.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-black/80">
              <li>· По-висока позиция в резултатите</li>
              <li>· Повече посетители на страницата</li>
              <li>· Подходящо при нов фестивал или близка дата</li>
            </ul>

            <a
              href="mailto:hello@festivo.bg?subject=Заявка за промотиране на фестивал"
              className="mt-4 inline-flex rounded-lg bg-black px-4 py-2 text-sm text-white transition hover:bg-black/90"
            >
              Заяви промотиране
            </a>
            <p className="mt-2 text-xs text-gray-500">Ще се свържем с теб с детайли за активиране</p>
          </article>

          <article className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#0c0e14]">VIP организатор</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200">Очаквайте скоро</span>
            </div>
            <p className="mt-2 text-sm text-black/60">
              Стратегическо предимство за активни организатори. По-силен профил, повече медия и включени промо кредити.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-gray-400">
              <li>· Постоянно предимство за всички фестивали</li>
              <li>· По-голям медиен лимит</li>
              <li>· Включени промо кредити</li>
            </ul>
          </article>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500">Промотирането се активира ръчно от екипа ни</p>
        <p className="mt-2 text-center text-xs text-gray-500">Можеш да използваш промотиране по всяко време за отделни фестивали</p>
      </div>
    </div>
  );
}
