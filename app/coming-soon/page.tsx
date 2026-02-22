export const revalidate = 86400;

const hasAppLinks =
  Boolean(process.env.NEXT_PUBLIC_PLAY_STORE_URL) && Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);

export default function ComingSoonPage() {
  const year = new Date().getFullYear();
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sand via-white to-amber-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-ink/5 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[960px] items-center px-6 py-20">
        <div className="grid w-full gap-12 lg:grid-cols-[24px_1fr]">
          <div className="hidden lg:block">
            <div className="h-full w-px bg-ink/10" />
          </div>

          <div className="space-y-10 text-left">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-muted">FESTIVO</p>
              <h1 className="text-4xl font-semibold text-ink sm:text-5xl">Festivo is coming.</h1>
              <p className="max-w-xl text-base text-muted sm:text-lg">
                Discover free festivals in Bulgaria. Launching soon.
              </p>
              <p className="text-sm text-muted">Get the app to save festivals to your plan.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {hasAppLinks ? (
                <>
                  <a
                    href={playStoreUrl}
                    className="rounded-2xl border border-ink/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-[0_18px_40px_-32px_rgba(0,0,0,0.35)] transition hover:bg-white"
                  >
                    Google Play
                  </a>
                  <a
                    href={appStoreUrl}
                    className="rounded-2xl border border-ink/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-[0_18px_40px_-32px_rgba(0,0,0,0.35)] transition hover:bg-white"
                  >
                    App Store
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-2xl border border-ink/10 bg-white/70 px-6 py-3 text-sm font-semibold text-ink/60 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.3)]"
                >
                  Get the app
                </button>
              )}

              <a href="mailto:hello@festivo.bg" className="text-sm font-semibold text-ink">
                Contact
              </a>
            </div>

            <div className="pt-6 text-xs text-muted">© {year} Festivo</div>
          </div>
        </div>
      </div>
    </div>
  );
}
