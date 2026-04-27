import OrganizerSidebarNav from "@/components/organizer/OrganizerSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { getStatus } from "@/lib/admin/promotionsOverview";
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
      const expiringCount = festivals.filter(
        (f) => hasActivePromotion(f) && getStatus(f.promotion_expires_at ?? null) === "expiring",
      ).length;
      const hasVip = (orgRows ?? []).some((o) => hasActiveVip(o));

      if (expiringCount > 0) {
        headerSummary = (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-yellow-900">
              {expiringCount} промоции изтичат скоро
            </p>
            <p className="text-sm text-yellow-800">Поднови ги, за да запазиш видимостта</p>
            <div className="mt-2">
              <a href="/organizer/submissions" className="text-sm text-yellow-900 underline">
                Управлявай промоциите
              </a>
            </div>
          </div>
        );
      } else if (activePromotedCount > 0) {
        headerSummary = (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-green-900">
              Имаш {activePromotedCount} активни промоции
            </p>
            <p className="text-sm text-green-800">Фестивалите ти достигат повече хора</p>
            <div className="mt-2">
              <a href="/organizer/submissions" className="text-sm text-green-900 underline">
                Управлявай промоциите
              </a>
            </div>
          </div>
        );
      } else if (hasVip) {
        headerSummary = (
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-purple-900">VIP план активен</p>
            <p className="text-sm text-purple-800">
              Използвай предимствата си и промотирай фестивал
            </p>
            <div className="mt-2">
              <a href="/organizer/submissions" className="text-sm text-purple-900 underline">
                Промотирай с приоритет
              </a>
            </div>
          </div>
        );
      } else {
        headerSummary = (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Промотирай фестивал</p>
            <p className="text-sm text-gray-600">
              Достигни повече посетители и увеличи интереса към събитието
            </p>
            <div className="mt-3">
              <a
                href="/organizer/submissions"
                className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm text-white transition hover:bg-black/90"
              >
                Промотирай фестивал
              </a>
            </div>
          </div>
        );
      }
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
