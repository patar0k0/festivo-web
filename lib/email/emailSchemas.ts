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
