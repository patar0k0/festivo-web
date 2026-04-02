import OrganizerSidebarNav from "@/components/organizer/OrganizerSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { getPortalSessionUser } from "@/lib/organizer/portal";

export default async function OrganizerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSessionUser();
  return (
    <WorkspaceShell
      density="organizer-b"
      eyebrow="Festivo · организатори"
      email={session?.user?.email ?? null}
      sidebar={<OrganizerSidebarNav />}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </WorkspaceShell>
  );
}
