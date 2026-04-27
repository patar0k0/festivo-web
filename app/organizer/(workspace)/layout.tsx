import OrganizerSidebarNav from "@/components/organizer/OrganizerSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import {
  fetchOrganizerPortalMembershipSummaryCached,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import { ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS, ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS } from "@/lib/queries";

export default async function OrganizerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSessionUser();
  let isOrganizerOwner = false;
  let headerSummary: React.ReactNode = null;

  if (session?.user?.id) {
    const summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
    isOrganizerOwner = summary.isOrganizerOwner;
    const orgIds = summary.activeOrganizerIds;
    if (orgIds.length > 0) {
      const admin = getPortalAdminClient();
      const { data: orgRows, error: orgErr } = await admin
        .from("organizers")
        .select(ORGANIZER_PORTAL_ORGANIZER_VIP_FIELDS)
        .in("id", orgIds)
        .eq("is_active", true);
      if (orgErr) {
        throw new Error(orgErr.message);
      }
      const { data: festRows, error: festErr } = await admin
        .from("festivals")
        .select(ORGANIZER_PORTAL_FESTIVAL_PROMOTION_KEYS)
        .in("organizer_id", orgIds);
      if (festErr) {
        throw new Error(festErr.message);
      }
      const festivals = festRows ?? [];
      const activePromotedCount = festivals.filter((f) => hasActivePromotion(f)).length;
      const hasVip = (orgRows ?? []).some((o) => hasActiveVip(o));

      headerSummary = (
        <>
          <div className="text-sm text-gray-700">
            {activePromotedCount > 0 ? <span>{activePromotedCount} активни промотирани</span> : null}
            {hasVip ? <span className={activePromotedCount > 0 ? "ml-3" : ""}>VIP план активен</span> : null}
          </div>
          {activePromotedCount === 0 ? (
            <div className="text-sm text-gray-500">Нямаш активни промотирани фестивали</div>
          ) : null}
        </>
      );
    }
  }

  return (
    <WorkspaceShell
      density="organizer-b"
      eyebrow="Festivo · организатори"
      email={session?.user?.email ?? null}
      headerSummary={headerSummary}
      sidebar={<OrganizerSidebarNav isOrganizerOwner={isOrganizerOwner} />}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </WorkspaceShell>
  );
}
