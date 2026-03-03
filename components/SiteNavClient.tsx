"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";

type SiteNavClientProps = {
  isAuthenticated: boolean;
  userEmail: string | null;
};

export default function SiteNavClient({ isAuthenticated, userEmail }: SiteNavClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="site-mobile-menu"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/70 transition hover:text-[#0c0e14]"
        >
          <span aria-hidden="true" className="text-base leading-none">
            {isOpen ? "✕" : "☰"}
          </span>
          Меню
        </button>
        {isOpen ? (
          <>
            <button aria-label="Close menu" className="fixed inset-0 z-40" onClick={closeMenu} />
            <div
              id="site-mobile-menu"
              className="absolute right-0 top-full z-50 mt-3 w-[min(92vw,22rem)] rounded-2xl border border-black/[0.08] bg-[#f5f4f0]/95 p-4 shadow-lg backdrop-blur-xl"
            >
              <nav className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/70">
                <Link href="/festivals" onClick={closeMenu} className="transition hover:text-[#0c0e14]">
                  Фестивали
                </Link>
                <Link href="/calendar" onClick={closeMenu} className="transition hover:text-[#0c0e14]">
                  Календар
                </Link>
                <Link href="/map" onClick={closeMenu} className="transition hover:text-[#0c0e14]">
                  Карта
                </Link>
                {isAuthenticated ? (
                  <>
                    <Link href="/plan" onClick={closeMenu} className="break-all text-[11px] normal-case tracking-normal text-black/60">
                      {userEmail ?? "Профил"}
                    </Link>
                    <form action="/api/auth/logout" method="post" onSubmit={closeMenu}>
                      <button type="submit" className="transition hover:text-[#0c0e14]">
                        Изход
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href="/login" onClick={closeMenu} className="transition hover:text-[#0c0e14]">
                    Вход
                  </Link>
                )}
              </nav>
            </div>
          </>
        ) : null}
      </div>

      <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-black/55 md:flex">
        <Link href="/festivals" className="transition hover:text-[#0c0e14]">
          Фестивали
        </Link>
        <Link href="/calendar" className="transition hover:text-[#0c0e14]">
          Календар
        </Link>
        <Link href="/map" className="transition hover:text-[#0c0e14]">
          Карта
        </Link>
        <Link href={isAuthenticated ? "/plan" : "/login"} className="max-w-[180px] truncate transition hover:text-[#0c0e14]">
          {isAuthenticated ? userEmail ?? "Профил" : "Вход"}
        </Link>
        {isAuthenticated ? (
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="transition hover:text-[#0c0e14]">
              Изход
            </button>
          </form>
        ) : null}
      </nav>
    </>
  );
}
