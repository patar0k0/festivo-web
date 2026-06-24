import type { TestEmailJobPayload } from "./emailJobTypes";

function reqString(raw: Record<string, unknown>, key: string, maxLen = 2000): string {
  const v = raw[key];
  if (typeof v !== "string") {
    throw new Error(`invalid_payload:missing_${key}`);
  }
  const t = v.trim();
  if (!t) {
    throw new Error(`invalid_payload:empty_${key}`);
  }
  if (t.length > maxLen) {
    throw new Error(`invalid_payload:${key}_too_long`);
  }
  return t;
}

function optString(raw: Record<string, unknown>, key: string, maxLen = 2000): string | null {
  const v = raw[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export function parseTestEmailPayload(raw: Record<string, unknown>): TestEmailJobPayload {
  const name = optString(raw, "name", 200);
  return { name: name ?? undefined };
}

export type OrganizerClaimReceivedPayload = {
  claimId: string;
  organizerName: string;
  organizerSlug: string | null;
  organizerPortalUrl: string;
};

export function parseOrganizerClaimReceivedPayload(raw: Record<string, unknown>): OrganizerClaimReceivedPayload {
  return {
    claimId: reqString(raw, "claimId", 80),
    organizerName: reqString(raw, "organizerName", 400),
    organizerSlug: optString(raw, "organizerSlug", 200),
    organizerPortalUrl: reqString(raw, "organizerPortalUrl", 2000),
  };
}

export type OrganizerClaimApprovedPayload = {
  organizerName: string;
  organizerSlug: string | null;
  dashboardUrl: string;
};

export function parseOrganizerClaimApprovedPayload(raw: Record<string, unknown>): OrganizerClaimApprovedPayload {
  return {
    organizerName: reqString(raw, "organizerName", 400),
    organizerSlug: optString(raw, "organizerSlug", 200),
    dashboardUrl: reqString(raw, "dashboardUrl", 2000),
  };
}

export type OrganizerClaimRejectedPayload = {
  organizerName: string;
};

export function parseOrganizerClaimRejectedPayload(raw: Record<string, unknown>): OrganizerClaimRejectedPayload {
  return {
    organizerName: reqString(raw, "organizerName", 400),
  };
}

export type FestivalSubmissionReceivedPayload = {
  submissionId: string;
  festivalTitle: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
  submissionsUrl: string;
};

export function parseFestivalSubmissionReceivedPayload(
  raw: Record<string, unknown>,
): FestivalSubmissionReceivedPayload {
  return {
    submissionId: reqString(raw, "submissionId", 80),
    festivalTitle: reqString(raw, "festivalTitle", 400),
    cityDisplay: optString(raw, "cityDisplay", 400),
    startDateDisplay: optString(raw, "startDateDisplay", 120),
    submissionsUrl: reqString(raw, "submissionsUrl", 2000),
  };
}

export type FestivalApprovedPayload = {
  festivalTitle: string;
  festivalSlug: string;
  festivalUrl: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
};

export function parseFestivalApprovedPayload(raw: Record<string, unknown>): FestivalApprovedPayload {
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    festivalSlug: reqString(raw, "festivalSlug", 300),
    festivalUrl: reqString(raw, "festivalUrl", 2000),
    cityDisplay: optString(raw, "cityDisplay", 400),
    startDateDisplay: optString(raw, "startDateDisplay", 120),
  };
}

export type FestivalRejectedPayload = {
  festivalTitle: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
};

export function parseFestivalRejectedPayload(raw: Record<string, unknown>): FestivalRejectedPayload {
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    cityDisplay: optString(raw, "cityDisplay", 400),
    startDateDisplay: optString(raw, "startDateDisplay", 120),
  };
}

export type AdminNewClaimPayload = {
  claimId: string;
  organizerName: string;
  organizerSlug: string | null;
  userId: string;
  reviewUrl: string;
};

export function parseAdminNewClaimPayload(raw: Record<string, unknown>): AdminNewClaimPayload {
  return {
    claimId: reqString(raw, "claimId", 80),
    organizerName: reqString(raw, "organizerName", 400),
    organizerSlug: optString(raw, "organizerSlug", 200),
    userId: reqString(raw, "userId", 80),
    reviewUrl: reqString(raw, "reviewUrl", 2000),
  };
}

export type AdminNewSubmissionPayload = {
  submissionId: string;
  festivalTitle: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
  reviewUrl: string;
};

export function parseAdminNewSubmissionPayload(raw: Record<string, unknown>): AdminNewSubmissionPayload {
  return {
    submissionId: reqString(raw, "submissionId", 80),
    festivalTitle: reqString(raw, "festivalTitle", 400),
    cityDisplay: optString(raw, "cityDisplay", 400),
    startDateDisplay: optString(raw, "startDateDisplay", 120),
    reviewUrl: reqString(raw, "reviewUrl", 2000),
  };
}

export type SavedFestivalReminderEmailPayload = {
  userId: string;
  festivalId: string;
  festivalTitle: string;
  festivalSlug: string;
  festivalUrl: string;
  cityDisplay: string | null;
  locationSummary: string | null;
  startDateDisplay: string | null;
  startTimeDisplay: string | null;
  /** `same_day` accepted as legacy alias for the MVP 2h-before slot (`reminder_subkind` = `2h`). */
  reminderKind: "1_day_before" | "two_hours_before";
  /** Optional footer link (one token per user in `user_email_preferences`). */
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

function parseReminderKind(raw: Record<string, unknown>): "1_day_before" | "two_hours_before" {
  const v = raw.reminderKind;
  if (v === "1_day_before") return "1_day_before";
  if (v === "two_hours_before" || v === "same_day") return "two_hours_before";
  throw new Error("invalid_payload:reminderKind");
}

export function parseSavedFestivalReminderEmailPayload(
  raw: Record<string, unknown>,
): SavedFestivalReminderEmailPayload {
  return {
    userId: reqString(raw, "userId", 80),
    festivalId: reqString(raw, "festivalId", 80),
    festivalTitle: reqString(raw, "festivalTitle", 400),
    festivalSlug: reqString(raw, "festivalSlug", 400),
    festivalUrl: reqString(raw, "festivalUrl", 2000),
    cityDisplay: optString(raw, "cityDisplay", 400),
    locationSummary: optString(raw, "locationSummary", 400),
    startDateDisplay: optString(raw, "startDateDisplay", 120),
    startTimeDisplay: optString(raw, "startTimeDisplay", 40),
    reminderKind: parseReminderKind(raw),
    unsubscribeUrl: optString(raw, "unsubscribeUrl", 2000),
    managePreferencesUrl: optString(raw, "managePreferencesUrl", 2000),
  };
}

export type WelcomeEmailPayload = {
  firstName?: string | null;
  /** Optional footer links (resolved at render-time from user_email_preferences). */
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

export function parseWelcomeEmailPayload(raw: Record<string, unknown>): WelcomeEmailPayload {
  return {
    firstName: optString(raw, "firstName", 200),
    unsubscribeUrl: optString(raw, "unsubscribeUrl", 2000),
    managePreferencesUrl: optString(raw, "managePreferencesUrl", 2000),
  };
}

export type ContactFormPayload = {
  visitorName: string;
  visitorEmail: string;
  message: string;
  /** Reply-To for the outbound message (visitor). */
  replyTo: string;
};

export function parseContactFormPayload(raw: Record<string, unknown>): ContactFormPayload {
  return {
    visitorName: reqString(raw, "visitorName", 120),
    visitorEmail: reqString(raw, "visitorEmail", 320),
    message: reqString(raw, "message", 6000),
    replyTo: reqString(raw, "replyTo", 320),
  };
}

export type AdminFestivalReportPayload = {
  festivalName: string;
  festivalUrl: string;
  categoryLabel: string;
  message: string;
  reportedAt: string;
};

export function parseAdminFestivalReportPayload(
  raw: Record<string, unknown>,
): AdminFestivalReportPayload {
  return {
    festivalName: reqString(raw, "festivalName", 400),
    festivalUrl: reqString(raw, "festivalUrl", 2000),
    categoryLabel: reqString(raw, "categoryLabel", 200),
    message: reqString(raw, "message", 1000),
    reportedAt: reqString(raw, "reportedAt", 50),
  };
}

export type OrganizerOutreachFestivalPayload = {
  title: string;
  url: string;
};

export type OrganizerOutreachPayload = {
  organizerName: string;
  festivals: OrganizerOutreachFestivalPayload[];
  claimUrl: string;
};

export function parseOrganizerOutreachPayload(
  raw: Record<string, unknown>,
): OrganizerOutreachPayload {
  const festivalsRaw = raw["festivals"];
  if (!Array.isArray(festivalsRaw)) throw new Error("invalid_payload:missing_festivals");
  const festivals: OrganizerOutreachFestivalPayload[] = festivalsRaw.map((item, i) => {
    if (typeof item !== "object" || !item) throw new Error(`invalid_payload:festivals[${i}]_not_object`);
    const r = item as Record<string, unknown>;
    return { title: reqString(r, "title", 400), url: reqString(r, "url", 2000) };
  });
  return {
    organizerName: reqString(raw, "organizerName", 400),
    festivals,
    claimUrl: reqString(raw, "claimUrl", 2000),
  };
}

export type FestivalCancelledPayload = {
  festivalTitle: string;
  cityDisplay: string | null;
  originalDateDisplay: string;
  cancellationDateDisplay: string;
  cancellationReason: string;
  alternativesUrl: string;
  calendarUrl: string;
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

export function parseFestivalCancelledPayload(raw: Record<string, unknown>): FestivalCancelledPayload {
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    cityDisplay: optString(raw, "cityDisplay", 200),
    originalDateDisplay: reqString(raw, "originalDateDisplay", 200),
    cancellationDateDisplay: reqString(raw, "cancellationDateDisplay", 200),
    cancellationReason: reqString(raw, "cancellationReason", 500),
    alternativesUrl: reqString(raw, "alternativesUrl", 2000),
    calendarUrl: reqString(raw, "calendarUrl", 2000),
    unsubscribeUrl: optString(raw, "unsubscribeUrl", 2000),
    managePreferencesUrl: optString(raw, "managePreferencesUrl", 2000),
  };
}

export type AdminFestivalCancelledPayload = {
  festivalTitle: string;
  festivalAdminUrl: string;
  cancelledByType: "admin" | "organizer";
  cancelledByDisplay: string;
  organizerName: string | null;
  cancellationReason: string;
  planUsersCount: number;
  cancelledAt: string;
};

export function parseAdminFestivalCancelledPayload(raw: Record<string, unknown>): AdminFestivalCancelledPayload {
  const cancelledByType = raw.cancelledByType === "organizer" ? "organizer" : "admin";
  const planUsersCount = typeof raw.planUsersCount === "number" ? raw.planUsersCount : 0;
  return {
    festivalTitle: reqString(raw, "festivalTitle", 400),
    festivalAdminUrl: reqString(raw, "festivalAdminUrl", 2000),
    cancelledByType,
    cancelledByDisplay: reqString(raw, "cancelledByDisplay", 400),
    organizerName: optString(raw, "organizerName", 400),
    cancellationReason: reqString(raw, "cancellationReason", 500),
    planUsersCount,
    cancelledAt: reqString(raw, "cancelledAt", 100),
  };
}

export type AdminAutoClaimGrantedPayload = {
  organizerName: string;
  organizerSlug: string | null;
  userId: string;
  userEmail: string;
  organizerAdminUrl: string;
};

export function parseAdminAutoClaimGrantedPayload(raw: Record<string, unknown>): AdminAutoClaimGrantedPayload {
  return {
    organizerName: reqString(raw, "organizerName", 400),
    organizerSlug: optString(raw, "organizerSlug", 200),
    userId: reqString(raw, "userId", 80),
    userEmail: reqString(raw, "userEmail", 320),
    organizerAdminUrl: reqString(raw, "organizerAdminUrl", 2000),
  };
}
