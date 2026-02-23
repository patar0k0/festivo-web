import * as React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: Props) {
  return (
    <select
      className={`rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none ${className}`.trim()}
      {...props}
    />
  );
}
