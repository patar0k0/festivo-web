import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none ${className}`.trim()}
      {...props}
    />
  );
}
