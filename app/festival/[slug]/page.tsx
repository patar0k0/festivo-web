import { redirect } from "next/navigation";
import { normalizePublicFestivalSlugParam } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Canonical festival URLs use `/festivals/[slug]`; keep alternates for legacy `/festival/` links. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  return {
    alternates: {
      canonical: `${getBaseUrl()}/festivals/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function LegacyFestivalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  redirect(`/festivals/${encodeURIComponent(slug)}`);
}
