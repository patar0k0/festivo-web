import { cn } from "@/lib/utils";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function AppleSelect({ className, ...props }: Props) {
  return (
    <select
      className={cn(
        "w-full rounded-full border apple-border bg-[var(--surface)] px-4 py-2 text-sm text-[color:var(--text)]",
        "focus:outline-none focus:ring-2 focus:ring-black/10",
        className
      )}
      {...props}
    />
  );
}
