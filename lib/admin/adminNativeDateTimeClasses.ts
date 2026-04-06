import { ADMIN_ENTITY_CONTROL_BASE } from "@/lib/admin/entitySchema";

/**
 * Shared styling for native `<input type="date|time|datetime-local">` in admin.
 * Matches entity control height, border, and radius; improves cross-browser picker chrome.
 */
export const ADMIN_NATIVE_TIME_INPUT_CLASS = `${ADMIN_ENTITY_CONTROL_BASE} w-full min-w-0 tabular-nums [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:shrink-0`;

export const ADMIN_NATIVE_DATE_INPUT_CLASS = `${ADMIN_ENTITY_CONTROL_BASE} w-full min-w-0 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:shrink-0`;

export const ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS = `${ADMIN_ENTITY_CONTROL_BASE} w-full min-w-0 min-h-[2.25rem] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:shrink-0`;
