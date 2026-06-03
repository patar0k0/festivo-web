"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";

export type PublishedMediaRow = {
  id: string;
  url: string;
  type: string | null;
  sort_order: number | null;
  is_hero?: boolean | null;
};

export function useFestivalMediaOps({
  festivalId,
  initialVideoUrl,
  galleryAtLimit,
  heroHasImage,
  heroImageUrl,
  onHeroImageChange,
  galleryImageCount,
  mediaLimitGallery,
}: {
  festivalId: string;
  initialVideoUrl: string;
  galleryAtLimit: boolean;
  heroHasImage: boolean;
  heroImageUrl: string;
  onHeroImageChange: (url: string) => void;
  galleryImageCount: number;
  mediaLimitGallery: number;
}) {
  const router = useRouter();
  const galleryFileRef = useRef<HTMLInputElement | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);

  const [galleryBusy, setGalleryBusy] = useState(false);
  const [importingGalleryFromUrl, setImportingGalleryFromUrl] = useState(false);
  const [importingHeroFromUrl, setImportingHeroFromUrl] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [galleryImportUrl, setGalleryImportUrl] = useState("");

  // Sync videoUrl when server data changes after router.refresh()
  const prevInitialVideoUrl = useRef(initialVideoUrl);
  useEffect(() => {
    if (initialVideoUrl !== prevInitialVideoUrl.current) {
      prevInitialVideoUrl.current = initialVideoUrl;
      setVideoUrl(initialVideoUrl);
    }
  }, [initialVideoUrl]);

  // Stable refs for props used inside async callbacks — avoids stale closures
  const heroImageUrlRef = useRef(heroImageUrl);
  useEffect(() => { heroImageUrlRef.current = heroImageUrl; }, [heroImageUrl]);

  const galleryOpsBusy = galleryBusy || importingGalleryFromUrl;

  const commitHeroFromUrl = async (sourceUrl: string) => {
    const url = sourceUrl.trim();
    if (!url) { toast.error("Поставете валиден URL на изображение."); return; }
    if (!/^https?:\/\//i.test(url)) { toast.error("URL трябва да започва с http:// или https://."); return; }

    setImportingHeroFromUrl(true);
    try {
      const response = await fetch(`/admin/api/festivals/${festivalId}/hero-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; hero_image?: string; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Неуспешен импорт на главно изображение.");
      const imported = typeof payload.hero_image === "string" ? payload.hero_image : "";
      if (imported) onHeroImageChange(imported);
      toast.success("Главното изображение е обновено.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Възникна грешка при импорт.");
    } finally {
      setImportingHeroFromUrl(false);
    }
  };

  const importHeroImageFromUrl = () => commitHeroFromUrl(heroImageUrlRef.current.trim());

  const uploadHeroImageFile = async (file: File) => {
    if (!heroHasImage && galleryImageCount >= mediaLimitGallery) {
      toast.error("Лимитът за галерия е достигнат. Използвайте URL или ъпгрейд към VIP.");
      return;
    }
    setGalleryBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/admin/api/festivals/${festivalId}/media`, { method: "POST", body: fd, credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row?.url) throw new Error(payload?.error ?? "Качването не бе успешно.");
      await commitHeroFromUrl(payload.row.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при качване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const importGalleryImageFromUrl = async () => {
    const url = galleryImportUrl.trim();
    if (!url) { toast.error("Поставете валиден URL на изображение."); return; }
    if (!/^https?:\/\//i.test(url)) { toast.error("URL трябва да започва с http:// или https://."); return; }
    if (galleryAtLimit) return;

    setImportingGalleryFromUrl(true);
    try {
      const res = await fetch(`/admin/api/festivals/${festivalId}/media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: url }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row?.url) throw new Error(payload?.error ?? "Импортът в галерията не бе успешен.");
      setGalleryImportUrl("");
      toast.success("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при импорт в галерията.");
    } finally {
      setImportingGalleryFromUrl(false);
    }
  };

  const uploadGalleryImage = async (file: File) => {
    setGalleryBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/admin/api/festivals/${festivalId}/media`, { method: "POST", body: fd, credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; row?: PublishedMediaRow; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.row) throw new Error(payload?.error ?? "Качването на снимка не бе успешно.");
      toast.success("Снимката е добавена към галерията.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при качване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeGalleryImage = async (mediaId: string, imageUrl: string) => {
    setGalleryBusy(true);
    try {
      const res = await fetch(`/admin/api/festivals/${festivalId}/media/${encodeURIComponent(mediaId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Премахването не бе успешно.");
      toast.success("Снимката е премахната от галерията.");
      if (imageUrl.trim() && heroImageUrlRef.current.trim() === imageUrl.trim()) onHeroImageChange("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при премахване.");
    } finally {
      setGalleryBusy(false);
    }
  };

  const saveVideoUrl = async (overrideUrl?: string) => {
    const raw = overrideUrl !== undefined ? overrideUrl : videoUrl;
    const trimmed = raw.trim();
    if (trimmed && !isSupportedVideoPageUrl(trimmed)) {
      toast.error("Видео линкът трябва да е публичен YouTube или Facebook адрес.");
      return;
    }
    setVideoBusy(true);
    try {
      const res = await fetch(`/admin/api/festivals/${festivalId}/media/video`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: trimmed || null }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Записът на видео не бе успешен.");
      if (overrideUrl !== undefined) setVideoUrl(trimmed);
      toast.success(trimmed ? "Видео линкът е записан." : "Видео линкът е изчистен.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при запис на видео.");
    } finally {
      setVideoBusy(false);
    }
  };

  return {
    galleryFileRef,
    heroFileInputRef,
    galleryBusy,
    galleryOpsBusy,
    importingHeroFromUrl,
    importingGalleryFromUrl,
    videoBusy,
    videoUrl,
    setVideoUrl,
    galleryImportUrl,
    setGalleryImportUrl,
    commitHeroFromUrl,
    importHeroImageFromUrl,
    uploadHeroImageFile,
    importGalleryImageFromUrl,
    uploadGalleryImage,
    removeGalleryImage,
    saveVideoUrl,
  };
}
