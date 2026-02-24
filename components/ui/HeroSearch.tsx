import Image from "next/image";

export default function HeroSearch() {
  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-2xl">
      <div className="absolute inset-0">
        <Image src="/hero.jpg" alt="Festivo hero" fill className="h-full w-full object-cover" priority />
      </div>
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-center px-6 text-center md:px-12">
        <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">Festivo</h1>
        <p className="mt-3 text-neutral-200">Фестивали и събития в България</p>

        <div className="mt-8 w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex flex-col divide-y divide-neutral-200 md:flex-row md:divide-y-0 md:divide-x md:divide-neutral-200">
            <div className="flex-1">
              <label className="sr-only" htmlFor="hero-looking-for">
                Looking for
              </label>
              <input
                id="hero-looking-for"
                placeholder="Looking for"
                className="w-full bg-transparent px-4 py-4 text-sm text-ink placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="sr-only" htmlFor="hero-city">
                City
              </label>
              <select
                id="hero-city"
                className="w-full bg-transparent px-4 py-4 text-sm text-ink focus:outline-none"
              >
              <option>City</option>
              <option>Sofia</option>
              <option>Plovdiv</option>
              <option>Varna</option>
            </select>
            </div>
            <div className="flex-1">
              <label className="sr-only" htmlFor="hero-when">
                When
              </label>
              <select
                id="hero-when"
                className="w-full bg-transparent px-4 py-4 text-sm text-ink focus:outline-none"
              >
              <option>When</option>
              <option>This weekend</option>
              <option>This week</option>
              <option>This month</option>
            </select>
            </div>
            <button
              type="button"
              className="bg-orange-500 px-6 py-4 font-medium text-white transition hover:bg-orange-600"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
