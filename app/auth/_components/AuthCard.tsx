import type { ReactNode } from "react";
import Link from "next/link";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="min-h-screen px-4 py-10 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-black/[0.08] bg-white/90 p-6 shadow-[0_2px_0_rgba(12,14,20,0.04),0_16px_36px_rgba(12,14,20,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/75 transition hover:bg-black/[0.03] hover:text-black"
          >
            <span aria-hidden="true">←</span>
            Назад
          </Link>
        </div>
        <p className="mt-2 text-sm text-black/65">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
