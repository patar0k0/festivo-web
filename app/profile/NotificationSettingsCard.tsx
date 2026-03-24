"use client";

import { useEffect, useMemo, useState } from "react";

type NotificationSettings = {
  notify_plan_reminders: boolean;
  notify_new_festivals_city: boolean;
  notify_new_festivals_category: boolean;
  notify_followed_organizers: boolean;
  notify_weekend_digest: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  notify_plan_reminders: true,
  notify_new_festivals_city: true,
  notify_new_festivals_category: false,
  notify_followed_organizers: true,
  notify_weekend_digest: false,
};

const SETTING_LABELS: Record<keyof NotificationSettings, string> = {
  notify_plan_reminders: "Напомняния за запазени фестивали",
  notify_new_festivals_city: "Нови фестивали в следвани градове",
  notify_new_festivals_category: "Нови фестивали в следвани категории",
  notify_followed_organizers: "Нови събития от следвани организатори",
  notify_weekend_digest: "Уикенд обзор (digest)",
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
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        checked ? "bg-[#0c0e14]" : "bg-black/15"
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

export default function NotificationSettingsCard() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<keyof NotificationSettings | null>(null);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      setIsLoading(true);
      setErrorText("");
      try {
        const response = await fetch("/api/notification-settings", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Неуспешно зареждане на настройките.");
        }
        const payload = (await response.json()) as { settings?: Partial<NotificationSettings> };
        if (!mounted) return;
        setSettings({ ...DEFAULT_SETTINGS, ...(payload.settings ?? {}) });
      } catch {
        if (!mounted) return;
        setErrorText("Не успяхме да заредим настройките за известия.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      (Object.keys(SETTING_LABELS) as Array<keyof NotificationSettings>).map((key) => ({
        key,
        label: SETTING_LABELS[key],
        value: settings[key],
      })),
    [settings],
  );

  async function updateSetting(key: keyof NotificationSettings, nextValue: boolean) {
    const prev = settings[key];
    setSettings((current) => ({ ...current, [key]: nextValue }));
    setErrorText("");
    setStatusText("");
    setIsSaving(key);

    try {
      const response = await fetch("/api/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextValue }),
      });

      if (!response.ok) {
        throw new Error("save_failed");
      }

      const payload = (await response.json()) as { settings?: Partial<NotificationSettings> };
      if (payload.settings) {
        setSettings((current) => ({ ...current, ...payload.settings }));
      }
      setStatusText("Настройката е запазена.");
    } catch {
      setSettings((current) => ({ ...current, [key]: prev }));
      setErrorText("Неуспешно запазване. Опитай отново.");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-black/55">Известия</h2>
      <p className="mt-2 text-sm text-black/55">Управлявай push известията за профила си.</p>

      {errorText ? (
        <p className="mt-3 rounded-xl bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
          {errorText}
        </p>
      ) : null}
      {statusText ? (
        <p className="mt-3 rounded-xl bg-[#0c0e14]/6 px-3 py-2 text-sm text-[#0c0e14]" role="status">
          {statusText}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5"
          >
            <p className="text-sm text-[#0c0e14]">{row.label}</p>
            <Toggle
              checked={row.value}
              disabled={isLoading || (isSaving !== null && isSaving !== row.key)}
              onChange={(nextValue) => void updateSetting(row.key, nextValue)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
