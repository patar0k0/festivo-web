export default function ComingSoonPublic() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-[#0c0e14]">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[380px] w-[380px] rounded-full bg-[#ff4c1f]/[0.06] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-[320px] w-[320px] rounded-full bg-[#1a9e5c]/[0.07] blur-3xl"
        aria-hidden
      />

      <main className="relative mx-auto max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Festivo</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Очаквайте скоро
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-pretty text-[15px] leading-relaxed text-black/55 sm:text-base">
          Работим по платформата. Скоро ще може да откривате фестивали в България на едно място.
        </p>
        <div
          className="mx-auto mt-10 h-1 w-11 rounded-full bg-gradient-to-r from-[#ff4c1f] to-[#1a9e5c]"
          aria-hidden
        />
      </main>
    </div>
  );
}
