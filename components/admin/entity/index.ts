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
  ADMIN_ENTITY_CONTROL_BASE,
  ADMIN_ENTITY_CONTROL_CLASS,
  ADMIN_ENTITY_CONTROL_READONLY_CLASS,
  ADMIN_ENTITY_TEXTAREA_CLASS,
  ADMIN_ENTITY_TEXTAREA_READONLY_CLASS,
} from "@/lib/admin/entitySchema";
