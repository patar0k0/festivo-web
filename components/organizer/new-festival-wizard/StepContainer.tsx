import type { ReactNode } from "react";

type StepContainerProps = {
  children: ReactNode;
  stepKey: number;
};

export function StepContainer({ children, stepKey }: StepContainerProps) {
  return (
    <div key={stepKey} className="festivo-wizard-step-enter space-y-6">
      {children}
    </div>
  );
}
