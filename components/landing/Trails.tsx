import Link from "next/link";

type TrailStep = {
  time: string;
  label: string;
};

export type Trail = {
  title: string;
  description: string;
  steps: TrailStep[];
};

type Props = {
  trails: Trail[];
  onAdd: (trail: Trail) => void;
};

export default function Trails({ trails, onAdd }: Props) {
  return (
    <section className="py-4" id="trails">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-black tracking-[-0.5px] text-[#0c0e14]">
              Trails — готови маршрути
            </h2>
            <p className="mt-0.5 text-[13px] text-black/50">
              Редакторски подбрани дни — добавяш с едно кликване
            </p>
          </div>
        </div>

        <div className="grid gap-3 max-[980px]:grid-cols-1 md:grid-cols-3">
          {trails.map((trail, index) => (
            <div
              key={trail.title}
              className="relative overflow-hidden rounded-[24px] border border-black/[0.08] bg-white p-6 shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(12,14,20,0.08),0_20px_48px_rgba(12,14,20,0.12)]"
            >
              {/* Decorative number */}
              <span className="landing-trail-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>

              <h3 className="mb-1.5 text-[15px] font-extrabold leading-snug tracking-[-0.3px] text-[#0c0e14]">
                {trail.title}
              </h3>
              <p className="mb-4 text-[12px] leading-relaxed text-black/50">{trail.description}</p>

              {/* Timeline steps */}
              <div className="mb-4 flex flex-col gap-2">
                {trail.steps.map((step) => (
                  <div
                    key={`${trail.title}-${step.time}`}
                    className="flex items-center gap-3 text-[12px]"
                  >
                    <span className="w-[38px] font-black tabular-nums text-[#0c0e14]">
                      {step.time}
                    </span>
                    <span className="h-[6px] w-[6px] flex-shrink-0 rounded-full bg-[#ff4c1f]" />
                    <span className="text-black/55">{step.label}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAdd(trail)}
                  className="inline-flex h-[34px] items-center gap-1 rounded-[10px] border border-black/[0.1] bg-transparent px-3 text-[12px] font-extrabold transition hover:bg-[#f5f4f0] hover:border-black/20"
                >
                  + В план
                </button>
                <Link
                  href="/festival/demo"
                  className="inline-flex h-[34px] items-center gap-1 rounded-[10px] bg-[#ff4c1f] px-3 text-[12px] font-extrabold text-white transition hover:bg-[#e04010] hover:-translate-y-px"
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
