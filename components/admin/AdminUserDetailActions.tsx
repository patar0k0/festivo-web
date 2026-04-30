"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/admin/appRoles";
import { APP_ROLE_VALUES } from "@/lib/admin/appRoles";
type Props = {
  userId: string;
  email: string | null;
  banned: boolean;
  appRole: AppRole;
  deletedAt: string | null;
  emailConfirmed: boolean;
  currentAdminUserId: string;
  showHardDelete: boolean;
};

export default function AdminUserDetailActions({
  userId,
  email,
  banned,
  appRole,
  deletedAt,
  emailConfirmed,
  currentAdminUserId,
  showHardDelete,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "ban" | "role" | "logout" | "reset" | "email" | "soft" | "hard" | "restore">("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<AppRole>(appRole);
  const [hardModal, setHardModal] = useState(false);
  const [hardEmail, setHardEmail] = useState("");
  const [hardPhrase, setHardPhrase] = useState("");
  const [softModal, setSoftModal] = useState(false);

  useEffect(() => {
    setRole(appRole);
  }, [appRole]);

  const isSelf = userId === currentAdminUserId;
  const isDeleted = Boolean(deletedAt);
  const actionsDisabled = isDeleted || busy !== "";

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

  async function patchRole(next: AppRole) {
    setError("");
    setBusy("role");
    try {
      const res = await fetch(`/admin/api/users/${userId}/role`, {
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

  async function postForceLogout() {
    if (!window.confirm("Изход от всички сесии на този потребител?")) return;
    setError("");
    setBusy("logout");
    try {
      const res = await fetch(`/admin/api/users/${userId}/force-logout`, {
        method: "POST",
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

  async function postResetPassword() {
    if (!window.confirm("Изпращане на линк за нова парола на имейла на потребителя?")) return;
    setError("");
    setBusy("reset");
    try {
      const res = await fetch(`/admin/api/users/${userId}/reset-password`, {
        method: "POST",
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

  async function postEmailVerified(next: boolean) {
    setError("");
    setBusy("email");
    try {
      const res = await fetch(`/admin/api/users/${userId}/email-verified`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: next }),
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

  async function postSoftDelete() {
    setError("");
    setBusy("soft");
    try {
      const res = await fetch(`/admin/api/users/${userId}`, { method: "DELETE", credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      setSoftModal(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy("");
    }
  }

  async function postRestore() {
    setError("");
    setBusy("restore");
    try {
      const res = await fetch(`/admin/api/users/${userId}/restore`, {
        method: "POST",
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

  async function postHardDelete() {
    setError("");
    setBusy("hard");
    try {
      const res = await fetch(`/admin/api/users/${userId}/hard`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: hardEmail.trim(), confirm_phrase: hardPhrase.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      router.push("/admin/users");
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
    <div className="space-y-6">
      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Права (роля)</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={role}
            disabled={actionsDisabled || isSelf}
            title={isSelf ? "Променете ролята си от друг администраторски акаунт." : undefined}
            onChange={(e) => {
              const v = e.target.value as AppRole;
              setRole(v);
              void patchRole(v);
            }}
            className="rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm disabled:opacity-45"
          >
            {APP_ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {r === "user"
                  ? "Потребител"
                  : r === "organizer"
                    ? "Организатор"
                    : r === "admin"
                      ? "Администратор"
                      : "Super администратор"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Сигурност</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => void postForceLogout()}
            className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "logout" ? "…" : "Принудителен изход"}
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => void postResetPassword()}
            className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "reset" ? "…" : "Нова парола (имейл)"}
          </button>
          <button
            type="button"
            disabled={isDeleted || busy !== ""}
            onClick={() => void postEmailVerified(!emailConfirmed)}
            className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "email" ? "…" : emailConfirmed ? "Маркирай имейл като непотвърден" : "Маркирай имейл като потвърден"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Блокиране</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {banned ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void postBan("unban")}
              className="inline-flex rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
            >
              {busy === "ban" ? "…" : "Премахни блокирането"}
            </button>
          ) : (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={onBanClick}
              className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-red-950 hover:bg-red-100 disabled:opacity-45"
            >
              {busy === "ban" ? "…" : "Блокирай потребителя"}
            </button>
          )}
        </div>
      </div>

      {isDeleted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
          <p className="text-sm font-medium text-amber-950">Потребителят е изтрит (деактивиран).</p>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postRestore()}
            className="mt-3 inline-flex rounded-lg border border-black/[0.15] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04] disabled:opacity-45"
          >
            {busy === "restore" ? "…" : "Възстанови акаунта"}
          </button>
        </div>
      ) : null}

      {!isDeleted ? (
        <div className="rounded-xl border border-red-200/90 bg-red-50/50 p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-red-950">Опасна зона</h3>
          <p className="mt-1 text-xs text-red-900/80">Деактивираните потребители не могат да влизат.</p>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => setSoftModal(true)}
            className="mt-3 inline-flex rounded-lg border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-red-700 disabled:opacity-45"
          >
            Изтрий потребител
          </button>

          {showHardDelete ? (
            <div className="mt-4 border-t border-red-200/80 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-950">Development: твърдо изтриване</p>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => {
                  setHardEmail("");
                  setHardPhrase("");
                  setHardModal(true);
                }}
                className="mt-2 inline-flex rounded-lg border-2 border-red-800 bg-red-950 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-red-900 disabled:opacity-45"
              >
                ИЗТРИЙ ЗАВИНАГИ
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {softModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-2xl border border-black/[0.1] bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-[#0c0e14]">Потребителят ще бъде деактивиран</p>
            <p className="mt-2 text-xs text-black/65">Няма да може да влиза, докато не бъде възстановен.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
                onClick={() => setSoftModal(false)}
              >
                Отказ
              </button>
              <button
                type="button"
                disabled={busy === "soft"}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-red-700 disabled:opacity-45"
                onClick={() => void postSoftDelete()}
              >
                {busy === "soft" ? "…" : "Потвърди"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-2xl border border-red-300 bg-white p-5 shadow-xl">
            <p className="text-sm font-black uppercase tracking-[0.08em] text-red-950">Твърдо изтриване</p>
            <p className="mt-2 text-xs text-black/70">
              Това премахва акаунта и свързаните данни. Напишете точно <strong className="font-mono">DELETE</strong> и
              имейла на потребителя: <strong>{email ?? "—"}</strong>
            </p>
            <input
              value={hardPhrase}
              onChange={(e) => setHardPhrase(e.target.value)}
              className="mt-3 w-full rounded-lg border border-black/[0.15] px-2.5 py-2 text-sm font-mono"
              placeholder="Напишете DELETE"
              autoComplete="off"
              spellCheck={false}
            />
            <input
              value={hardEmail}
              onChange={(e) => setHardEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-black/[0.15] px-2.5 py-2 text-sm"
              placeholder="Имейл за потвърждение"
              autoComplete="off"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
                onClick={() => setHardModal(false)}
              >
                Отказ
              </button>
              <button
                type="button"
                disabled={
                  busy === "hard" ||
                  hardPhrase.trim() !== "DELETE" ||
                  hardEmail.trim().toLowerCase() !== (email?.trim().toLowerCase() ?? "")
                }
                className="rounded-lg bg-red-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-red-900 disabled:opacity-45"
                onClick={() => {
                  if (!window.confirm("Финално потвърждение: безвъзвратно изтриване?")) return;
                  void postHardDelete();
                }}
              >
                {busy === "hard" ? "…" : "Изтрий завинаги"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
