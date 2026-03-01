"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "festivals:list:";

function getPathKey(pathname: string, params: URLSearchParams) {
  const keyParams = new URLSearchParams(params.toString());
  keyParams.delete("page");
  const query = keyParams.toString();
  return `${STORAGE_PREFIX}${pathname}${query ? `?${query}` : ""}`;
}

export default function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const key = useMemo(() => getPathKey(pathname, new URLSearchParams(searchParams.toString())), [pathname, searchParams]);

  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      const y = Number(saved);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "auto" });
        });
      }
    }

    const saveScrollPosition = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener("pagehide", saveScrollPosition);
    return () => {
      saveScrollPosition();
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [key]);

  return null;
}
