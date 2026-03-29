/**
 * Resolves which open/view affordance to show on festival edit surfaces.
 * Public catalog visibility mirrors `getFestivalBySlug` in `lib/queries.ts`.
 */

export type EditorOpenActionResolved =
  | { kind: "internal"; variant: "public" | "preview"; href: string }
  | { kind: "external"; variant: "source"; href: string }
  | { kind: "none" };

function trimSlug(slug: string | null | undefined): string {
  return typeof slug === "string" ? slug.trim() : "";
}

export function festivalPublicDetailPath(slug: string | null | undefined): string | null {
  const s = trimSlug(slug);
  if (!s) return null;
  return `/festivals/${encodeURIComponent(s)}`;
}

function pickHttpUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const raw of candidates) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t && /^https?:\/\//i.test(t)) {
      return t;
    }
  }
  return null;
}

/** Same rules as public festival detail query: published/verified/is_verified, not archived/rejected, slug required. */
export function isFestivalVisibleOnPublicCatalog(input: {
  slug: string;
  status: string;
  is_verified: boolean | null;
}): boolean {
  if (!trimSlug(input.slug)) return false;
  if (input.status === "archived" || input.status === "rejected") return false;
  return input.status === "published" || input.status === "verified" || Boolean(input.is_verified);
}

export function resolvePublishedFestivalEditorOpenAction(input: {
  slug: string;
  status: string;
  is_verified: boolean | null;
  source_url: string | null | undefined;
}): EditorOpenActionResolved {
  const path = festivalPublicDetailPath(input.slug);
  if (path && isFestivalVisibleOnPublicCatalog(input)) {
    return { kind: "internal", variant: "public", href: path };
  }
  if (path) {
    return { kind: "internal", variant: "preview", href: path };
  }
  const src = pickHttpUrl(input.source_url);
  if (src) {
    return { kind: "external", variant: "source", href: src };
  }
  return { kind: "none" };
}

/** Pending / draft rows are not on the public catalog; slug still yields the future public URL for preview. */
export function resolvePendingDraftEditorOpenAction(input: {
  slug: string | null | undefined;
  source_url: string | null | undefined;
}): EditorOpenActionResolved {
  const path = festivalPublicDetailPath(input.slug);
  if (path) {
    return { kind: "internal", variant: "preview", href: path };
  }
  const src = pickHttpUrl(input.source_url);
  if (src) {
    return { kind: "external", variant: "source", href: src };
  }
  return { kind: "none" };
}

export function resolveOrganizerPendingEditorOpenAction(input: {
  slug: string | null | undefined;
  source_url: string | null | undefined;
  website_url: string | null | undefined;
  facebook_url: string | null | undefined;
  instagram_url: string | null | undefined;
  ticket_url: string | null | undefined;
}): EditorOpenActionResolved {
  const path = festivalPublicDetailPath(input.slug);
  if (path) {
    return { kind: "internal", variant: "preview", href: path };
  }
  const src = pickHttpUrl(
    input.source_url,
    input.facebook_url,
    input.website_url,
    input.instagram_url,
    input.ticket_url,
  );
  if (src) {
    return { kind: "external", variant: "source", href: src };
  }
  return { kind: "none" };
}
