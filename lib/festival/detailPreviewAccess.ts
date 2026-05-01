import { getAdminSession } from "@/lib/admin/isAdmin";
import { isFestivalVisibleOnPublicCatalog } from "@/lib/festival/editorOpenAction";
import {
  fetchActiveMembershipOrganizerIds,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { getFestivalOrganizerIdsForAccessCheck } from "@/lib/queries";
import type { Festival } from "@/lib/types";

export function isFestivalPublicDetailCatalogVisible(festival: Festival): boolean {
  return isFestivalVisibleOnPublicCatalog({
    slug: festival.slug,
    status: festival.status ?? "",
    is_verified: festival.is_verified ?? null,
  });
}

/** Admin or active portal member (owner/admin/editor/viewer) of a linked organizer. */
export async function canPreviewNonPublicFestival(festival: Festival): Promise<boolean> {
  const adminSession = await getAdminSession();
  if (adminSession?.isAdmin) {
    return true;
  }

  const portal = await getPortalSessionUser();
  if (!portal?.user?.id) {
    return false;
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return false;
  }

  const memberOrgIds = await fetchActiveMembershipOrganizerIds(admin, portal.user.id);
  const festivalOrgIds = getFestivalOrganizerIdsForAccessCheck(festival);
  return festivalOrgIds.some((id) => memberOrgIds.includes(id));
}
