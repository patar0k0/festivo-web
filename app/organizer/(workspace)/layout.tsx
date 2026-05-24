import OrganizerSidebarNav from "@/components/organizer/OrganizerSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { headers } from "next/headers";
import {
  fetchOrganizerPortalMembershipSummaryCached,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";

export default async function OrganizerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-festivo-pathname") ?? "";
  const isDashboard = pathname === "/organizer/dashboard";
  const session = await getPortalSessionUser();
  let isOrganizerOwner = false;
  let headerSummary: React.ReactNode = null;
  let hasSubmissions = false;
  let draftCount = 0;

  if (session?.user?.id) {
    const summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
    isOrganizerOwner = summary.isOrganizerOwner;
    if (summary.activeOrganizerIds.length > 0) {
      const admin = getPortalAdminClient();
      // Fetch total + draft-specific counts in parallel — the draft count
      // surfaces in the sidebar badge so abandoned work is discoverable.
      const [submissionsRes, draftsRes] = await Promise.all([
        admin
          .from("pending_festivals")
          .select("id", { count: "exact", head: true })
          .eq("submitted_by_user_id", session.user.id)
          .eq("submission_source", "organizer_portal"),
        admin
          .from("pending_festivals")
          .select("id", { count: "exact", head: true })
          .eq("submitted_by_user_id", session.user.id)
          .eq("submission_source", "organizer_portal")
          .eq("status", "draft"),
      ]);
      if (submissionsRes.error) {
        throw new Error(submissionsRes.error.message);
      }
      const submissionCount = submissionsRes.count ?? 0;
      hasSubmissions = submissionCount > 0;
      draftCount = draftsRes.error ? 0 : draftsRes.count ?? 0;

      const renderPromotionBlock = () => (
        <div className="max-w-md rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Промотирай фестивал</p>
          <p className="mt-1 text-sm text-gray-600">Увеличи видимостта на събитието си</p>
          <div className="mt-3">
            <a
              href="/organizer/submissions"
              className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm text-white transition hover:bg-black/90"
            >
              Заяви промотиране
            </a>
          </div>
          <a href="/organizer/benefits" className="mt-2 block text-xs text-gray-500 underline hover:text-gray-700">
            Научи повече
          </a>
        </div>
      );

      if (isDashboard && submissionCount > 0) {
        headerSummary = renderPromotionBlock();
      }
    }
  }

  return (
    <WorkspaceShell
      density="organizer-b"
      eyebrow="Организатори"
      email={session?.user?.email ?? null}
      headerSummary={headerSummary}
      sidebar={
        <OrganizerSidebarNav
          isOrganizerOwner={isOrganizerOwner}
          hasSubmissions={hasSubmissions}
          draftCount={draftCount}
        />
      }
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </WorkspaceShell>
  );
}
