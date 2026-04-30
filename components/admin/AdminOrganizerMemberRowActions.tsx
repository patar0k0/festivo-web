"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ROLES: { value: string; label: string }[] = [
  { value: "owner", label: "Собственик" },
  { value: "admin", label: "Админ (орг.)" },
  { value: "editor", label: "Редактор" },
  { value: "viewer", label: "Наблюдател" },
];

type Props = {
  membershipId: string;
  currentRole: string;
  disabled: boolean;
};

export default function AdminOrganizerMemberRowActions({ membershipId, currentRole, disabled }: Props) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [busy, setBusy] = useState<"" | "role" | "remove">("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  async function patchRole(next: string) {
    setError("");
    setBusy("role");
    try {
      const res = await fetch(`/admin/api/organizer-members/${membershipId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      setRole(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy("");
    }
  }

  async function removeMember() {
    if (!window.confirm("Премахване на потребителя от този организатор? Статусът ще стане „оттеглен“.")) {
      return;
    }
    setError("");
    setBusy("remove");
    try {
      const res = await fetch(`/admin/api/organizer-members/${membershipId}`, {
        method: "DELETE",
        credentials: "include",
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

  return (
    <div className="flex flex-col gap-1 border-t border-black/[0.06] pt-2 sm:border-t-0 sm:pt-0">
      {error ? <span className="text-[11px] text-[#b13a1a]">{error}</span> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={role}
          disabled={disabled || busy !== ""}
          onChange={(e) => {
            const v = e.target.value;
            setRole(v);
            void patchRole(v);
          }}
          className="rounded border border-black/[0.12] bg-white px-1.5 py-1 text-[11px] font-medium disabled:opacity-45"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || busy !== ""}
          onClick={() => void removeMember()}
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-950 hover:bg-red-100 disabled:opacity-45"
        >
          {busy === "remove" ? "…" : "Премахни"}
        </button>
      </div>
    </div>
  );
}
