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
          ? "bg-gray-900 text-white"
          : isDone
            ? "bg-emerald-100 text-emerald-800"
            : isVisitedAhead
              ? "bg-gray-200 text-gray-700"
              : "bg-gray-100 text-gray-500";

        const labelClass = isActive
          ? "font-semibold text-gray-900"
          : isDone
            ? "font-medium text-emerald-700"
            : isVisitedAhead
              ? "font-medium text-gray-600"
              : "font-normal text-gray-400";

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
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-black/10`}
                aria-label={`Към стъпка ${s.id}: ${s.label}`}
              >
                {StepBody}
              </button>
            ) : (
              <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm ${labelClass}`}>{StepBody}</div>
            )}
            {!isLast ? <span className="text-gray-300 select-none sm:px-0.5">—</span> : null}
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
              className="inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              Назад
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
              className={`inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 sm:w-auto ${primaryCtaDisabledClass}`}
            >
              Напред
            </button>
          ) : (
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
              {submitPrepSlot}
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || disableSubmit}
                className={`inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 sm:w-auto ${primaryCtaDisabledClass}`}
              >
                {busy ? "Изпращане..." : "Изпрати за одобрение"}
              </button>
            </div>
          )}
        </div>
      </div>
      {footerNote}
    </div>
  );
}
