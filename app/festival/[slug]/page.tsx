import { redirect } from "next/navigation";

export const revalidate = 21600;

export default async function LegacyFestivalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/festivals/${slug}`);
}
