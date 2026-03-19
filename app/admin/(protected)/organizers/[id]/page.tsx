import { redirect } from "next/navigation";

export default async function AdminOrganizerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin/organizers/${params.id}/edit`);
}
