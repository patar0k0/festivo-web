"use client";

import { useEffect, useState } from "react";

type EmailPreferences = {
  reminder_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
};

const DEFAULT_PREFS: EmailPreferences = {
  reminder_emails_enabled: true,
  unsubscribed_all_optional: false,
};

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        checked ? "bg-pine shadow-sm" : "bg-neutral-200"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function EmailPreferencesCard() {
  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErrorText("");
      try {
        const res = await fetch("/api/email/preferences", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as { preferences?: Partial<EmailPreferences> };
        if (!mounted) return;
        setPrefs({ ...DEFAULT_PREFS, ...(json.preferences ?? {}) });
      } catch {
        if (mounted) setErrorText("Не успяхме да заредим имейл настройките.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function updateReminderEmails(next: boolean) {
    const prev = prefs.reminder_emails_enabled;
    setPrefs((p) => ({ ...p, reminder_emails_enabled: next }));
    setSaving(true);
    setErrorText("");
    setStatusText("");
    try {
      const res = await fetch("/api/email/preferences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminder_emails_enabled: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { preferences?: EmailPreferences; error?: string };
      if (!res.ok) {
        setPrefs((p) => ({ ...p, reminder_emails_enabled: prev }));
        setErrorText(json.error ?? "Неуспешно запазване.");
        return;
      }
      if (json.preferences) {
        setPrefs((p) => ({ ...p, ...json.preferences }));
      }
      setStatusText("Запазено.");
    } catch {
      setPrefs((p) => ({ ...p, reminder_emails_enabled: prev }));
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="py-6 md:py-7">
      <h2 className="text-base font-semibold text-[#0c0e14]">Имейл напомняния</h2>
      <p className="mt-1 text-sm text-black/55">
        Отделно от push в приложението. Изключването тук спира само имейлите за запазени фестивали (напр. 1 ден и ~2 ч. преди
        начало).
      </p>
      {prefs.unsubscribed_all_optional ? (
        <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Имаш глобално изключени опционални имейли. Включи отново превключвателя по-долу, за да получаваш напомняния по имейл.
        </p>
      ) : null}

      {errorText ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-900" role="alert">
          {errorText}
        </p>
      ) : null}
      {statusText ? (
        <div
          className="mt-4 flex gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950"
          role="status"
        >
          <span className="mt-0.5 shrink-0 text-emerald-700" aria-hidden>
            ✓
          </span>
          <span>{statusText}</span>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[0.08] bg-neutral-50/40">
        <ul className="divide-y divide-black/[0.06]">
          <li>
            <div className="flex items-center justify-between gap-4 bg-white px-4 py-3.5 md:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-[#0c0e14]">Имейл напомняния за плана</p>
                <p className="mt-1 text-xs text-black/50">
                  Задължителните системни имейли (акаунт, организаторски заявки) не се изключват оттук.
                </p>
              </div>
              {loading ? (
                <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
              ) : (
                <Toggle
                  checked={prefs.reminder_emails_enabled}
                  disabled={saving}
                  onChange={(v) => void updateReminderEmails(v)}
                />
              )}
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
