import { permanentRedirect } from "next/navigation";
import { cityHref } from "@/lib/cities";

export const revalidate = 21600;

export default async function LegacyCityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(cityHref(slug));
}
