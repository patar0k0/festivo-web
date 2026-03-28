"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type OrganizerPendingEditInitial = {
  id: string;
  title: string;
  description: string | null;
  city_label: string;
  location_name: string | null;
  address: string | null;
  category: string | null;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  price_range: string | null;
  is_free: boolean;
};

export default function OrganizerPendingEditForm({ initial }: { initial: OrganizerPendingEditInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [city, setCity] = useState(initial.city_label);
  const [locationName, setLocationName] = useState(initial.location_name ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [category, setCategory] = useState((initial.category ?? "festival").trim() || "festival");
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(", "));
  const [startDate, setStartDate] = useState(initial.start_date ?? "");
  const [endDate, setEndDate] = useState(initial.end_date ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initial.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initial.instagram_url ?? "");
  const [ticketUrl, setTicketUrl] = useState(initial.ticket_url ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(initial.hero_image ?? "");
  const [priceRange, setPriceRange] = useState(initial.price_range ?? "");
  const [isFree, setIsFree] = useState(initial.is_free);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/organizer/pending-festivals/${initial.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          city,
          location_name: locationName || null,
          address: address || null,
          category: category.trim() || null,
          tags,
          start_date: startDate,
          end_date: endDate.trim() ? endDate : null,
          website_url: websiteUrl || null,
          facebook_url: facebookUrl || null,
          instagram_url: instagramUrl || null,
          ticket_url: ticketUrl || null,
          hero_image: heroImageUrl || null,
          price_range: priceRange || null,
          is_free: isFree,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Грешка при запис.");
      }
      router.push("/organizer/submissions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <label className="block text-sm font-medium text-[#0c0e14]">
        Заглавие *
        <input
          required
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Описание
        <textarea
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={4}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Град / населено място *
        <input
          required
          value={city}
          onChange={(ev) => setCity(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Категория
        <input
          value={category}
          onChange={(ev) => setCategory(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Тагове
        <input
          value={tagsInput}
          onChange={(ev) => setTagsInput(ev.target.value)}
          placeholder="отделени със запетая"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Място / локация
        <input
          value={locationName}
          onChange={(ev) => setLocationName(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Адрес
        <input
          value={address}
          onChange={(ev) => setAddress(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#0c0e14]">
          Начало *
          <input
            required
            type="date"
            value={startDate}
            onChange={(ev) => setStartDate(ev.target.value)}
            className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-[#0c0e14]">
          Край
          <input
            type="date"
            value={endDate}
            onChange={(ev) => setEndDate(ev.target.value)}
            className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Плакат / снимка (URL)
        <input
          value={heroImageUrl}
          onChange={(ev) => setHeroImageUrl(ev.target.value)}
          type="url"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Уебсайт
        <input
          value={websiteUrl}
          onChange={(ev) => setWebsiteUrl(ev.target.value)}
          type="url"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Facebook
        <input
          value={facebookUrl}
          onChange={(ev) => setFacebookUrl(ev.target.value)}
          type="url"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Instagram
        <input
          value={instagramUrl}
          onChange={(ev) => setInstagramUrl(ev.target.value)}
          type="url"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Билети
        <input
          value={ticketUrl}
          onChange={(ev) => setTicketUrl(ev.target.value)}
          type="url"
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-[#0c0e14]">
        Ценови диапазон
        <input
          value={priceRange}
          onChange={(ev) => setPriceRange(ev.target.value)}
          className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-[#0c0e14]">
        <input type="checkbox" checked={isFree} onChange={(ev) => setIsFree(ev.target.checked)} />
        Безплатно събитие
      </label>
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Запис…" : "Запази"}
        </button>
        <Link href="/organizer/submissions" className="rounded-xl border border-black/[0.14] px-5 py-2.5 text-sm font-semibold text-[#0c0e14]">
          Отказ
        </Link>
      </div>
    </form>
  );
}
