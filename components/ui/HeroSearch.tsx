import Image from "next/image";
import Button from "@/components/ui/Button";

export default function HeroSearch() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200">
      <div className="absolute inset-0">
        <Image src="/hero.jpg" alt="Festivo hero" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative px-6 py-16 text-center text-white md:px-12 md:py-20">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Festivo</h1>
        <p className="mt-3 text-base text-white/90 md:text-lg">Фестивали и събития в България</p>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl bg-white p-2 shadow-md">
          <div className="grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto]">
            <input
              placeholder="Looking for"
              className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <select className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option>In</option>
              <option>Sofia</option>
              <option>Plovdiv</option>
              <option>Varna</option>
            </select>
            <select className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option>When</option>
              <option>This weekend</option>
              <option>This week</option>
              <option>This month</option>
            </select>
            <Button variant="primary" size="lg" className="h-12 px-6">
              Search
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
