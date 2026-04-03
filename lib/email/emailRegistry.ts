import { createElement } from "react";

import { AdminNewClaimEmail } from "@/emails/templates/AdminNewClaimEmail";
import { AdminNewSubmissionEmail } from "@/emails/templates/AdminNewSubmissionEmail";
import { FestivalApprovedEmail } from "@/emails/templates/FestivalApprovedEmail";
import { FestivalRejectedEmail } from "@/emails/templates/FestivalRejectedEmail";
import { FestivalSubmissionReceivedEmail } from "@/emails/templates/FestivalSubmissionReceivedEmail";
import { OrganizerClaimApprovedEmail } from "@/emails/templates/OrganizerClaimApprovedEmail";
import { OrganizerClaimReceivedEmail } from "@/emails/templates/OrganizerClaimReceivedEmail";
import { OrganizerClaimRejectedEmail } from "@/emails/templates/OrganizerClaimRejectedEmail";
import { TestEmail } from "@/emails/templates/TestEmail";
import { getBaseUrl } from "@/lib/seo";

import {
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
  EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
  EMAIL_JOB_TYPE_TEST,
  type EmailJobType,
} from "./emailJobTypes";
import {
  parseAdminNewClaimPayload,
  parseAdminNewSubmissionPayload,
  parseFestivalApprovedPayload,
  parseFestivalRejectedPayload,
  parseFestivalSubmissionReceivedPayload,
  parseOrganizerClaimApprovedPayload,
  parseOrganizerClaimReceivedPayload,
  parseOrganizerClaimRejectedPayload,
  parseTestEmailPayload,
} from "./emailSchemas";
import { renderEmail } from "./render";

export type BuiltEmailContent = {
  subject: string;
  html: string;
  text: string;
};

type RegistryEntry = {
  buildDefaultSubject: (payload: unknown) => string;
  build: (payload: unknown) => Promise<BuiltEmailContent>;
};

function siteOrigin(): string {
  return getBaseUrl().replace(/\/$/, "");
}

const REGISTRY: Record<EmailJobType, RegistryEntry> = {
  [EMAIL_JOB_TYPE_TEST]: {
    buildDefaultSubject: () => "Festivo — тестов имейл",
    build: async (payload) => {
      const p = parseTestEmailPayload(payload as Record<string, unknown>);
      const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "приятел";
      const siteUrl = siteOrigin();
      const { html, text } = await renderEmail(createElement(TestEmail, { name, siteUrl }));
      return { subject: "Festivo — тестов имейл", html, text };
    },
  },

  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED]: {
    buildDefaultSubject: () => "Festivo — получихме заявката ти за профил",
    build: async (payload) => {
      const p = parseOrganizerClaimReceivedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const { html, text } = await renderEmail(
        createElement(OrganizerClaimReceivedEmail, {
          siteUrl,
          organizerName: p.organizerName,
          organizerPortalUrl: p.organizerPortalUrl,
        }),
      );
      return { subject: "Festivo — получихме заявката ти за профил", html, text };
    },
  },

  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED]: {
    buildDefaultSubject: () => "Festivo — заявката за профил е одобрена",
    build: async (payload) => {
      const p = parseOrganizerClaimApprovedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const { html, text } = await renderEmail(
        createElement(OrganizerClaimApprovedEmail, {
          siteUrl,
          organizerName: p.organizerName,
          dashboardUrl: p.dashboardUrl,
        }),
      );
      return { subject: "Festivo — заявката за профил е одобрена", html, text };
    },
  },

  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED]: {
    buildDefaultSubject: () => "Festivo — отговор по заявката за профил",
    build: async (payload) => {
      const p = parseOrganizerClaimRejectedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const { html, text } = await renderEmail(
        createElement(OrganizerClaimRejectedEmail, { siteUrl, organizerName: p.organizerName }),
      );
      return { subject: "Festivo — отговор по заявката за профил", html, text };
    },
  },

  [EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED]: {
    buildDefaultSubject: (pl) => {
      const p = parseFestivalSubmissionReceivedPayload(pl as Record<string, unknown>);
      return `Festivo — получихме „${p.festivalTitle.slice(0, 80)}“`;
    },
    build: async (payload) => {
      const p = parseFestivalSubmissionReceivedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo — получихме „${p.festivalTitle.slice(0, 80)}“`;
      const { html, text } = await renderEmail(
        createElement(FestivalSubmissionReceivedEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          cityDisplay: p.cityDisplay,
          startDateDisplay: p.startDateDisplay,
          submissionsUrl: p.submissionsUrl,
        }),
      );
      return { subject, html, text };
    },
  },

  [EMAIL_JOB_TYPE_FESTIVAL_APPROVED]: {
    buildDefaultSubject: (pl) => {
      const p = parseFestivalApprovedPayload(pl as Record<string, unknown>);
      return `Festivo — „${p.festivalTitle.slice(0, 70)}“ е в каталога`;
    },
    build: async (payload) => {
      const p = parseFestivalApprovedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo — „${p.festivalTitle.slice(0, 70)}“ е в каталога`;
      const { html, text } = await renderEmail(
        createElement(FestivalApprovedEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          festivalUrl: p.festivalUrl,
          cityDisplay: p.cityDisplay,
          startDateDisplay: p.startDateDisplay,
        }),
      );
      return { subject, html, text };
    },
  },

  [EMAIL_JOB_TYPE_FESTIVAL_REJECTED]: {
    buildDefaultSubject: (pl) => {
      const p = parseFestivalRejectedPayload(pl as Record<string, unknown>);
      return `Festivo — „${p.festivalTitle.slice(0, 70)}“ не беше одобрен`;
    },
    build: async (payload) => {
      const p = parseFestivalRejectedPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo — „${p.festivalTitle.slice(0, 70)}“ не беше одобрен`;
      const { html, text } = await renderEmail(
        createElement(FestivalRejectedEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          cityDisplay: p.cityDisplay,
          startDateDisplay: p.startDateDisplay,
        }),
      );
      return { subject, html, text };
    },
  },

  [EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM]: {
    buildDefaultSubject: () => "Festivo админ — нова заявка за профил",
    build: async (payload) => {
      const p = parseAdminNewClaimPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const { html, text } = await renderEmail(
        createElement(AdminNewClaimEmail, {
          siteUrl,
          organizerName: p.organizerName,
          userId: p.userId,
          reviewUrl: p.reviewUrl,
        }),
      );
      return { subject: "Festivo админ — нова заявка за профил", html, text };
    },
  },

  [EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION]: {
    buildDefaultSubject: (pl) => {
      const p = parseAdminNewSubmissionPayload(pl as Record<string, unknown>);
      return `Festivo админ — нов фестивал: „${p.festivalTitle.slice(0, 60)}“`;
    },
    build: async (payload) => {
      const p = parseAdminNewSubmissionPayload(payload as Record<string, unknown>);
      const siteUrl = siteOrigin();
      const subject = `Festivo админ — нов фестивал: „${p.festivalTitle.slice(0, 60)}“`;
      const { html, text } = await renderEmail(
        createElement(AdminNewSubmissionEmail, {
          siteUrl,
          festivalTitle: p.festivalTitle,
          cityDisplay: p.cityDisplay,
          startDateDisplay: p.startDateDisplay,
          reviewUrl: p.reviewUrl,
        }),
      );
      return { subject, html, text };
    },
  },
};

export function resolveEmailJobSubjectFromRegistry(
  type: EmailJobType,
  jobSubject: string | null,
  payload: Record<string, unknown>,
): string {
  const custom = jobSubject?.trim();
  if (custom) return custom;
  return REGISTRY[type].buildDefaultSubject(payload);
}

export async function buildEmailJobContent(
  type: EmailJobType,
  jobSubject: string | null,
  payload: Record<string, unknown>,
): Promise<BuiltEmailContent> {
  const built = await REGISTRY[type].build(payload);
  const custom = jobSubject?.trim();
  return {
    subject: custom || built.subject,
    html: built.html,
    text: built.text,
  };
}
