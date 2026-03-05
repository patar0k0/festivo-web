import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export default function Container({ className = "", children, ...props }: Props) {
  return (
    <div
      className={`mx-auto max-w-6xl px-4 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
