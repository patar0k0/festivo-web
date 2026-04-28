"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type OrganizerProfileEditFormProps = {
  organizerId: string;
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
  };
};

export default function OrganizerProfileEditForm({ organizerId, initial }: OrganizerProfileEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState({
    logo_url: initial.logo_url || "",
  });
  const [uploading, setUploading] = useState(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  function isValidUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      logo_url: form.logo_url.trim(),
      website_url: String(formData.get("website") ?? "").trim(),
      facebook_url: String(formData.get("facebook") ?? "").trim(),
    };

    if (!payload.name) {
      setError("Името е задължително");
      return;
    }
    if (payload.website_url && !isValidUrl(payload.website_url)) {
      setError("Невалиден уебсайт URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/organizers/${organizerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(typeof body.error === "string" ? body.error : "Грешка при запис");
        return;
      }

      setSuccess(true);
      setIsDirty(false);
      redirectTimeoutRef.current = window.setTimeout(() => {
        window.location.href = "/organizer/dashboard";
      }, 1200);
    } catch {
      setError("Грешка при запис");
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange() {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    setError(null);
    setSuccess(false);
    setIsDirty(true);
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Файлът трябва да е изображение");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Максимален размер 2MB");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch(`/api/organizers/${organizerId}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? "Грешка при качване на лого");
        return;
      }

      setForm((f) => ({
        ...f,
        logo_url: data.url!,
      }));

      setIsDirty(true);
      setError(null);
      setSuccess(false);
    } catch {
      setError("Грешка при качване на лого");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#0c0e14]">
          Име
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initial.name}
          onChange={handleFieldChange}
          className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#0c0e14]">
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial.description}
          onChange={handleFieldChange}
          className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label htmlFor="logo_url" className="mb-1 block text-sm font-medium text-[#0c0e14]">
          Лого
        </label>
        <input type="file" accept="image/*" onChange={handleLogoUpload} className="mt-1" />
        {uploading ? (
          <p className="mt-1 text-xs text-gray-500">Качване...</p>
        ) : null}
        <p className="mt-1 text-xs text-gray-500">Можеш да качиш снимка или да поставиш URL</p>
        {form.logo_url ? (
          <img src={form.logo_url} alt="Лого преглед" className="mt-2 h-16 w-16 rounded border object-cover" />
        ) : null}
        <input
          id="logo_url"
          name="logo_url"
          type="url"
          value={form.logo_url || ""}
          onChange={(e) => {
            handleFieldChange();
            setForm((f) => ({ ...f, logo_url: e.target.value }));
          }}
          className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label htmlFor="website" className="mb-1 block text-sm font-medium text-[#0c0e14]">
          Уебсайт
        </label>
        <input
          id="website"
          name="website"
          type="url"
          defaultValue={initial.website_url}
          onChange={handleFieldChange}
          className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label htmlFor="facebook" className="mb-1 block text-sm font-medium text-[#0c0e14]">
          Facebook
        </label>
        <input
          id="facebook"
          name="facebook"
          type="url"
          defaultValue={initial.facebook_url}
          onChange={handleFieldChange}
          className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-2 text-sm font-medium text-green-700">✓ Промените са запазени</p> : null}

      <button
        type="submit"
        disabled={loading || !isDirty}
        className={cn(
          "rounded-lg px-4 py-2 text-sm transition",
          loading || !isDirty
            ? "cursor-not-allowed bg-gray-200 text-gray-500"
            : "bg-black text-white hover:bg-black/90",
        )}
      >
        {loading ? "Запазване..." : "Запази промените"}
      </button>
      {!isDirty && !loading ? <p className="mt-2 text-xs text-gray-500">Няма направени промени</p> : null}
    </form>
  );
}
