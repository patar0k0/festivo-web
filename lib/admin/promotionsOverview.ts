export type PromotionExpiryStatus = "active" | "expiring" | "expired";

export function getStatus(expiry: string | null): PromotionExpiryStatus {
  if (!expiry) return "active";

  const now = new Date();
  const exp = new Date(expiry);
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "expired";
  if (diffDays <= 2) return "expiring";
  return "active";
}

export type PromotedFestivalRow = {
  id: string;
  title: string;
  slug: string;
  promotion_status: string;
  promotion_expires_at: string | null;
  promotion_rank: number | null;
  organizer: { id: string; name: string | null } | null;
};

export type PromotedFestivalRaw = Omit<PromotedFestivalRow, "organizer"> & {
  organizer: PromotedFestivalRow["organizer"] | NonNullable<PromotedFestivalRow["organizer"]>[] | null;
};

export function normalizePromotedRows(raw: PromotedFestivalRaw[]): PromotedFestivalRow[] {
  return raw.map((row) => ({
    ...row,
    organizer: Array.isArray(row.organizer) ? row.organizer[0] ?? null : row.organizer,
  }));
}
