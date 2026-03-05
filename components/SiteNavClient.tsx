"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";

type SiteNavClientProps = {
  isAuthenticated: boolean;
  userEmail: string | null;
};

export default function SiteNavClient({
  isAuthenticated,
  userEmail,
}: SiteNavClientProps) {
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

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div className="md:hidden">
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
        <div
          className={`fixed inset-0 z-50 bg-white transition-transform duration-300 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
          }`}
          aria-hidden={!isOpen}
        >
          <div
            id="site-mobile-menu"
            className="flex h-full w-full max-w-full flex-col bg-[#f5f4f0] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
                Меню
              </p>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-full border border-black/[0.1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/60"
              >
                Затвори
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-6 text-lg font-semibold text-black/75">
              <Link
                href="/festivals"
                onClick={closeMenu}
                className="transition hover:text-[#0c0e14]"
              >
                Фестивали
              </Link>
              <Link
                href="/calendar"
                onClick={closeMenu}
                className="transition hover:text-[#0c0e14]"
              >
                Календар
              </Link>
              <Link
                href="/map"
                onClick={closeMenu}
                className="transition hover:text-[#0c0e14]"
              >
                Карта
              </Link>
            </nav>

            <div className="mt-auto border-t border-black/[0.08] pt-4 text-xs font-semibold uppercase tracking-[0.15em] text-black/65">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <Link
                    href="/plan"
                    onClick={closeMenu}
                    className="block break-all text-[11px] normal-case tracking-normal text-black/60"
                  >
                    {userEmail ?? "Профил"}
                  </Link>
                  <form
                    action="/api/auth/logout"
                    method="post"
                    onSubmit={closeMenu}
                  >
                    <button
                      type="submit"
                      className="transition hover:text-[#0c0e14]"
                    >
                      Изход
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="transition hover:text-[#0c0e14]"
                >
                  Вход
                </Link>
              )}
            </div>
          </div>
        </div>
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
        <Link
          href={isAuthenticated ? "/plan" : "/login"}
          className="transition hover:text-[#0c0e14]"
        >
          {isAuthenticated ? "Профил" : "Вход"}
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
