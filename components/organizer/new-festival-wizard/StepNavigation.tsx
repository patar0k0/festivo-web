import type { ReactNode } from "react";

export type WizardStepMeta = {
  id: number;
  label: string;
  shortLabel: string;
};

type StepNavigationProps = {
  progressSlot?: ReactNode;
  footerNote?: ReactNode;
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
}: {
  steps: WizardStepMeta[];
  currentStep: number;
}) {
  return (
    <nav aria-label="Стъпки на формата" className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
      {steps.map((s, i) => {
        const isActive = s.id === currentStep;
        const isDone = s.id < currentStep;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:text-sm ${
                isActive
                  ? "font-semibold text-gray-900"
                  : isDone
                    ? "font-medium text-emerald-700"
                    : "font-normal text-gray-400"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-xs ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : isDone
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-500"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓" : s.id}
              </span>
              <span className="hidden sm:inline">{s.shortLabel}</span>
            </div>
            {!isLast ? <span className="text-gray-300 select-none sm:px-0.5">—</span> : null}
          </div>
        );
      })}
    </nav>
  );
}

export function StepNavigation({
  progressSlot,
  footerNote,
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
              className="inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:w-auto"
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
              className="inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:w-auto"
            >
              Напред
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || disableSubmit}
              className="inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:w-auto"
            >
              {busy ? "Изпращане…" : "Създай фестивал"}
            </button>
          )}
        </div>
      </div>
      {footerNote}
    </div>
  );
}
