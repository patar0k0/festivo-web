export { default as AdminEntityPageShell } from "./AdminEntityPageShell";
export { default as AdminSummaryStrip } from "./AdminSummaryStrip";
export type { AdminSummaryItem } from "./AdminSummaryStrip";
export { default as AdminFieldSection } from "./AdminFieldSection";
export { default as AdminFieldGrid } from "./AdminFieldGrid";
export { default as AdminMetaSection, AdminMetaDetails } from "./AdminMetaSection";
export { ADMIN_SECTION } from "./adminSectionTitles";
export { default as AdminFieldLabel } from "./AdminFieldLabel";
export type { AdminSummaryStripItem } from "@/lib/admin/entitySchema";
export {
  ADMIN_FIELD_LABEL,
  ADMIN_ENTITY_SECTION,
  ADMIN_ENTITY_PAGE_SECTION_ORDER,
  buildStandardSummaryStripItems,
  adminEntityFieldGridClass,
  adminResearchAiFieldGridClass,
  getAdminFieldLabel,
  adminLabelForSuggestionField,
} from "@/lib/admin/entitySchema";
