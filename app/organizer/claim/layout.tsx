import { redirect } from "next/navigation";
import { getPortalSessionUser } from "@/lib/organizer/portal";

export default async function OrganizerClaimAuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent("/organizer/claim")}`);
  }
  return <>{children}</>;
}
