/** Shared styling for admin text-based time / date / datetime fields (24h, no native pickers). */
export const ADMIN_TEXT_TIME_INPUT_CLASS =
  "w-full min-w-0 px-3 py-2 rounded-md border border-black/10 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/30";

export const ADMIN_TEXT_DATE_INPUT_CLASS =
  "w-full min-w-0 px-3 py-2 rounded-md border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/30";

/** @deprecated Use ADMIN_TEXT_DATE_INPUT_CLASS — kept for incremental migration of imports. */
export const ADMIN_NATIVE_DATE_INPUT_CLASS = ADMIN_TEXT_DATE_INPUT_CLASS;

export const ADMIN_NATIVE_TIME_INPUT_CLASS = ADMIN_TEXT_TIME_INPUT_CLASS;

export const ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS = `${ADMIN_TEXT_DATE_INPUT_CLASS} min-h-[2.25rem]`;
