"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";

type SiteNavClientProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userEmail: string | null;
};

export default function SiteNavClient({
  isAuthenticated,
  isAdmin,
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
    document.documentElement.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.info("[SiteNavClient] mobile menu state", { isOpen });

    if (isOpen) {
      const panelRendered = Boolean(document.getElementById("site-mobile-menu"));
      console.info("[SiteNavClient] mobile menu JSX branch rendered", {
        panelRendered,
      });
    }
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
          {isOpen ? "Затвори" : "Меню"}
        </button>

        {isOpen ? (
          <>
            <button
              type="button"
              aria-label="Затвори менюто"
              onClick={closeMenu}
              className="fixed inset-0 z-40 bg-black/30"
            />

            <div
              id="site-mobile-menu"
              className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-y-auto bg-white px-5 py-6 shadow-[0_22px_44px_rgba(12,14,20,0.14)]"
              aria-hidden={!isOpen}
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

              <div className="mt-auto border-t border-black/[0.08] pt-4">
                {isAuthenticated ? (
                  <div className="space-y-5">
                    <Link
                      href="/plan"
                      onClick={closeMenu}
                      className="block text-base font-semibold text-black/75 transition hover:text-[#0c0e14]"
                    >
                      Моят план
                    </Link>
                    <Link
                      href="/profile"
                      onClick={closeMenu}
                      className="block text-base font-semibold text-black/75 transition hover:text-[#0c0e14]"
                    >
                      Профил
                    </Link>
                    {isAdmin ? (
                      <Link
                        href="/admin"
                        onClick={closeMenu}
                        className="block text-base font-semibold text-black/75 transition hover:text-[#0c0e14]"
                      >
                        Админ панел
                      </Link>
                    ) : null}
                    {userEmail ? (
                      <p className="mt-1 break-all text-sm font-medium text-black/45">
                        {userEmail}
                      </p>
                    ) : null}
                    <form
                      action="/api/auth/logout"
                      method="post"
                      onSubmit={closeMenu}
                    >
                      <button
                        type="submit"
                        className="text-xs font-semibold uppercase tracking-[0.15em] text-black/65 transition hover:text-[#0c0e14]"
                      >
                        Изход
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="text-xs font-semibold uppercase tracking-[0.15em] text-black/65 transition hover:text-[#0c0e14]"
                  >
                    Вход
                  </Link>
                )}
              </div>
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
        {isAuthenticated ? (
          <>
            <Link href="/plan" className="transition hover:text-[#0c0e14]">
              Моят план
            </Link>
            <Link href="/profile" className="transition hover:text-[#0c0e14]">
              Профил
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="transition hover:text-[#0c0e14]">
                Админ
              </Link>
            ) : null}
          </>
        ) : (
          <Link href="/login" className="transition hover:text-[#0c0e14]">
            Вход
          </Link>
        )}
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
