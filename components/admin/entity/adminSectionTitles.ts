import { ADMIN_ENTITY_SECTION } from "@/lib/admin/entitySchema";

/** Shared section titles for festival-related admin entity screens (derived from `entitySchema`). */
export const ADMIN_SECTION = {
  mainInfo: ADMIN_ENTITY_SECTION.mainInfo.title,
  dateTime: ADMIN_ENTITY_SECTION.dateTime.title,
  location: ADMIN_ENTITY_SECTION.location.title,
  organizer: ADMIN_ENTITY_SECTION.organizer.title,
  linksSources: ADMIN_ENTITY_SECTION.linksSources.title,
  media: ADMIN_ENTITY_SECTION.media.title,
  descriptionContent: ADMIN_ENTITY_SECTION.descriptionContent.title,
  systemMeta: ADMIN_ENTITY_SECTION.systemMeta.title,
} as const;
