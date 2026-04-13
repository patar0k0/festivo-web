"use client";

import { useCallback, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  const Toast = () =>
    message ? (
      <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
        {message}
      </div>
    ) : null;

  return { show, Toast };
}
