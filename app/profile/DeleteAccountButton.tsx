"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Сигурен ли си? Това действие е необратимо.")) return;
    setErrorText(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) {
        setErrorText(body.error ?? "Неуспешно изтриване на акаунта.");
        return;
      }
      try {
        const supabase = createSupabaseBrowser();
        await supabase.auth.signOut();
      } catch {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      }
      router.push("/");
      router.refresh();
    } catch {
      setErrorText("Неуспешно изтриване на акаунта.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleDelete()}
        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-transparent px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
      >
        {loading ? "Изтриване…" : "Изтрий акаунта"}
      </button>
      {errorText ? <p className="mt-2 text-sm text-red-700">{errorText}</p> : null}
    </div>
  );
}
