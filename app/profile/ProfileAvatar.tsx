"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  email: string | null;
  initials: string;
  initialAvatarUrl: string | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

export default function ProfileAvatar({ email, initials, initialAvatarUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  function openPicker() {
    if (busy) return;
    setError(null);
    inputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Избери JPG, PNG или WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Максимален размер: 2 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
        credentials: "include",
      });
      const json = (await res.json()) as { avatar_url?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Качването не бе успешно.");
        return;
      }
      if (json.avatar_url) {
        setAvatarUrl(json.avatar_url);
        router.refresh();
      }
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          title="Качи снимка"
          aria-label="Качи профилна снимка"
          className="group relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-pine text-sm font-bold text-white shadow-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-wait md:h-14 md:w-14 md:text-base"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
          <span
            className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 md:text-[11px]"
            aria-hidden
          >
            {busy ? "…" : "Снимка"}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(ev) => void onFileChange(ev)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-black/45">Имейл адрес</p>
          <p className="mt-0.5 break-all text-[15px] font-semibold leading-snug text-[#0c0e14]">
            {email ?? "Няма имейл"}
          </p>
        </div>
      </div>
      <p className="text-xs text-black/45">JPG, PNG или WebP · до 2 MB</p>
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
