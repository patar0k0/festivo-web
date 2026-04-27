import OrganizerSidebarNav from "@/components/organizer/OrganizerSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { fetchOrganizerPortalMembershipSummaryCached, getPortalSessionUser } from "@/lib/organizer/portal";

export default async function OrganizerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSessionUser();
  let isOrganizerOwner = false;
  if (session?.user?.id) {
    try {
      const summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
      isOrganizerOwner = summary.isOrganizerOwner;
    } catch {
      isOrganizerOwner = false;
    }
  }
  return (
    <WorkspaceShell
      density="organizer-b"
      eyebrow="Festivo · организатори"
      email={session?.user?.email ?? null}
      sidebar={<OrganizerSidebarNav isOrganizerOwner={isOrganizerOwner} />}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </WorkspaceShell>
  );
}
