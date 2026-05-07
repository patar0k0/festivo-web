import type { ReactNode } from "react";

type Props = {
  title?: string;
  warning?: string;
  warningSecondary?: string;
  children: ReactNode;
  className?: string;
};

export default function DangerZone({
  title = "Опасна зона",
  warning = "Това действие е необратимо.",
  warningSecondary = "Потребителят ще загуби достъп до акаунта си.",
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5 ${className}`.trim()}
    >
      <h3 className="text-sm font-bold tracking-tight text-red-950">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-red-900/85">{warning}</p>
      {warningSecondary ? (
        <p className="mt-1 text-xs leading-relaxed text-red-900/65">{warningSecondary}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
