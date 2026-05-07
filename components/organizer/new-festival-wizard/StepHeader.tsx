type StepHeaderProps = {
  title: string;
  description?: string;
  stepIndex: number;
  totalSteps: number;
};

export function StepHeader({ title, description, stepIndex, totalSteps }: StepHeaderProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">
        Стъпка {stepIndex} от {totalSteps}
      </p>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description ? <p className="text-sm text-gray-600">{description}</p> : null}
    </div>
  );
}
