"use client";

import { useEffect, useState } from "react";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import type { ReminderType } from "@/lib/plan/server";

type NotificationSettingsPayload = {
  notify_new_festivals_city?: boolean;
  notify_new_festivals_category?: boolean;
  notify_followed_organizers?: boolean;
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

const TIMING_OPTIONS: Array<{ value: ReminderType; label: string }> = [
  { value: "none", label: "Без напомняне" },
  { value: "24h", label: "1 ден по-рано" },
  { value: "same_day_09", label: "В деня (09:00)" },
];

export default function ReminderPreferencesCard() {
  const [defaultPlanReminder, setDefaultPlanReminder] = useState<ReminderType>("24h");
  const [newFestivalsOn, setNewFestivalsOn] = useState(true);
  const [newEventsOn, setNewEventsOn] = useState(true);

  const [loadError, setLoadError] = useState("");
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [savingDefaultTiming, setSavingDefaultTiming] = useState(false);
  const [savingFestivals, setSavingFestivals] = useState(false);
  const [savingEvents, setSavingEvents] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setInitialLoad(true);
      setLoadError("");
      try {
        const nsRes = await fetch("/api/notification-settings", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!mounted) return;

        if (!nsRes.ok) {
          setLoadError("Не успяхме да заредим настройките.");
          return;
        }

        const nsJson = (await nsRes.json()) as { settings?: NotificationSettingsPayload };
        const s = nsJson.settings ?? {};
        setDefaultPlanReminder(parseDefaultPlanReminderType(s.default_plan_reminder_type));
        const city = s.notify_new_festivals_city !== false;
        const category = s.notify_new_festivals_category === true;
        setNewFestivalsOn(city || category);
        setNewEventsOn(s.notify_followed_organizers !== false);
      } catch {
        if (mounted) setLoadError("Не успяхме да заредим настройките.");
      } finally {
        if (mounted) setInitialLoad(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
      setStatusText("Запазено.");
    } catch {
      setDefaultPlanReminder(prev);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingDefaultTiming(false);
    }
  }

  async function updateNewFestivals(next: boolean) {
    const prev = newFestivalsOn;
    setNewFestivalsOn(next);
    setSavingFestivals(true);
    setErrorText("");
    setStatusText("");
    try {
      const res = await fetch("/api/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify_new_festivals_city: next,
          notify_new_festivals_category: next,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { settings?: NotificationSettingsPayload; error?: string };
      if (!res.ok) {
        setNewFestivalsOn(prev);
        setErrorText(json.error ?? messageForFailedSave(res.status));
        return;
      }
      if (json.settings) {
        const city = json.settings.notify_new_festivals_city !== false;
        const category = json.settings.notify_new_festivals_category === true;
        setNewFestivalsOn(city || category);
      }
      setStatusText("Запазено.");
    } catch {
      setNewFestivalsOn(prev);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingFestivals(false);
    }
  }

  async function updateNewEvents(next: boolean) {
    const prev = newEventsOn;
    setNewEventsOn(next);
    setSavingEvents(true);
    setErrorText("");
    setStatusText("");
    try {
      const res = await fetch("/api/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_followed_organizers: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { settings?: NotificationSettingsPayload; error?: string };
      if (!res.ok) {
        setNewEventsOn(prev);
        setErrorText(json.error ?? messageForFailedSave(res.status));
        return;
      }
      if (json.settings?.notify_followed_organizers !== undefined) {
        setNewEventsOn(json.settings.notify_followed_organizers !== false);
      }
      setStatusText("Запазено.");
    } catch {
      setNewEventsOn(prev);
      setErrorText("Мрежова грешка. Опитай отново.");
    } finally {
      setSavingEvents(false);
    }
  }

  const disabled = initialLoad || Boolean(loadError);
  const timingDisabled = disabled || savingDefaultTiming || savingFestivals || savingEvents;

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-[#0c0e14]">Известия</h2>

      {loadError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900" role="alert">
          {loadError}
        </p>
      ) : null}

      {errorText ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900" role="alert">
          {errorText}
        </p>
      ) : null}
      {statusText ? (
        <p className="mt-2 text-sm text-emerald-700" role="status">
          {statusText}
        </p>
      ) : null}

      <p className="mt-5 text-sm font-medium text-[#0c0e14]">Как да напомняме?</p>
      <ul className="mt-2 space-y-0.5">
        {TIMING_OPTIONS.map((opt) => {
          const checked = defaultPlanReminder === opt.value;
          return (
            <li key={opt.value}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-black/[0.03] md:px-2">
                <input
                  type="radio"
                  name="reminder-timing-default"
                  value={opt.value}
                  checked={checked}
                  disabled={timingDisabled}
                  onChange={() => void saveDefaultReminderTiming(opt.value)}
                  className="h-4 w-4 shrink-0 border-black/20 text-pine focus:ring-pine"
                />
                <span className="text-[15px] text-[#0c0e14]">{opt.label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <ul className="mt-6 space-y-3">
        <li className="flex items-center justify-between gap-4">
          <span className="text-[15px] text-[#0c0e14]">Нови фестивали</span>
          {initialLoad ? (
            <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
          ) : (
            <Toggle
              checked={newFestivalsOn}
              disabled={disabled || savingFestivals || savingEvents || savingDefaultTiming}
              onChange={(v) => void updateNewFestivals(v)}
            />
          )}
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="text-[15px] text-[#0c0e14]">Нови събития</span>
          {initialLoad ? (
            <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
          ) : (
            <Toggle
              checked={newEventsOn}
              disabled={disabled || savingEvents || savingFestivals || savingDefaultTiming}
              onChange={(v) => void updateNewEvents(v)}
            />
          )}
        </li>
      </ul>
    </section>
  );
}
