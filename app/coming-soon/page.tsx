export const revalidate = 86400;

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sand via-white to-amber-50">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
        <div className="w-full space-y-10">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted">Festivo</p>
            <h1 className="text-4xl font-semibold text-ink sm:text-5xl">Festivo is coming.</h1>
            <p className="max-w-xl text-base text-muted sm:text-lg">
              Discover free festivals in Bulgaria. Launching soon.
            </p>
          </div>

          <div className="max-w-xl space-y-3 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)]">
            <p className="text-sm font-semibold text-ink">Get the first invite</p>
            <form className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="you@email.com"
                className="h-11 w-full rounded-full border border-ink/10 bg-white px-4 text-sm text-ink outline-none"
              />
              <button
                type="button"
                className="h-11 rounded-full bg-ink px-6 text-sm font-semibold uppercase tracking-widest text-white"
              >
                Notify me
              </button>
            </form>
            <p className="text-xs text-muted">No spam. No tracking. Just the launch link.</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted">
            <span>Instagram (soon)</span>
            <a href="mailto:hello@festivo.bg" className="font-semibold text-ink">
              hello@festivo.bg
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
