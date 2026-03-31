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

function messageForFailedSave(status: number, serverMessage?: string): string {
  if (status === 401) {
    return "Сесията не е валидна. Влез отново и опитай пак.";
  }
  if (status === 403) {
    return "Заявката е отхвърлена от сървъра (защита от фалшиви форми). Презареди страницата от официалния адрес на сайта.";
  }
  if (status === 429) {
    return "Твърде много опити за кратко време. Изчакай малко и опитай отново.";
  }
  if (status === 400 && serverMessage) {
    return serverMessage;
  }
  if (status >= 500) {
    return "Сървърна грешка при запазване. Опитай по-късно.";
  }
  return "Неуспешно запазване. Опитай отново.";
}

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
        let serverError: string | undefined;
        try {
          const errJson = (await response.json()) as { error?: string };
          serverError = errJson.error;
        } catch {
          /* not JSON */
        }
        if (process.env.NODE_ENV === "development") {
          console.error("[notification-settings] POST failed", response.status, serverError);
        }
        setSettings((current) => ({ ...current, [key]: prev }));
        setErrorText(messageForFailedSave(response.status, serverError));
        return;
      }

      const payload = (await response.json()) as { settings?: Partial<NotificationSettings> };
      if (payload.settings) {
        setSettings((current) => ({ ...current, ...payload.settings }));
      }
      setStatusText("Настройката е запазена.");
    } catch {
      setSettings((current) => ({ ...current, [key]: prev }));
      setErrorText("Мрежова грешка или прекъсната връзка. Провери интернета и опитай отново.");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <section className="py-6 md:py-7">
      <h2 className="text-base font-semibold text-[#0c0e14]">Push известия</h2>
      <p className="mt-1 text-sm text-black/55">
        Включи или изключи известията по тип. Промените се запазват веднага.
      </p>
      <p className="mt-2 text-sm text-black/50">Известията се изпращат към мобилното приложение Festivo.</p>

      {errorText ? (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm leading-relaxed text-red-900"
          role="alert"
        >
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
        {isLoading ? (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-4">
                <div className="h-4 w-[min(100%,14rem)] animate-pulse rounded bg-black/[0.08]" />
                <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-center justify-between gap-4 bg-white px-4 py-3.5 transition hover:bg-neutral-50/80 md:px-4">
                  <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-[#0c0e14]">{row.label}</p>
                  <Toggle
                    checked={row.value}
                    disabled={isLoading || (isSaving !== null && isSaving !== row.key)}
                    onChange={(nextValue) => void updateSetting(row.key, nextValue)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
