"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { transliteratedSlug } from "@/lib/text/slug";
import type { OrganizerProfile } from "@/lib/types";
import { useRouter } from "next/navigation";
import TagsInput from "@/components/admin/TagsInput";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import OccurrenceDaysEditor from "@/components/admin/OccurrenceDaysEditor";
import { mergeOccurrenceDatesWithRange, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { dbTimeToHmInput } from "@/lib/festival/festivalTimeFields";
import { resolvePublishedFestivalEditorOpenAction } from "@/lib/festival/editorOpenAction";
import { getVideoEmbedSrcFromPageUrl, isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";
import FestivalEditorOpenSecondary from "@/components/festival/FestivalEditorOpenSecondary";
import {
  MEDIA_LIMITS,
  mediaPlanDisplayLabel,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
import {
  AdminFieldGrid,
  AdminFieldInlineRow,
  AdminFieldLabel,
  AdminFieldSection,
  AdminMetaSection,
  AdminSummaryStrip,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_CONTROL_CLASS,
  ADMIN_ENTITY_TEXTAREA_CLASS,
  buildStandardSummaryStripItems,
} from "@/components/admin/entity";
import { ADMIN_FIELD_LABEL, getAdminFieldLabel } from "@/lib/admin/entitySchema";

type FestivalRecord = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  city: string | null;
  city_id: number | null;
  city_name?: string | null;
  city_slug?: string | null;
  location_name: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  image_url: string | null;
  hero_image?: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  lat: number | null;
  lng: number | null;
  is_free: boolean | null;
  is_verified: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | "published";
  tags: string[] | null;
  description: string | null;
  source_url: string | null;
  source_type: string | null;
  organizer_name?: string | null;
  organizer_id?: string | null;
  organizer_ids?: string[] | null;
  updated_at?: string | null;
  promotion_status?: "normal" | "promoted" | null;
  promotion_started_at?: string | null;
  promotion_expires_at?: string | null;
  promotion_rank?: number | null;
  [key: string]: unknown;
};

const STATUS_OPTIONS = ["draft", "verified", "published", "rejected", "archived"] as const;

const SECONDARY_METADATA_FIELDS = [
  "id",
  "source_primary_url",
  "source_count",
  "source_type",
  "discovered_via",
  "verification_status",
  "verification_score",
  "duplicate_of",
  "created_at",
  "updated_at",
  "reviewed_at",
  "reviewed_by",
] as const;

const DEBUG_KEYWORDS = [
  "evidence_json",
  "deterministic_guess_json",
  "ai_guess_json",
  "merge_decisions_json",
  "normalization_version",
  "extraction_version",
  "hero_image_original_url",
  "hero_image_score",
];

function asDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function asDatetimeLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function validateCoords(latRaw: string, lngRaw: string) {
  if (!latRaw && !lngRaw) {
    return { valid: true, message: "Координатите са празни (допустимо)." };
  }

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, message: "Координатите трябва да са числа." };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, message: "Координатите са извън валиден диапазон." };
  }

  return { valid: true, message: "Координатите са валидни." };
}

function prettyJson(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "—";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function valueLabel(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

type SaveFestivalResponse = {
  city_created?: boolean;
  city?: {
    id?: number | null;
    name_bg?: string | null;
    slug?: string | null;
  };
  displayed_city?: string | null;
  hero_image?: string | null;
};

type OrganizerOption = Pick<OrganizerProfile, "id" | "name" | "slug" | "plan" | "plan_started_at" | "plan_expires_at">;

type PublishedMediaRow = { id: string; url: string; type: string | null; sort_order: number | null; is_hero?: boolean | null };

export default function FestivalEditForm({
  festival,
  organizers,
  initialMedia = [],
}: {
  festival: FestivalRecord;
  organizers: OrganizerOption[];
  initialMedia?: PublishedMediaRow[];
}) {
  const initialCityDisplay = festival.city_name ?? festival.city ?? "";

  const [form, setForm] = useState({
    title: festival.title,
    slug: festival.slug,
    category: festival.category ?? "",
    city: initialCityDisplay,
    city_id: festival.city_id?.toString() ?? "",
    location_name: festival.location_name ?? "",
    address: festival.address ?? "",
    start_date: asDateInput(festival.start_date),
    end_date: asDateInput(festival.end_date),
    start_time: dbTimeToHmInput(typeof festival.start_time === "string" ? festival.start_time : null),
    end_time: dbTimeToHmInput(typeof festival.end_time === "string" ? festival.end_time : null),
    hero_image: festival.hero_image ?? festival.image_url ?? "",
    website_url: festival.website_url ?? "",
    ticket_url: festival.ticket_url ?? "",
    organizer_name: typeof festival.organizer_name === "string" ? festival.organizer_name : "",
    organizer_id: typeof festival.organizer_id === "string" ? festival.organizer_id : "",
    organizer_ids:
      Array.isArray(festival.organizer_ids) && festival.organizer_ids.length
        ? festival.organizer_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : typeof festival.organizer_id === "string" && festival.organizer_id
          ? [festival.organizer_id]
          : [],
    source_url: festival.source_url ?? "",
    price_range: festival.price_range ?? "",
    latitude: festival.lat?.toString() ?? "",
    longitude: festival.lng?.toString() ?? "",
    is_free: festival.is_free ?? false,
    is_verified: festival.is_verified ?? false,
    status: festival.status,
    tags: festival.tags ?? [],
    description: festival.description ?? "",
    promotion_status: festival.promotion_status === "promoted" ? "promoted" : "normal",
    promotion_started_at: asDatetimeLocalInput(festival.promotion_started_at),
    promotion_expires_at: asDatetimeLocalInput(festival.promotion_expires_at),
    promotion_rank: festival.promotion_rank != null ? String(festival.promotion_rank) : "0",
  });

  const [message, setMessage] = useState<string>("");
  const [organizerOptions, setOrganizerOptions] = useState<OrganizerOption[]>(organizers);
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [pendingOrganizerId, setPendingOrganizerId] = useState("");
  const [creatingOrganizer, setCreatingOrganizer] = useState(false);
  const [newOrganizer, setNewOrganizer] = useState({
    name: "",
    slug: "",
    description: "",
    logo_url: "",
    website_url: "",
    facebook_url: "",
    instagram_url: "",
  });
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [importingHeroFromUrl, setImportingHeroFromUrl] = useState(false);
  const mediaSnapshot = JSON.stringify(initialMedia.map((m) => ({ id: m.id, url: m.url, type: m.type, is_hero: m.is_hero ?? null })));

  const isVideoMedia = (type: string | null | undefined) => {
    const t = (type ?? "").toLowerCase();
    return t === "video" || t.includes("video");
  };

  /** Matches server gallery limit count (non-video, non–is_hero rows). */
  const galleryRowsForLimit = useMemo(
    () => initialMedia.filter((m) => !isVideoMedia(m.type) && !m.is_hero),
    [mediaSnapshot],
  );

  /** All image rows for grid (includes legacy is_hero rows). */
  const displayGalleryRows = useMemo(() => initialMedia.filter((m) => !isVideoMedia(m.type)), [mediaSnapshot]);

  const videoRows = useMemo(() => initialMedia.filter((m) => isVideoMedia(m.type)), [mediaSnapshot]);

  const primaryOrganizer = useMemo(() => {
    const organizerId = form.organizer_id.trim() || form.organizer_ids[0]?.trim() || "";
    if (!organizerId) return null;
    return organizers.find((o) => o.id === organizerId) ?? null;
  }, [form.organizer_id, form.organizer_ids, organizers]);

  const mediaPlan = useMemo(() => resolveMediaPlanFromOrganizer(primaryOrganizer), [primaryOrganizer]);
  const mediaLimits = useMemo(() => resolveAllowedMediaLimitsFromOrganizerPlan(primaryOrganizer), [primaryOrganizer]);

  const galleryImageCount = galleryRowsForLimit.length;
  /** Plan image cap includes the hero slot when `festivals.hero_image` is set. */
  const heroHasImage = Boolean(form.hero_image.trim());
  const heroIsMediaRow = initialMedia.some((m) => Boolean(m.is_hero));
  const totalGallerySlotsUsed = galleryImageCount + (heroIsMediaRow ? 1 : 0);
  const galleryAtLimit = totalGallerySlotsUsed >= mediaLimits.gallery;
  const videoCount = videoRows.length;

  const videoUrlFromServer = useMemo(() => {
    const v = initialMedia.find((m) => isVideoMedia(m.type));
    return v?.url ?? "";
  }, [mediaSnapshot]);
  const [videoUrl, setVideoUrl] = useState(videoUrlFromServer);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [importingGalleryFromUrl, setImportingGalleryFromUrl] = useState(false);
  const galleryOpsBusy = galleryBusy || importingGalleryFromUrl;
  const [videoBusy, setVideoBusy] = useState(false);
  const galleryFileRef = useRef<HTMLInputElement | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryImportUrl, setGalleryImportUrl] = useState("");
  const [heroPreviewError, setHeroPreviewError] = useState(false);
  const [actionPending, setActionPending] = useState<"archive" | "restore" | "delete" | null>(null);
  const [occurrenceDays, setOccurrenceDays] = useState<string[]>(() => normalizeOccurrenceDatesInput(festival.occurrence_dates) ?? []);
  const router = useRouter();

  useEffect(() => {
    setVideoUrl(videoUrlFromServer);
  }, [videoUrlFromServer]);

  useEffect(() => {
    setHeroPreviewError(false);
  }, [form.hero_image]);

  const videoEmbedSrc = useMemo(() => getVideoEmbedSrcFromPageUrl(videoUrl.trim()), [videoUrl]);

  const planLabel = mediaPlanDisplayLabel(mediaPlan);

  const descriptionPreview = useMemo(() => form.description.trim(), [form.description]);

  const editorOpenAction = useMemo(
    () =>
      resolvePublishedFestivalEditorOpenAction({
        slug: form.slug,
        status: form.status,
        is_verified: form.is_verified,
        source_url: form.source_url,
      }),
    [form.slug, form.status, form.is_verified, form.source_url],
  );

  const debugEntries = useMemo(() => {
    const keys = Object.keys(festival).filter((key) => {
      const lower = key.toLowerCase();
      if (SECONDARY_METADATA_FIELDS.includes(key as (typeof SECONDARY_METADATA_FIELDS)[number])) return false;
      if (DEBUG_KEYWORDS.some((token) => lower.includes(token))) return true;
      return lower.includes("_guess") || lower.endsWith("_json");
    });

    return keys.sort().map((key) => [key, festival[key]] as const);
  }, [festival]);

  const secondaryMetadata = useMemo(() => {
    return SECONDARY_METADATA_FIELDS
      .filter((key) => key in festival)
      .map((key) => ({ key, value: festival[key] }));
  }, [festival]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateOrganizerIds = (organizerIds: string[]) => {
    const uniqueOrganizerIds = organizerIds.filter((id, index) => organizerIds.indexOf(id) === index);
    const organizerById = new Map(organizerOptions.map((item) => [item.id, item]));
    const firstSelected = uniqueOrganizerIds.length ? organizerById.get(uniqueOrganizerIds[0]) : null;

    setForm((prev) => ({
      ...prev,
      organizer_ids: uniqueOrganizerIds,
      organizer_id: firstSelected?.id ?? "",
      organizer_name: firstSelected?.name ?? prev.organizer_name,
    }));
  };

  const selectedOrganizers = useMemo(() => {
    const organizerById = new Map(organizerOptions.map((item) => [item.id, item]));
    return form.organizer_ids
      .map((id) => organizerById.get(id))
      .filter((item): item is OrganizerOption => Boolean(item));
  }, [form.organizer_ids, organizerOptions]);

  const availableOrganizerOptions = useMemo(() => {
    const selectedIds = new Set(form.organizer_ids);
    const query = organizerSearch.trim().toLowerCase();

    return organizerOptions.filter((item) => {
      if (selectedIds.has(item.id)) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = `${item.name} ${item.slug ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [form.organizer_ids, organizerOptions, organizerSearch]);

  const onAddOrganizer = () => {
    if (!pendingOrganizerId) return;
    if (form.organizer_ids.includes(pendingOrganizerId)) {
      setPendingOrganizerId("");
      return;
    }

    updateOrganizerIds([...form.organizer_ids, pendingOrganizerId]);
    setPendingOrganizerId("");
  };

  const onRemoveOrganizer = (organizerId: string) => {
    updateOrganizerIds(form.organizer_ids.filter((id) => id !== organizerId));
  };

  const commitHeroFromUrl = async (sourceUrl: string) => {
    if (saving || importingHeroFromUrl || actionPending) return;

    const url = sourceUrl.trim();
    if (!url) {
      setError("Поставете валиден URL на изображение.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("URL трябва да започва с http:// или https://.");
      return;
    }

    setImportingHeroFromUrl(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}/hero-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; hero_image?: string; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Неуспешен импорт на главно изображение.");
      }

      const imported = typeof payload.hero_image === "string" ? payload.hero_image : "";
      if (imported) {
        updateField("hero_image", imported);
      }
      setMessage("Главното изображение е обновено.");
      router.refresh();
    } catch (importErr) {
      setError(importErr instanceof Error ? importErr.message : "Възникна грешка при импорт.");
    } finally {
      setImportingHeroFromUrl(false);
    }
  };

  const importHeroImageFromUrl = async () => {
    await commitHeroFromUrl(form.hero_image.trim());
  };

  const uploadHeroImageFile = async (file: File) => {
    if (galleryOpsBusy || saving || actionPending || importingHeroFromUrl) return;
    if (!heroHasImage && galleryImageCount >= mediaLimits.gallery) {
      setError("Лимитът за галерия е достигнат. Използвайте полето за URL или ъпгрейд към VIP за повече снимки.");
      return;
    }
    setGalleryBusy(true);
    setMessage("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/admin/api/festivals/${festival.id}/media`, { method: "POST", body: fd, credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row?.url) {
        throw new Error(payload?.error ?? "Качването не бе успешно.");
      }
      await commitHeroFromUrl(payload.row.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при качване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const importGalleryImageFromUrl = async () => {
    const url = galleryImportUrl.trim();
    if (!url) {
      setError("Поставете валиден URL на изображение.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("URL трябва да започва с http:// или https://.");
      return;
    }
    if (galleryOpsBusy || saving || actionPending || importingHeroFromUrl) return;
    if (galleryAtLimit) return;

    setImportingGalleryFromUrl(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/admin/api/festivals/${festival.id}/media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row?.url) {
        throw new Error(payload?.error ?? "Импортът в галерията не бе успешен.");
      }
      setGalleryImportUrl("");
      setMessage("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при импорт в галерията.");
    } finally {
      setImportingGalleryFromUrl(false);
    }
  };

  const uploadGalleryImage = async (file: File) => {
    if (galleryOpsBusy || saving || actionPending) return;
    setGalleryBusy(true);
    setMessage("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/admin/api/festivals/${festival.id}/media`, { method: "POST", body: fd, credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row) {
        throw new Error(payload?.error ?? "Качването на снимка не бе успешно.");
      }
      setMessage("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при качване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeGalleryImage = async (mediaId: string, imageUrl: string) => {
    if (galleryOpsBusy || saving || actionPending) return;
    setGalleryBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/admin/api/festivals/${festival.id}/media/${encodeURIComponent(mediaId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Премахването не бе успешно.");
      }
      setMessage("Снимката е премахната от галерията.");
      const removedUrl = imageUrl.trim();
      if (removedUrl && form.hero_image.trim() === removedUrl) {
        updateField("hero_image", "");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при премахване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const saveVideoUrl = async (overrideUrl?: string) => {
    if (videoBusy || saving || actionPending) return;
    const raw = overrideUrl !== undefined ? overrideUrl : videoUrl;
    const trimmed = raw.trim();
    if (trimmed && !isSupportedVideoPageUrl(trimmed)) {
      setError("Видео линкът трябва да е публичен YouTube или Facebook адрес.");
      return;
    }
    setVideoBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/admin/api/festivals/${festival.id}/media/video`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: trimmed || null }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Записът на видео не бе успешен.");
      }
      if (overrideUrl !== undefined) {
        setVideoUrl(trimmed);
      }
      setMessage(trimmed ? "Видео линкът е записан." : "Видео линкът е изчистен.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при запис на видео.");
    } finally {
      setVideoBusy(false);
    }
  };

  const onValidateCoords = () => {
    const validation = validateCoords(form.latitude, form.longitude);
    if (validation.valid) {
      setError("");
      setMessage(validation.message);
      return;
    }

    setMessage("");
    setError(validation.message);
  };

  const onCreateOrganizer = async () => {
    setMessage("");
    setError("");

    if (!newOrganizer.name.trim()) {
      setError("Името на организатора е задължително.");
      return;
    }

    const slug = transliteratedSlug(newOrganizer.name);
    setCreatingOrganizer(true);

    try {
      const response = await fetch("/admin/api/organizers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newOrganizer, slug: newOrganizer.slug || slug }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно създаване на организатор."));
      }

      const payload = (await response.json().catch(() => null)) as { row?: OrganizerOption } | null;
      const createdOrganizer = payload?.row;
      if (createdOrganizer) {
        setOrganizerOptions((prev) => {
          const nextOptions: OrganizerOption[] = [...prev, createdOrganizer];
          return nextOptions.sort((a, b) => a.name.localeCompare(b.name, "bg"));
        });
        updateOrganizerIds(
          form.organizer_ids.includes(createdOrganizer.id) ? form.organizer_ids : [...form.organizer_ids, createdOrganizer.id],
        );
        updateField("organizer_name", createdOrganizer.name);
      }

      setNewOrganizer({
        name: "",
        slug: "",
        description: "",
        logo_url: "",
        website_url: "",
        facebook_url: "",
        instagram_url: "",
      });

      setMessage("Организаторът е създаден успешно.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Възникна грешка.");
    } finally {
      setCreatingOrganizer(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const validation = validateCoords(form.latitude, form.longitude);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setSaving(true);

    try {
      const nonEmptyOccurrence = occurrenceDays.filter((d) => d.trim().length > 0);
      const mergedDates = mergeOccurrenceDatesWithRange({
        occurrence_days: nonEmptyOccurrence,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });

      const cityInput = form.city.trim();
      const trimmedCityId = form.city_id.trim();
      const cityId = trimmedCityId ? Number(trimmedCityId) : null;

      if (cityId !== null && (!Number.isInteger(cityId) || cityId <= 0)) {
        throw new Error("city_id трябва да е положително цяло число.");
      }

      const response = await fetch(`/admin/api/festivals/${festival.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description || null,
          city_id: cityId,
          city_name_display: cityInput || null,
          location_name: form.location_name || null,
          venue_name: form.location_name || null,
          address: form.address || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          start_date: mergedDates.start_date,
          end_date: mergedDates.end_date,
          start_time: form.start_time.trim() || null,
          end_time: form.end_time.trim() || null,
          occurrence_dates: mergedDates.occurrence_dates,
          organizer_name: form.organizer_name || null,
          organizer_id: form.organizer_id || null,
          organizer_ids: form.organizer_ids,
          source_url: form.source_url || null,
          website_url: form.website_url || null,
          ticket_url: form.ticket_url || null,
          is_free: form.is_free,
          price_range: form.price_range || null,
          hero_image: form.hero_image || null,
          tags: form.tags,
          category: form.category || null,
          status: form.status,
          is_verified: form.is_verified,
          promotion_status: form.promotion_status,
          promotion_started_at: form.promotion_started_at || null,
          promotion_expires_at: form.promotion_expires_at || null,
          promotion_rank: form.promotion_rank.trim() === "" ? null : Number(form.promotion_rank),
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешен запис."));
      }

      const payload = (await response.json().catch(() => null)) as SaveFestivalResponse | null;
      const resolvedCityDisplay = payload?.city?.name_bg ?? payload?.displayed_city ?? payload?.city?.slug ?? cityInput;

      if (resolvedCityDisplay) {
        updateField("city", resolvedCityDisplay);
      }
      if (payload?.city?.id) {
        updateField("city_id", String(payload.city.id));
      }

      if (typeof payload?.hero_image === "string" && payload.hero_image.length > 0) {
        updateField("hero_image", payload.hero_image);
      }

      updateField("start_date", mergedDates.start_date ?? "");
      updateField("end_date", mergedDates.end_date ?? "");
      setOccurrenceDays(normalizeOccurrenceDatesInput(mergedDates.occurrence_dates) ?? []);

      setMessage("Промените са записани успешно.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setSaving(false);
    }
  };

  const runArchiveAction = async (action: "archive" | "restore") => {
    if (saving || actionPending) return;

    setMessage("");
    setError("");
    setActionPending(action);

    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно обновяване на статуса."));
      }

      updateField("status", action === "archive" ? "archived" : "verified");
      setMessage(action === "archive" ? "Фестивалът е архивиран." : "Фестивалът е възстановен.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setActionPending(null);
    }
  };

  const runDeleteAction = async () => {
    if (saving || actionPending) return;

    const confirmed = window.confirm("Сигурни ли сте, че искате да изтриете този фестивал? Това действие е необратимо.");
    if (!confirmed) return;

    setMessage("");
    setError("");
    setActionPending("delete");

    try {
      const response = await fetch(`/admin/api/festivals/${festival.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Неуспешно изтриване."));
      }

      router.push("/admin/festivals?deleted=1");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Възникна грешка.");
    } finally {
      setActionPending(null);
    }
  };

  const summaryOrganizer =
    selectedOrganizers[0]?.name.trim() || form.organizer_name.trim() || "—";

  const updatedAtDisplay = useMemo(() => {
    const raw = festival.updated_at;
    if (raw == null || raw === "") return "—";
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("bg-BG");
  }, [festival.updated_at]);

  const summaryItems = useMemo(
    () =>
      buildStandardSummaryStripItems({
        status: form.status,
        sourceLine:
          (typeof festival.source_type === "string" ? festival.source_type : "").trim() ||
          (form.source_url ? `${form.source_url.slice(0, 64)}${form.source_url.length > 64 ? "…" : ""}` : "—"),
        city: form.city.trim() || form.city_id || "—",
        startDate: form.start_date.trim() || "—",
        organizer: summaryOrganizer,
        contextLabel: ADMIN_FIELD_LABEL.updatedAt,
        contextValue: updatedAtDisplay,
      }),
    [form.status, form.source_url, form.city, form.city_id, form.start_date, festival.source_type, summaryOrganizer, updatedAtDisplay],
  );

  return (
    <form id="admin-festival-edit-form" onSubmit={onSubmit} className="space-y-2.5 pb-20">
      <AdminSummaryStrip
        title={form.title.trim() || "Festival"}
        eyebrow="Admin · Published festival"
        items={summaryItems}
        actions={
          <>
            <Link href="/admin/festivals" className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]">
              Back
            </Link>
            <button
              type="submit"
              form="admin-festival-edit-form"
              disabled={saving || importingHeroFromUrl || Boolean(actionPending)}
              className="rounded-xl bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        }
      />

      <AdminFieldSection
        title={ADMIN_ENTITY_SECTION.mainInfo.title}
        description="Published identity, listing status, category, and tags."
        variant={ADMIN_ENTITY_SECTION.mainInfo.variant}
      >
        <AdminFieldGrid>
          <label className="md:col-span-2">
            <AdminFieldLabel field="title" />
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} required />
          </label>
          <AdminFieldInlineRow field="slug">
            <input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="category">
            <input value={form.category} onChange={(e) => updateField("category", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="status">
            <select value={form.status} onChange={(e) => updateField("status", e.target.value as (typeof STATUS_OPTIONS)[number])} className={ADMIN_ENTITY_CONTROL_CLASS}>
              {STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </AdminFieldInlineRow>
          <AdminFieldInlineRow as="div" field="isFree">
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={(e) => updateField("is_free", e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border border-black/20 text-[#0c0e14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c0e14]"
              aria-label={getAdminFieldLabel("isFree")}
            />
          </AdminFieldInlineRow>
          <label className="md:col-span-2">
            <AdminFieldLabel field="tags" />
            <div className="mt-0">
              <TagsInput value={form.tags} onChange={(tags) => updateField("tags", tags)} />
            </div>
          </label>
        </AdminFieldGrid>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.dateTime.title} variant={ADMIN_ENTITY_SECTION.dateTime.variant}>
        <AdminFieldGrid>
          <AdminFieldInlineRow field="startDate">
            <DdMmYyyyDateInput
              value={form.start_date ?? ""}
              onChange={(iso) => updateField("start_date", iso)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="endDate">
            <DdMmYyyyDateInput
              value={form.end_date ?? ""}
              onChange={(iso) => updateField("end_date", iso)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="startTime">
            <span className="sr-only">HH:mm</span>
            <input
              type="time"
              step={60}
              value={form.start_time}
              onChange={(e) => updateField("start_time", e.target.value)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="endTime">
            <span className="sr-only">HH:mm</span>
            <input
              type="time"
              step={60}
              value={form.end_time}
              onChange={(e) => updateField("end_time", e.target.value)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </AdminFieldInlineRow>
          <div className="md:col-span-2">
            <AdminFieldLabel field="occurrenceDays" />
            <div className="mt-0">
              <OccurrenceDaysEditor value={occurrenceDays} onChange={setOccurrenceDays} disabled={saving || Boolean(actionPending)} />
            </div>
          </div>
        </AdminFieldGrid>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.location.title} variant={ADMIN_ENTITY_SECTION.location.variant}>
        <AdminFieldGrid>
          <AdminFieldInlineRow field="cityId">
            <input value={form.city_id} onChange={(e) => updateField("city_id", e.target.value)} placeholder="напр. 68134" className={ADMIN_ENTITY_CONTROL_CLASS} />
          </AdminFieldInlineRow>
          <AdminFieldInlineRow field="cityDisplay">
            <input
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="напр. Пловдив"
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </AdminFieldInlineRow>
          <label className="md:col-span-2">
            <AdminFieldLabel field="locationName" />
            <input value={form.location_name} onChange={(e) => updateField("location_name", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label className="md:col-span-2">
            <AdminFieldLabel field="address" />
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label>
            <AdminFieldLabel field="latitude" />
            <input value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label>
            <AdminFieldLabel field="longitude" />
            <input value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
        </AdminFieldGrid>
        <button type="button" onClick={onValidateCoords} className="mt-2 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
          Validate coords
        </button>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.organizer.title} variant={ADMIN_ENTITY_SECTION.organizer.variant}>
        <AdminFieldGrid>
          <label>
            <AdminFieldLabel field="organizers" />
            <div className="mt-1 rounded-xl border border-black/[0.08] bg-black/[0.02] p-2">
              <input
                value={organizerSearch}
                onChange={(event) => setOrganizerSearch(event.target.value)}
                placeholder="Търси по име или slug"
                className={ADMIN_ENTITY_CONTROL_CLASS}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <select
                  value={pendingOrganizerId}
                  onChange={(event) => setPendingOrganizerId(event.target.value)}
                  className={ADMIN_ENTITY_CONTROL_CLASS}
                >
                  <option value="">Избери организатор…</option>
                  {availableOrganizerOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.slug ? `${item.name} (${item.slug})` : item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onAddOrganizer}
                  disabled={!pendingOrganizerId}
                  className="shrink-0 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Add organizer
                </button>
              </div>
              {selectedOrganizers.length ? (
                <div className="mt-2 space-y-1.5">
                  {selectedOrganizers.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {item.name}{" "}
                          {index === 0 ? <span className="rounded bg-black/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-black/65">Main</span> : null}
                        </p>
                        {item.slug ? <p className="truncate text-xs text-black/55">{item.slug}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/organizers/${item.id}`}
                          className="rounded-md border border-black/[0.1] bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] hover:bg-black/[0.03]"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => onRemoveOrganizer(item.id)}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-black/55">Няма избрани организатори.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-black/55">Първият избран организатор остава compatibility organizer_id.</p>
          </label>
          <AdminFieldInlineRow field="organizerName">
            <input value={form.organizer_name} onChange={(e) => updateField("organizer_name", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </AdminFieldInlineRow>
          <div className="md:col-span-2 rounded-xl border border-black/[0.08] bg-black/[0.02] p-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Нов организатор</p>
            <div className="mt-1.5 grid gap-2 md:grid-cols-2">
              <input placeholder="name" value={newOrganizer.name} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, name: e.target.value, slug: transliteratedSlug(e.target.value) }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
              <input placeholder="slug (auto)" value={newOrganizer.slug} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, slug: e.target.value }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
              <input placeholder="description" value={newOrganizer.description} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, description: e.target.value }))} className={`md:col-span-2 ${ADMIN_ENTITY_CONTROL_CLASS}`} />
              <input placeholder="logo_url" value={newOrganizer.logo_url} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, logo_url: e.target.value }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
              <input placeholder="website_url" value={newOrganizer.website_url} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, website_url: e.target.value }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
              <input placeholder="facebook_url" value={newOrganizer.facebook_url} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, facebook_url: e.target.value }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
              <input placeholder="instagram_url" value={newOrganizer.instagram_url} onChange={(e) => setNewOrganizer((prev) => ({ ...prev, instagram_url: e.target.value }))} className={ADMIN_ENTITY_CONTROL_CLASS} />
            </div>
            <button type="button" onClick={onCreateOrganizer} disabled={creatingOrganizer} className="mt-2 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50">
              {creatingOrganizer ? "Създаване..." : "Създай организатор"}
            </button>
          </div>
        </AdminFieldGrid>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.linksSources.title} variant={ADMIN_ENTITY_SECTION.linksSources.variant}>
        <AdminFieldGrid>
          <label className="md:col-span-2">
            <AdminFieldLabel field="sourceUrl" />
            <input value={form.source_url} onChange={(e) => updateField("source_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label>
            <AdminFieldLabel field="websiteUrl" />
            <input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label>
            <AdminFieldLabel field="ticketUrl" />
            <input value={form.ticket_url} onChange={(e) => updateField("ticket_url", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <label>
            <AdminFieldLabel field="priceRange" />
            <input value={form.price_range} onChange={(e) => updateField("price_range", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
        </AdminFieldGrid>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.media.title} variant={ADMIN_ENTITY_SECTION.media.variant}>
        {/* Hero */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Главно изображение</p>
          {form.hero_image.trim() ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
              {heroPreviewError ? (
                <p className="p-4 text-sm text-black/60">Прегледът не е наличен за този адрес.</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.hero_image.trim()}
                  alt=""
                  className="max-h-[320px] w-full object-cover"
                  onLoad={() => setHeroPreviewError(false)}
                  onError={() => setHeroPreviewError(true)}
                />
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-black/45">Няма избрано главно изображение.</p>
          )}
          <label className="mt-3 block">
            <AdminFieldLabel field="heroImage" />
            <input value={form.hero_image} onChange={(e) => updateField("hero_image", e.target.value)} className={ADMIN_ENTITY_CONTROL_CLASS} />
          </label>
          <input
            ref={heroFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadHeroImageFile(f);
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => importHeroImageFromUrl()}
              disabled={
                saving ||
                importingHeroFromUrl ||
                Boolean(actionPending) ||
                galleryOpsBusy ||
                !form.hero_image.trim() ||
                (galleryAtLimit && !heroHasImage)
              }
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {importingHeroFromUrl ? "Импорт..." : "Импорт от URL"}
            </button>
            <button
              type="button"
              onClick={() => heroFileInputRef.current?.click()}
              disabled={
                saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || (!heroHasImage && galleryImageCount >= mediaLimits.gallery)
              }
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {galleryBusy ? "Качване..." : "Качи / замени файл"}
            </button>
            <span
              className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-black/[0.12] text-[10px] font-bold text-black/45"
              title="Импортът от външен URL сваля файла на сървъра и записва публичен адрес в storage. При запис на фестивал с http(s) линк към чуждо изображение същото се случва автоматично."
            >
              i
            </span>
          </div>
          {displayGalleryRows.length ? (
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Избор от галерията</span>
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = "";
                  if (v) void commitHeroFromUrl(v);
                }}
                disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy}
                className={`mt-1.5 ${ADMIN_ENTITY_CONTROL_CLASS}`}
              >
                <option value="">Избери снимка…</option>
                {displayGalleryRows.map((row) => (
                  <option key={row.id} value={row.url}>
                    {row.url.length > 72 ? `${row.url.slice(0, 72)}…` : row.url}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {/* Gallery */}
        <div className="mt-6 border-t border-black/[0.08] pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Галерия</p>
            <p className="text-xs text-black/60">
              <span className="font-semibold text-black/80">{totalGallerySlotsUsed}</span> / {mediaLimits.gallery} · {planLabel}
            </p>
          </div>
          <input
            ref={galleryFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadGalleryImage(f);
            }}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {displayGalleryRows.map((row) => {
              const isHero = form.hero_image.trim() === row.url.trim();
              return (
                <div
                  key={row.id}
                  className={`group relative overflow-hidden rounded-xl border bg-black/[0.02] ${
                    isHero ? "border-[#ff4c1f]/50 ring-2 ring-[#ff4c1f]/25" : "border-black/[0.08]"
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden bg-black/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1 border-t border-black/[0.06] bg-white/95 p-1.5">
                    <button
                      type="button"
                      onClick={() => void commitHeroFromUrl(row.url)}
                      disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy}
                      className="rounded-md border border-black/[0.1] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                    >
                      Главна
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeGalleryImage(row.id, row.url)}
                      disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
                    >
                      Премахни
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => galleryFileRef.current?.click()}
              disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || galleryAtLimit}
              className="flex aspect-square min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/[0.15] bg-black/[0.02] text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55 transition hover:border-black/[0.25] hover:bg-black/[0.04] disabled:opacity-50"
            >
              {galleryBusy ? "Качване..." : "+ Качи"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={galleryImportUrl}
              onChange={(e) => setGalleryImportUrl(e.target.value)}
              placeholder="https://… (импорт в галерията)"
              className={`min-w-[200px] flex-1 ${ADMIN_ENTITY_CONTROL_CLASS}`}
            />
            <button
              type="button"
              onClick={() => void importGalleryImageFromUrl()}
              disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || galleryAtLimit || !galleryImportUrl.trim()}
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {importingGalleryFromUrl ? "Импорт..." : "Импорт от URL"}
            </button>
            <span
              className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-black/[0.12] text-[10px] font-bold text-black/45"
              title="Сървърът сваля изображението и го записва в storage (като при главното изображение)."
            >
              i
            </span>
          </div>
          {mediaPlan === "free" && galleryAtLimit ? (
            <p className="mt-2 text-xs text-[#c9a227]">VIP планът увеличава лимита до {MEDIA_LIMITS.vip.gallery} снимки.</p>
          ) : null}
          {!displayGalleryRows.length ? <p className="mt-2 text-xs text-black/45">Няма снимки в галерията.</p> : null}
        </div>

        {/* Video */}
        <div className="mt-6 border-t border-black/[0.08] pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Видео</p>
            <p className="text-xs text-black/60">
              <span className="font-semibold text-black/80">{videoCount}</span> / {mediaLimits.video} · {planLabel}
            </p>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Видео URL</span>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… или Facebook видео линк"
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveVideoUrl()}
              disabled={saving || importingHeroFromUrl || Boolean(actionPending) || videoBusy}
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {videoBusy ? "Запис..." : "Запиши"}
            </button>
            <button
              type="button"
              onClick={() => void saveVideoUrl("")}
              disabled={saving || importingHeroFromUrl || Boolean(actionPending) || videoBusy || !videoUrl.trim()}
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {videoBusy ? "Запис..." : "Премахни видео"}
            </button>
          </div>
          {videoEmbedSrc ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08] bg-black">
              <div className="relative aspect-video w-full">
                <iframe
                  title="Видео преглед"
                  src={videoEmbedSrc}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          ) : null}
          {mediaPlan === "free" && videoCount >= MEDIA_LIMITS.free.video ? (
            <p className="mt-2 text-xs text-[#c9a227]">VIP планът увеличава лимита до {MEDIA_LIMITS.vip.video} видеа.</p>
          ) : null}
        </div>
      </AdminFieldSection>

      <AdminFieldSection title={ADMIN_ENTITY_SECTION.descriptionContent.title} variant={ADMIN_ENTITY_SECTION.descriptionContent.variant}>
        <label className="block">
          <AdminFieldLabel field="description" />
          <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={6} className={ADMIN_ENTITY_TEXTAREA_CLASS} />
        </label>
        <div className="mt-2 rounded-xl border border-black/[0.08] bg-white/80 p-2.5 text-sm text-black/70">
          {descriptionPreview || "Няма описание за preview."}
        </div>
      </AdminFieldSection>

      <AdminMetaSection title={ADMIN_ENTITY_SECTION.systemMeta.title} description="Promotion window, listing boosts, and audit identifiers.">
        <AdminFieldGrid>
          <label>
            <AdminFieldLabel field="promotionStatus" />
            <select
              value={form.promotion_status}
              onChange={(e) => updateField("promotion_status", e.target.value as "normal" | "promoted")}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            >
              <option value="normal">normal</option>
              <option value="promoted">promoted</option>
            </select>
          </label>
          <label>
            <AdminFieldLabel field="promotionStartedAt" />
            <input
              type="datetime-local"
              value={form.promotion_started_at}
              onChange={(e) => updateField("promotion_started_at", e.target.value)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </label>
          <label>
            <AdminFieldLabel field="promotionExpiresAt" />
            <input
              type="datetime-local"
              value={form.promotion_expires_at}
              onChange={(e) => updateField("promotion_expires_at", e.target.value)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </label>
          <label>
            <AdminFieldLabel field="promotionRank" />
            <input
              type="number"
              value={form.promotion_rank}
              onChange={(e) => updateField("promotion_rank", e.target.value)}
              className={ADMIN_ENTITY_CONTROL_CLASS}
            />
          </label>
        </AdminFieldGrid>
      </AdminMetaSection>

      {secondaryMetadata.length ? (
        <AdminMetaSection title="Read-only identifiers" description="IDs, source lineage, and audit timestamps from the database row.">
          <div className="grid gap-2 md:grid-cols-2 text-sm">
            {secondaryMetadata.map(({ key, value }) => (
              <p key={key} className="text-black/70">
                <span className="font-semibold">{getAdminFieldLabel(key)}:</span> {valueLabel(value)}
              </p>
            ))}
          </div>
        </AdminMetaSection>
      ) : null}

      {debugEntries.length ? (
        <details className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Debug / technical fields</summary>
          <div className="mt-2 space-y-2">
            {debugEntries.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">{getAdminFieldLabel(key)}</p>
                <pre className="mt-1.5 overflow-x-auto rounded-lg border border-black/[0.08] bg-white/80 p-2 text-xs text-black/80">{prettyJson(value)}</pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {message ? <p className="rounded-lg bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">{message}</p> : null}
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-end gap-2 px-4 py-2.5 md:px-6">
          <label className="mr-auto flex items-center gap-2 text-sm text-black/60">
            <input type="checkbox" checked={form.is_verified} onChange={(e) => updateField("is_verified", e.target.checked)} />
            is_verified (legacy)
          </label>
          <Link href="/admin/festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
            Cancel
          </Link>
          <FestivalEditorOpenSecondary
            action={editorOpenAction}
            dimmed={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || videoBusy}
          />
          <button
            type="button"
            onClick={() => runArchiveAction(form.status === "archived" ? "restore" : "archive")}
            disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || videoBusy}
            className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          >
            {actionPending === "archive" || actionPending === "restore"
              ? "Working..."
              : form.status === "archived"
                ? "Restore"
                : "Archive"}
          </button>
          <button
            type="button"
            onClick={runDeleteAction}
            disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || videoBusy}
            className="rounded-xl border border-[#b13a1a]/30 bg-[#ff4c1f]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#b13a1a] disabled:opacity-50"
          >
            {actionPending === "delete" ? "Deleting..." : "Delete"}
          </button>
          <button
            type="submit"
            form="admin-festival-edit-form"
            disabled={saving || importingHeroFromUrl || Boolean(actionPending) || galleryOpsBusy || videoBusy}
            className="rounded-xl bg-[#0c0e14] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
