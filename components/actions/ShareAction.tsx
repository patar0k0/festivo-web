"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";
import { track } from "@/lib/analytics/track";
import { shareEvent, getShareLinks } from "@/lib/share";

type ShareLinks = ReturnType<typeof getShareLinks>;

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

type Props = {
  title: string;
  /** Kept for API compatibility; share text is intentionally short and does not use the description. */
  description?: string | null;
};

export default function ShareAction({ title }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<ShareLinks | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const openedModalOnceRef = useRef(false);

  useEffect(() => {
    if (open) {
      setLinks(
        getShareLinks({
          title,
          url: window.location.href,
        }),
      );
    } else {
      setLinks(null);
    }
  }, [open, title]);

  useEffect(() => {
    if (open) {
      openedModalOnceRef.current = true;
      modalRef.current?.focus();
    } else if (openedModalOnceRef.current) {
      buttonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollBarWidth}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [open]);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      track("share_click", {
        method: "native_attempt",
        url: window.location.pathname,
      });

      const url = window.location.href;
      const shareText = `${title} – Виж повече във Festivo`;
      const ok = await shareEvent({
        title,
        text: shareText,
        url,
      });

      if (ok) {
        track("share_click", {
          method: "native",
          url: window.location.pathname,
        });
      } else {
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!links) return;
    void (async () => {
      const ok = await copyToClipboard(links.copy);
      if (ok) {
        track("share_click", {
          method: "copy",
          url: window.location.pathname,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    })();
  };

  const btnClass = cn(
    "w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-black/90 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.04] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    pub.focusRing,
  );

  const modalSurfaceClass = cn(
    "w-[320px] rounded-2xl bg-white p-5 shadow-xl outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
  );

  const linkRel = "noopener noreferrer";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className={btnClass}
      >
        Сподели
      </button>

      {open ? (
        <div className="backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            ref={modalRef}
            tabIndex={-1}
            className={modalSurfaceClass}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-sm font-semibold text-black/90">Сподели</p>

            <div className="flex flex-col gap-2">
              <button type="button" onClick={handleCopy} className={btnClass}>
                {copied ? "✔ Линкът е копиран" : "Копирай линк"}
              </button>

              {links ? (
                <>
                  <a
                    href={links.facebook}
                    target="_blank"
                    rel={linkRel}
                    className={btnClass}
                    onClick={() =>
                      track("share_click", {
                        method: "facebook",
                        url: window.location.pathname,
                      })
                    }
                  >
                    Facebook
                  </a>
                  <a
                    href={links.whatsapp}
                    target="_blank"
                    rel={linkRel}
                    className={btnClass}
                    onClick={() =>
                      track("share_click", {
                        method: "whatsapp",
                        url: window.location.pathname,
                      })
                    }
                  >
                    WhatsApp
                  </a>
                  <a
                    href={links.telegram}
                    target="_blank"
                    rel={linkRel}
                    className={btnClass}
                    onClick={() =>
                      track("share_click", {
                        method: "telegram",
                        url: window.location.pathname,
                      })
                    }
                  >
                    Telegram
                  </a>
                  <a
                    href={links.email}
                    target="_blank"
                    rel={linkRel}
                    className={btnClass}
                    onClick={() =>
                      track("share_click", {
                        method: "email",
                        url: window.location.pathname,
                      })
                    }
                  >
                    Email
                  </a>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/40 transition hover:text-black/60"
            >
              Затвори
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
