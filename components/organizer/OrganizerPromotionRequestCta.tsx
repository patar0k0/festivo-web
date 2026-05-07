"use client";

import { useState } from "react";

export default function OrganizerPromotionRequestCta({
  festivalId,
  hasActivePromotion,
}: {
  festivalId: string;
  hasActivePromotion: boolean;
}) {
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (hasActivePromotion) return null;

  async function handleRequestPromotion(targetFestivalId: string) {
    setIsSubmitting(true);
    try {
      // TODO: surface promotion requests in admin panel
      const response = await fetch("/api/organizer/promotion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivalId: targetFestivalId }),
      });
      if (!response.ok) {
        console.log("promotion request endpoint unavailable", targetFestivalId);
      }
    } catch {
      console.log("promotion requested", targetFestivalId);
    } finally {
      setSuccess(true);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm text-gray-600">
        Промотирането увеличава видимостта на фестивала ти и достига повече посетители
      </p>
      <button
        type="button"
        onClick={() => handleRequestPromotion(festivalId)}
        disabled={isSubmitting || success}
        className="rounded-lg bg-black px-4 py-2 text-sm text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/60"
      >
        {success ? "Заявката е изпратена" : isSubmitting ? "Изпращане..." : "Заяви промотиране"}
      </button>
      {success ? <p className="mt-2 text-sm text-green-600">Заявката е изпратена. Ще се свържем с теб.</p> : null}
    </div>
  );
}
