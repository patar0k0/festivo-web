import type { ReactNode } from "react";

export type WizardStepMeta = {
  id: number;
  label: string;
  shortLabel: string;
};

type StepNavigationProps = {
  progressSlot?: ReactNode;
  footerNote?: ReactNode;
  submitPrepSlot?: ReactNode;
  showBack: boolean;
  isLastStep: boolean;
  busy: boolean;
  disableNext: boolean;
  disableSubmit: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  previewSlot?: ReactNode;
};

export function WizardProgressInline({
  steps,
  currentStep,
  visitedSteps,
  onCompletedStepClick,
}: {
  steps: WizardStepMeta[];
  currentStep: number;
  visitedSteps?: ReadonlySet<number>;
  onCompletedStepClick?: (stepId: number) => void;
}) {
  return (
    <nav aria-label="Стъпки на формата" className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
      {steps.map((s, i) => {
        const isActive = s.id === currentStep;
        const isDone = s.id < currentStep;
        const isVisited = visitedSteps?.has(s.id) ?? false;
        const isVisitedAhead = !isActive && !isDone && isVisited;
        const isLast = i === steps.length - 1;

        const circleClass = isActive
          ? "bg-[#7c2d12] text-white shadow-sm"
          : isDone
            ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/50"
            : isVisitedAhead
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/60"
              : "bg-gray-50 text-gray-400 ring-1 ring-black/[0.06]";

        const labelClass = isActive
          ? "font-semibold text-[#0c0e14]"
          : isDone
            ? "font-medium text-emerald-700"
            : isVisitedAhead
              ? "font-medium text-[#5c200d]"
              : "font-normal text-black/40";

        const StepBody = (
          <>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-xs ${circleClass}`}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? "✓" : s.id}
            </span>
            <span className="hidden sm:inline">{s.shortLabel}</span>
          </>
        );
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2">
            {isDone && onCompletedStepClick ? (
              <button
                type="button"
                onClick={() => onCompletedStepClick(s.id)}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                aria-label={`Към стъпка ${s.id}: ${s.label}`}
              >
                {StepBody}
              </button>
            ) : (
              <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm ${labelClass}`}>{StepBody}</div>
            )}
            {!isLast ? <span className="text-amber-300/60 select-none sm:px-0.5" aria-hidden="true">—</span> : null}
          </div>
        );
      })}
    </nav>
  );
}

const primaryCtaDisabledClass = "disabled:opacity-50 disabled:cursor-not-allowed";

export function StepNavigation({
  progressSlot,
  footerNote,
  submitPrepSlot,
  showBack,
  isLastStep,
  busy,
  disableNext,
  disableSubmit,
  onBack,
  onNext,
  onSubmit,
  previewSlot,
}: StepNavigationProps) {
  return (
    <div className="space-y-6">
      {progressSlot}
      {previewSlot ? <div className="flex flex-col gap-2 sm:items-end">{previewSlot}</div> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex justify-start">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="inline-flex w-full justify-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-5 py-2.5 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/25 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              <span aria-hidden="true">←</span> Назад
            </button>
          ) : (
            <span className="hidden sm:block sm:w-[1px]" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!isLastStep ? (
            <button
              type="button"
              onClick={onNext}
              disabled={busy || disableNext}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/25 sm:w-auto ${primaryCtaDisabledClass}`}
            >
              Напред <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
              {submitPrepSlot}
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || disableSubmit}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c2d12] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/25 sm:w-auto ${primaryCtaDisabledClass}`}
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Изпращане…
                  </>
                ) : (
                  <>Изпрати за одобрение →</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      {footerNote}
    </div>
  );
}
