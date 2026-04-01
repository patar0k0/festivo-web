"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  userId: string;
  banned: boolean;
  isAdmin: boolean;
  currentAdminUserId: string;
};

export default function AdminUserDetailActions({ userId, banned, isAdmin, currentAdminUserId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "ban" | "role">("");
  const [error, setError] = useState("");

  const isSelf = userId === currentAdminUserId;
  const canRevokeAdmin = isAdmin && !isSelf;

  async function postBan(action: "ban" | "unban") {
    setError("");
    setBusy("ban");
    try {
      const res = await fetch(`/admin/api/users/${userId}/ban`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy("");
    }
  }

  async function postRole(action: "grant_admin" | "revoke_admin") {
    setError("");
    setBusy("role");
    try {
      const res = await fetch(`/admin/api/users/${userId}/role`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy("");
    }
  }

  function onBanClick() {
    if (!window.confirm("Блокиране на потребителя? Няма да може да влиза, докато блокирането е активно.")) {
      return;
    }
    void postBan("ban");
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {banned ? (
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postBan("unban")}
            className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "ban" ? "…" : "Премахни блокирането"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== ""}
            onClick={onBanClick}
            className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-red-950 hover:bg-red-100 disabled:opacity-45"
          >
            {busy === "ban" ? "…" : "Блокирай потребителя"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
        {isAdmin ? (
          <button
            type="button"
            disabled={busy !== "" || !canRevokeAdmin}
            title={isSelf ? "Не можете да премахнете собствената си администраторска роля." : undefined}
            onClick={() => void postRole("revoke_admin")}
            className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "role" ? "…" : "Премахни администратор"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postRole("grant_admin")}
            className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-violet-950 hover:bg-violet-100 disabled:opacity-45"
          >
            {busy === "role" ? "…" : "Направи администратор"}
          </button>
        )}
      </div>
    </div>
  );
}
