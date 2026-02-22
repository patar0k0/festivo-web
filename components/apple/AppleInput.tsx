import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function AppleInput({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-full border apple-border bg-[var(--surface)] px-4 py-2 text-sm text-[color:var(--text)]",
        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-black/10",
        className
      )}
      {...props}
    />
  );
}
