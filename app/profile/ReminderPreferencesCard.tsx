"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import type { ReminderType } from "@/lib/plan/server";

type PlanRemindersSummary = {
  savedFestivalCount: number;
  timing: ReminderType | "mixed" | null;
};

type EmailPreferences = {
  reminder_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
};

type NotificationSettingsPayload = {
  push_enabled?: boolean;
  default_plan_reminder_type?: ReminderType;
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
  {
    value: "none",
    label: "Без напомняне",
    description:
      "При ново запазване в плана няма да се създава автоматично напомняне по график. Вече запазените не се променят, освен ако не ги уеднаквиш отделно.",
  },
  {
    value: "24h",
    label: "1 ден преди",
    description: "За нови запазвания: около 24 часа преди началото на събитието.",
  },
  {
    value: "same_day_09",
    label: "В деня (около началото)",
    description:
      "За нови запазвания: в деня на събитието — слот около началния час (и ~2 ч преди него, когато е възможно).",
  },
];

function whenPhraseForTiming(timing: ReminderType): string {
  if (timing === "none") {
    return "без напомняне по график";
  }
  if (timing === "24h") {
    return "около 1 ден преди началото";
  }
  return "в деня на събитието (около началото / ~2 ч преди него)";
}

function buildSummary(args: {
  defaultTiming: ReminderType;
  savedFestivalCount: number;
  savedTiming: ReminderType | "mixed" | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
}): string {
  const { defaultTiming, savedFestivalCount, savedTiming, pushEnabled, emailEnabled } = args;

  let savedSentence: string;
  if (savedFestivalCount === 0) {
    savedSentence =
      "Нямаш запазени фестивали в плана — при следващо добавяне ще се ползва настройката по подразбиране по-долу.";
  } else if (savedTiming === "mixed") {
    savedSentence = `Имаш ${savedFestivalCount} запазени фестивала с различно време за напомняне. Можеш да ги уеднаквиш с бутона „Приложи към вече запазените“.`;
  } else if (savedTiming === "none" || savedTiming === null) {
    savedSentence =
      "За текущо запазените няма активно напомняне по време (или е изключено за всички).";
  } else {
    savedSentence = `За текущо запазените времето за напомняне е: ${whenPhraseForTiming(savedTiming)}.`;
  }

  if (defaultTiming === "none") {
    return `${savedSentence} По подразбиране за нови запазвания няма насрочено напомняне по график.`;
  }

  const whenDefault = whenPhraseForTiming(defaultTiming);
  if (pushEnabled && emailEnabled) {
    return `${savedSentence} За нови запазвания напомнянето по график е ${whenDefault} — по push и имейл, когато каналите са наред.`;
  }
  if (pushEnabled) {
    return `${savedSentence} За нови запазвания напомнянето по график е ${whenDefault} — само по push в приложението.`;
  }
  if (emailEnabled) {
    return `${savedSentence} За нови запазвания напомнянето по график е ${whenDefault} — само по имейл.`;
  }
  return `${savedSentence} По подразбиране времето е ${whenDefault}, но и push, и имейл са изключени — няма активен канал за напомняне.`;
}

export default function ReminderPreferencesCard() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    reminder_emails_enabled: true,
    unsubscribed_all_optional: false,
  });
  const [planSummary, setPlanSummary] = useState<PlanRemindersSummary | null>(null);
  const [defaultPlanReminder, setDefaultPlanReminder] = useState<ReminderType>("24h");

  const [loadError, setLoadError] = useState("");
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [savingPush, setSavingPush] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingDefaultTiming, setSavingDefaultTiming] = useState(false);
  const [savingApplySaved, setSavingApplySaved] = useState(false);

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

        const nsJson = (await nsRes.json()) as { settings?: NotificationSettingsPayload };
        const emJson = (await emRes.json()) as { preferences?: Partial<EmailPreferences> };
        const planJson = (await planRes.json()) as PlanRemindersSummary;

        setPushEnabled(nsJson.settings?.push_enabled !== false);
        setDefaultPlanReminder(parseDefaultPlanReminderType(nsJson.settings?.default_plan_reminder_type));
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

  const summary = useMemo(
    () =>
      buildSummary({
        defaultTiming: defaultPlanReminder,
        savedFestivalCount: planSummary?.savedFestivalCount ?? 0,
        savedTiming: planSummary?.timing ?? null,
        pushEnabled,
        emailEnabled: emailPrefs.reminder_emails_enabled && !emailPrefs.unsubscribed_all_optional,
      }),
    [planSummary?.savedFestivalCount, planSummary?.timing, defaultPlanReminder, pushEnabled, emailPrefs],
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
      const payload = (await response.json()) as { settings?: NotificationSettingsPayload };
      if (payload.settings?.push_enabled !== undefined) {
        setPushEnabled(payload.settings.push_enabled !== false);
      }
      if (payload.settings?.default_plan_reminder_type) {
        setDefaultPlanReminder(parseDefaultPlanReminderType(payload.settings.default_plan_reminder_type));
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

  async function saveDefaultReminderTiming(next: ReminderType) {
    const prev = defaultPlanReminder;
    setDefaultPlanReminder(next);
    setSavingDefaultTiming(true);
    setErrorText("");
    setStatusText("");
    try {
      const res = await fetch("/api/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_plan_reminder_type: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { settings?: NotificationSettingsPayload; error?: string };
      if (!res.ok) {
        setDefaultPlanReminder(prev);
        setErrorText(json.error ?? messageForFailedSave(res.status));
        return;
      }
      if (json.settings?.default_plan_reminder_type) {
        setDefaultPlanReminder(parseDefaultPlanReminderType(json.settings.default_plan_reminder_type));
      }
      setStatusText("Запазено е по подразбиране за нови фестивали.");
    } catch {
      setDefaultPlanReminder(prev);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingDefaultTiming(false);
    }
  }

  async function applyTimingToSavedFestivals() {
    const count = planSummary?.savedFestivalCount ?? 0;
    if (count === 0) return;

    setSavingApplySaved(true);
    setErrorText("");
    setStatusText("");
    try {
      const res = await fetch("/api/plan/reminders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderType: defaultPlanReminder, applyToAllSaved: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        festivalCount?: number;
      };
      if (!res.ok) {
        setErrorText(
          json.error ?? "Не успяхме да приложим времето към вече запазените фестивали. Опитай отново.",
        );
        return;
      }
      try {
        const fresh = await reloadPlanSummary();
        setPlanSummary(fresh);
      } catch {
        /* keep prior summary */
      }
      const applied = typeof json.festivalCount === "number" ? json.festivalCount : count;
      setStatusText(`Приложено е към ${applied} запазени фестивала.`);
    } catch {
      setErrorText("Мрежова грешка при прилагане към вече запазените. Опитай отново.");
    } finally {
      setSavingApplySaved(false);
    }
  }

  const channelsDisabled = initialLoad || Boolean(loadError);
  const timingDisabled = initialLoad || Boolean(loadError) || savingDefaultTiming;
  const savedCount = planSummary?.savedFestivalCount ?? 0;
  const applyDisabled =
    channelsDisabled || savedCount === 0 || savingApplySaved || savingDefaultTiming;

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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            По подразбиране за ново запазени фестивали
          </p>
          <p className="mt-1 text-xs text-black/50">
            Това се записва в профила ти и се прилага автоматично при следващо добавяне в плана. Вече запазените не се
            променят, освен ако не използваш бутона по-долу. От детайла на фестивал можеш да нагласиш поотделно.
          </p>
        </div>
        <ul className="divide-y divide-black/[0.06] bg-white">
          {TIMING_OPTIONS.map((opt) => {
            const checked = defaultPlanReminder === opt.value;
            return (
              <li key={opt.value}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-neutral-50/80 md:px-4">
                  <input
                    type="radio"
                    name="reminder-timing-default"
                    value={opt.value}
                    checked={checked}
                    disabled={timingDisabled}
                    onChange={() => void saveDefaultReminderTiming(opt.value)}
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
        {planSummary?.timing === "mixed" && savedCount > 0 && !savingDefaultTiming ? (
          <p className="border-t border-black/[0.06] bg-amber-50/50 px-4 py-2.5 text-xs text-amber-950">
            Запазените фестивали в момента имат различно време. Използвай бутона по-долу, за да ги изравниш с избраното
            по подразбиране.
          </p>
        ) : null}
        <div className="border-t border-black/[0.06] bg-white px-4 py-3">
          <button
            type="button"
            disabled={applyDisabled}
            onClick={() => void applyTimingToSavedFestivals()}
            className="w-full rounded-lg border border-black/[0.12] bg-white px-3 py-2.5 text-sm font-medium text-[#0c0e14] transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingApplySaved ? "Прилагане…" : "Приложи към вече запазените"}
          </button>
          <p className="mt-2 text-xs text-black/45">
            Ползва текущото „по подразбиране“ отгоре и обновява всички запазени фестивали в плана. Няма ефект, ако нямаш
            запазени.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-black/45">
        Напомнянията за плана минават през една и съща опашка: времето променя насрочените задачи; каналите определят дали да
        изпратим push, имейл или и двете, когато дойде моментът.
      </p>
    </section>
  );
}
