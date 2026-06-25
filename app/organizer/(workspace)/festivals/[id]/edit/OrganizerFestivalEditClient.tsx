"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import OrganizerProgramEditor from "@/app/organizer/(workspace)/festivals/new/OrganizerProgramEditor";
import { emptyProgramDraft, type ProgramDraft } from "@/lib/festival/programDraft";

export type OrganizerFestivalEditInitial = {
  id: string;
  title: string;
  description: string;
  descriptionShort: string;
  category: string;
  tagsInput: string;
  city: string;
  locationName: string;
  address: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  occurrenceDates: string[];
  heroImage: string;
  websiteUrl: string;
  ticketUrl: string;
  priceRange: string;
  isFree: boolean;
  videoUrl: string;
  gallery: { id: string; url: string }[];
  programDraft: ProgramDraft;
};

const FIELD_CLASS =
  "w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-[#7c2d12]/25";
const LABEL_CLASS = "block text-xs font-medium text-[#0c0e14] mb-1";

export default function OrganizerFestivalEditClient({ initial }: { initial: OrganizerFestivalEditInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [descriptionShort, setDescriptionShort] = useState(initial.descriptionShort);
  const [category, setCategory] = useState(initial.category);
  const [tagsInput, setTagsInput] = useState(initial.tagsInput);
  const [city, setCity] = useState(initial.city);
  const [locationName, setLocationName] = useState(initial.locationName);
  const [address, setAddress] = useState(initial.address);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [occurrenceDatesInput, setOccurrenceDatesInput] = useState(initial.occurrenceDates.join(", "));
  const [heroImageUrl, setHeroImageUrl] = useState(initial.heroImage);
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl);
  const [ticketUrl, setTicketUrl] = useState(initial.ticketUrl);
  const [priceRange, setPriceRange] = useState(initial.priceRange);
  const [isFree, setIsFree] = useState(initial.isFree);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [gallery, setGallery] = useState(initial.gallery);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(initial.programDraft ?? emptyProgramDraft());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveCoreFields() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const occurrenceDates = occurrenceDatesInput
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/organizer/festivals/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          description_short: descriptionShort || null,
          category: category || null,
          tags,
          city,
          location_name: locationName || null,
          address: address || null,
          start_date: startDate || null,
          end_date: endDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          occurrence_dates: occurrenceDates.length > 0 ? occurrenceDates : null,
          hero_image: heroImageUrl || null,
          website_url: websiteUrl || null,
          ticket_url: ticketUrl || null,
          price_range: priceRange || null,
          is_free: isFree,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Неуспешно запазване.");
        return;
      }
      setSuccess("Запазено.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспешно запазване.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVideo() {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media/video`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoUrl || null }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно запазване на видео.");
      return;
    }
    setSuccess("Видео връзката е обновена.");
  }

  async function addGalleryImage() {
    setError("");
    setSuccess("");
    const sourceUrl = galleryUrlInput.trim();
    if (!sourceUrl) return;
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: sourceUrl }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; row?: { id: string; url: string } };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно добавяне на снимка.");
      return;
    }
    if (payload.row) {
      setGallery((prev) => [...prev, { id: payload.row!.id, url: payload.row!.url }]);
    }
    setGalleryUrlInput("");
  }

  async function removeGalleryImage(mediaId: string) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/media/${mediaId}`, { method: "DELETE" });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно премахване на снимка.");
      return;
    }
    setGallery((prev) => prev.filter((g) => g.id !== mediaId));
  }

  async function saveSchedule() {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/organizer/festivals/${initial.id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program_draft: programDraft }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Неуспешно запазване на програмата.");
      return;
    }
    setSuccess("Програмата е обновена.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0c0e14]">Редактирай фестивал</h1>
        <Link href="/organizer/dashboard" className="text-sm text-black/60 hover:underline">
          ← Назад към таблото
        </Link>
      </div>

      {error ? <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div> : null}

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Основна информация</h2>
        <label className={LABEL_CLASS}>
          Заглавие
          <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Описание
          <textarea className={FIELD_CLASS} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Кратко описание
          <input className={FIELD_CLASS} value={descriptionShort} onChange={(e) => setDescriptionShort(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Категория
          <input className={FIELD_CLASS} value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Тагове (разделени със запетая)
          <input className={FIELD_CLASS} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Локация</h2>
        <label className={LABEL_CLASS}>
          Град
          <input className={FIELD_CLASS} value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Място
          <input className={FIELD_CLASS} value={locationName} onChange={(e) => setLocationName(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Адрес
          <input className={FIELD_CLASS} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Дати и време</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL_CLASS}>
            Начална дата
            <input type="date" className={FIELD_CLASS} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Крайна дата
            <input type="date" className={FIELD_CLASS} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Начален час
            <input type="time" className={FIELD_CLASS} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            Краен час
            <input type="time" className={FIELD_CLASS} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <label className={LABEL_CLASS}>
          Конкретни дни (ако фестивалът не е непрекъснат), разделени със запетая, YYYY-MM-DD
          <input className={FIELD_CLASS} value={occurrenceDatesInput} onChange={(e) => setOccurrenceDatesInput(e.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Допълнително</h2>
        <label className={LABEL_CLASS}>
          Основна снимка (връзка)
          <input className={FIELD_CLASS} value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Уебсайт
          <input className={FIELD_CLASS} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Връзка за билети
          <input className={FIELD_CLASS} value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Ценови диапазон
          <input className={FIELD_CLASS} value={priceRange} onChange={(e) => setPriceRange(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#0c0e14]">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
          Безплатен вход
        </label>
        <button
          type="button"
          onClick={saveCoreFields}
          disabled={saving}
          className="rounded-lg bg-[#7c2d12] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Запази основните полета
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Видео</h2>
        <label className={LABEL_CLASS}>
          Връзка към YouTube/Facebook видео
          <input className={FIELD_CLASS} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        </label>
        <button type="button" onClick={saveVideo} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
          Запази видео
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Галерия</h2>
        <ul className="grid grid-cols-3 gap-2">
          {gallery.map((image) => (
            <li key={image.id} className="relative">
              <img src={image.url} alt="" className="h-24 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeGalleryImage(image.id)}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className={FIELD_CLASS}
            placeholder="https://… връзка към снимка"
            value={galleryUrlInput}
            onChange={(e) => setGalleryUrlInput(e.target.value)}
          />
          <button type="button" onClick={addGalleryImage} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
            Добави
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-black/50">Програма</h2>
        <OrganizerProgramEditor value={programDraft} onChange={setProgramDraft} defaultDate={startDate || undefined} />
        <button type="button" onClick={saveSchedule} className="rounded-lg border border-black/[0.12] px-4 py-2 text-sm font-semibold">
          Запази програмата
        </button>
      </section>

      <button type="button" onClick={() => router.push("/organizer/dashboard")} className="text-sm text-black/60 hover:underline">
        Готово, обратно към таблото
      </button>
    </div>
  );
}
