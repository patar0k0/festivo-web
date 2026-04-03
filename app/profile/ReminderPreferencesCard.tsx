"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReminderType } from "@/lib/plan/server";

type PlanRemindersSummary = {
  savedFestivalCount: number;
  timing: ReminderType | "mixed" | null;
};

type EmailPreferences = {
  reminder_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
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

function messageForFailedSave(status: number, serverMessage?: string): string {
  if (status === 401) {
    return "Сесията не е валидна. Влез отново и опитай пак.";
  }
  if (status === 403) {
    return "Заявката е отхвърлена от сървъра. Презареди страницата от официалния адрес на сайта.";
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

const TIMING_OPTIONS: Array<{ value: ReminderType; label: string; description: string }> = [
  { value: "none", label: "Без напомняне", description: "Няма насрочени напомняния за запазените фестивали." },
  { value: "24h", label: "1 ден преди", description: "Около 24 часа преди началото на събитието." },
  {
    value: "same_day_09",
    label: "В деня (около началото)",
    description: "В деня на събитието — слот около началния час (и ~2 ч преди него, когато е възможно).",
  },
];

function summaryLine(args: {
  savedFestivalCount: number;
  timing: ReminderType | "mixed" | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
}): string {
  const { savedFestivalCount, timing, pushEnabled, emailEnabled } = args;
  if (savedFestivalCount === 0) {
    return "Нямаш запазени фестивали в плана — времето по-долу ще се приложи, когато добавиш такива.";
  }
  if (timing === "mixed") {
    return "Имаш различно време за отделни фестивали. Избери опция по-долу, за да я уеднаквиш за всички запазени.";
  }
  if (timing === "none" || timing === null) {
    return "За запазените фестивали няма активно напомняне по време.";
  }

  const when =
    timing === "24h"
      ? "около 1 ден преди началото"
      : "в деня на събитието (около началото / ~2 ч преди него)";

  if (pushEnabled && emailEnabled) {
    return `Ще получаваш напомняния ${when} по push и имейл (ако си логнат в приложението и имейлът е наред).`;
  }
  if (pushEnabled) {
    return `Ще получаваш напомняния ${when} само по push в приложението.`;
  }
  if (emailEnabled) {
    return `Ще получаваш напомняния ${when} само по имейл.`;
  }
  return `Времето е зададено (${when}), но и push, и имейл са изключени — няма активен канал за напомняне.`;
}

export default function ReminderPreferencesCard() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    reminder_emails_enabled: true,
    unsubscribed_all_optional: false,
  });
  const [planSummary, setPlanSummary] = useState<PlanRemindersSummary | null>(null);

  const [loadError, setLoadError] = useState("");
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [savingPush, setSavingPush] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingTiming, setSavingTiming] = useState(false);

  const reloadPlanSummary = useCallback(async () => {
    const res = await fetch("/api/plan/reminders", { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      throw new Error("plan summary");
    }
    return (await res.json()) as PlanRemindersSummary;
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setInitialLoad(true);
      setLoadError("");
      try {
        const [nsRes, emRes, planRes] = await Promise.all([
          fetch("/api/notification-settings", { method: "GET", credentials: "include", cache: "no-store" }),
          fetch("/api/email/preferences", { credentials: "include", cache: "no-store" }),
          fetch("/api/plan/reminders", { credentials: "include", cache: "no-store" }),
        ]);

        if (!mounted) return;

        if (!nsRes.ok || !emRes.ok || !planRes.ok) {
          setLoadError("Не успяхме да заредим настройките за напомняния.");
          return;
        }

        const nsJson = (await nsRes.json()) as { settings?: { push_enabled?: boolean } };
        const emJson = (await emRes.json()) as { preferences?: Partial<EmailPreferences> };
        const planJson = (await planRes.json()) as PlanRemindersSummary;

        setPushEnabled(nsJson.settings?.push_enabled !== false);
        setEmailPrefs({
          reminder_emails_enabled: emJson.preferences?.reminder_emails_enabled !== false,
          unsubscribed_all_optional: emJson.preferences?.unsubscribed_all_optional === true,
        });
        setPlanSummary(planJson);
      } catch {
        if (mounted) setLoadError("Не успяхме да заредим настройките за напомняния.");
      } finally {
        if (mounted) setInitialLoad(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const timingValue = planSummary?.timing ?? null;
  const selectedTimingForRadio: ReminderType | null =
    timingValue === "mixed" || timingValue === null ? null : timingValue;

  const summary = useMemo(
    () =>
      summaryLine({
        savedFestivalCount: planSummary?.savedFestivalCount ?? 0,
        timing: timingValue,
        pushEnabled,
        emailEnabled: emailPrefs.reminder_emails_enabled && !emailPrefs.unsubscribed_all_optional,
      }),
    [planSummary?.savedFestivalCount, timingValue, pushEnabled, emailPrefs],
  );

  async function updatePush(next: boolean) {
    const prev = pushEnabled;
    setPushEnabled(next);
    setSavingPush(true);
    setErrorText("");
    setStatusText("");
    try {
      const response = await fetch("/api/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_enabled: next }),
      });
      if (!response.ok) {
        let serverError: string | undefined;
        try {
          const errJson = (await response.json()) as { error?: string };
          serverError = errJson.error;
        } catch {
          /* not JSON */
        }
        setPushEnabled(prev);
        setErrorText(messageForFailedSave(response.status, serverError));
        return;
      }
      const payload = (await response.json()) as { settings?: { push_enabled?: boolean } };
      if (payload.settings?.push_enabled !== undefined) {
        setPushEnabled(payload.settings.push_enabled !== false);
      }
      setStatusText("Запазено.");
    } catch {
      setPushEnabled(prev);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingPush(false);
    }
  }

  async function updateEmailReminder(next: boolean) {
    const prev = emailPrefs.reminder_emails_enabled;
    setEmailPrefs((p) => ({ ...p, reminder_emails_enabled: next }));
    setSavingEmail(true);
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
        setEmailPrefs((p) => ({ ...p, reminder_emails_enabled: prev }));
        setErrorText(json.error ?? messageForFailedSave(res.status));
        return;
      }
      if (json.preferences) {
        setEmailPrefs((p) => ({ ...p, ...json.preferences }));
      }
      setStatusText("Запазено.");
    } catch {
      setEmailPrefs((p) => ({ ...p, reminder_emails_enabled: prev }));
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function updateTiming(next: ReminderType) {
    setSavingTiming(true);
    setErrorText("");
    setStatusText("");
    const prevSummary = planSummary;
    setPlanSummary((s) =>
      s ? { ...s, timing: next, savedFestivalCount: s.savedFestivalCount } : { savedFestivalCount: 0, timing: next },
    );
    try {
      const res = await fetch("/api/plan/reminders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderType: next, applyToAllSaved: true }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (prevSummary) setPlanSummary(prevSummary);
        setErrorText(json.error ?? messageForFailedSave(res.status));
        return;
      }
      try {
        const fresh = await reloadPlanSummary();
        if (fresh.savedFestivalCount === 0) {
          setPlanSummary({ savedFestivalCount: 0, timing: next });
        } else {
          setPlanSummary(fresh);
        }
      } catch {
        setPlanSummary((s) => (s ? { ...s, timing: next } : { savedFestivalCount: 0, timing: next }));
      }
      setStatusText("Времето за напомняне е обновено за всички запазени фестивали.");
    } catch {
      if (prevSummary) setPlanSummary(prevSummary);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingTiming(false);
    }
  }

  const channelsDisabled = initialLoad || Boolean(loadError);
  const timingDisabled = initialLoad || Boolean(loadError) || savingTiming;

  return (
    <section className="py-6 md:py-7">
      <h2 className="text-base font-semibold text-[#0c0e14]">Напомняния</h2>
      <p className="mt-1 text-sm text-black/55">
        Контролирай каналите и кога да те уведомяваме за запазените в плана фестивали. Промените по каналите не пипат
        графика на задачите — само как се изпраща съобщението.
      </p>

      {loadError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-900" role="alert">
          {loadError}
        </p>
      ) : null}

      {emailPrefs.unsubscribed_all_optional ? (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Имаш глобално изключени опционални имейли. Включи отново превключвателя за имейл напомняния, за да получаваш
          такива.
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

      <p className="mt-4 text-sm leading-relaxed text-black/60">{summary}</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[0.08] bg-neutral-50/40">
        <div className="border-b border-black/[0.06] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Канали</p>
        </div>
        <ul className="divide-y divide-black/[0.06]">
          <li>
            <div className="flex items-center justify-between gap-4 bg-white px-4 py-3.5 md:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-[#0c0e14]">🔔 Push известия</p>
                <p className="mt-1 text-xs text-black/50">Мобилното приложение Festivo (FCM).</p>
              </div>
              {initialLoad ? (
                <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
              ) : (
                <Toggle
                  checked={pushEnabled}
                  disabled={channelsDisabled || savingPush}
                  onChange={(v) => void updatePush(v)}
                />
              )}
            </div>
          </li>
          <li>
            <div className="flex items-center justify-between gap-4 bg-white px-4 py-3.5 md:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-[#0c0e14]">📧 Имейл напомняния</p>
                <p className="mt-1 text-xs text-black/50">Само за запазени фестивали; отделно от push.</p>
              </div>
              {initialLoad ? (
                <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
              ) : (
                <Toggle
                  checked={emailPrefs.reminder_emails_enabled}
                  disabled={channelsDisabled || savingEmail}
                  onChange={(v) => void updateEmailReminder(v)}
                />
              )}
            </div>
          </li>
        </ul>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-black/[0.08] bg-neutral-50/40">
        <div className="border-b border-black/[0.06] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Кога да напомняме</p>
          <p className="mt-1 text-xs text-black/50">
            Важи за всички фестивали, които са в твоя план. От детайла на фестивал можеш да нагласяш поотделно.
          </p>
        </div>
        <ul className="divide-y divide-black/[0.06] bg-white">
          {TIMING_OPTIONS.map((opt) => {
            const checked = selectedTimingForRadio === opt.value;
            return (
              <li key={opt.value}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-neutral-50/80 md:px-4">
                  <input
                    type="radio"
                    name="reminder-timing-global"
                    value={opt.value}
                    checked={checked}
                    disabled={timingDisabled}
                    onChange={() => void updateTiming(opt.value)}
                    className="mt-1 h-4 w-4 shrink-0 border-black/20 text-pine focus:ring-pine"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[#0c0e14]">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-black/50">{opt.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {timingValue === "mixed" && !savingTiming ? (
          <p className="border-t border-black/[0.06] bg-amber-50/50 px-4 py-2.5 text-xs text-amber-950">
            Избери една опция, за да я приложиш към всички запазени фестивали.
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-black/45">
        Напомнянията за плана минават през една и съща опашка: времето променя насрочените задачи; каналите определят дали да
        изпратим push, имейл или и двете, когато дойде моментът.
      </p>
    </section>
  );
}
