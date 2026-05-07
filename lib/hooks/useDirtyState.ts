import { useCallback, useState } from "react";

/**
 * Compares JSON snapshots of persisted vs current data for dirty detection.
 * Call `setLastSaved` after a successful save with the same shape used for `checkDirty`.
 */
export function useDirtyState<T>(initialLastSaved: T) {
  const [lastSaved, setLastSaved] = useState<T>(initialLastSaved);

  const checkDirty = useCallback(
    (current: T) => JSON.stringify(current) !== JSON.stringify(lastSaved),
    [lastSaved],
  );

  return { lastSaved, setLastSaved, checkDirty };
}
