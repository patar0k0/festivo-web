import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export function AppleCard({ className, hover = true, ...props }: Props) {
  return (
    <div
      className={cn(
        "apple-surface apple-border rounded-[var(--radius)] border apple-shadow2",
        hover && "transition hover:-translate-y-0.5 hover:apple-shadow",
        className
      )}
      {...props}
    />
  );
}

export function AppleCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative", className)} {...props} />;
}

export function AppleCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
