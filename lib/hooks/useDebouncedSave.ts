import { useCallback, useEffect, useRef } from "react";

type DebouncedSaveOptions = {
  /** Debounce delay in ms (e.g. 800–1200). */
  delayMs: number;
  /** Invoked after debounce; return true if save succeeded. */
  onSave: () => Promise<boolean>;
};

/**
 * Schedules a single trailing save after `delayMs` of quiet time.
 * Call `schedule()` on each change; `cancel()` to abort pending run (e.g. unmount or flush).
 */
export function useDebouncedSave({ delayMs, onSave }: DebouncedSaveOptions) {
  const timerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancel();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void onSaveRef.current();
    }, delayMs);
  }, [cancel, delayMs]);

  useEffect(() => () => cancel(), [cancel]);

  return { schedule, cancel };
}
