import Link from "next/link";

type TrailStep = {
  time: string;
  label: string;
};

type Trail = {
  title: string;
  description: string;
  steps: TrailStep[];
};

type Props = {
  trails: Trail[];
  onAdd: (trail: Trail) => void;
};

const chipClass =
  "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]";

const buttonClass =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90";

export default function Trails({ trails, onAdd }: Props) {
  return (
    <section className="py-4" id="trails">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Trails (готови маршрути)</h2>
            <p className="text-xs text-black/60">Това е редакторската стойност. Не "още един календар".</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={chipClass}>подбрано</span>
            <span className={chipClass}>готов ден</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 max-[980px]:grid-cols-1 md:grid-cols-3">
          {trails.map((trail) => (
            <div
              key={trail.title}
              className="landing-trail relative overflow-hidden rounded-[28px] border border-black/10 bg-white/80 p-3.5 shadow-[0_10px_24px_rgba(12,18,32,0.08)]"
            >
              <h3 className="mb-1.5 text-base font-semibold tracking-tight">{trail.title}</h3>
              <p className="mb-3 text-xs text-black/60">{trail.description}</p>
              <div className="mb-3 flex flex-col gap-2">
                {trail.steps.map((step) => (
                  <div
                    key={`${trail.title}-${step.time}`}
                    className="flex items-center justify-between gap-2 rounded-[18px] border border-black/10 bg-white/90 px-3 py-2 text-xs text-black/60 shadow-[0_8px_18px_rgba(12,18,32,0.05)]"
                  >
                    <b className="text-black">{step.time}</b>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} onClick={() => onAdd(trail)}>
                  + В план
                </button>
                <Link
                  href="/festival/demo"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
                >
                  Отвори
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export type { Trail };
