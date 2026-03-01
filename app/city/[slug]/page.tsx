import { permanentRedirect } from "next/navigation";

export const revalidate = 21600;

export default async function LegacyCityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/cities/${slug}`);
}
