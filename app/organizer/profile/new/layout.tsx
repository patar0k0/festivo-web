import { redirect } from "next/navigation";
import { getPortalSessionUser } from "@/lib/organizer/portal";

export default async function OrganizerNewProfileAuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent("/organizer/profile/new")}`);
  }
  return <>{children}</>;
}
