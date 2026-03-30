import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

/** Canonical festival URLs use `/festivals/[slug]`; keep alternates for legacy `/festival/` links. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `${getBaseUrl()}/festivals/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function LegacyFestivalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/festivals/${slug}`);
}
