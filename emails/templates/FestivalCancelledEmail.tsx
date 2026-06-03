import { Heading, Hr, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
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

export function FestivalCancelledEmail({
  siteUrl,
  festivalTitle,
  cityDisplay,
  originalDateDisplay,
  cancellationDateDisplay,
  cancellationReason,
  alternativesUrl,
  calendarUrl,
  unsubscribeUrl,
  managePreferencesUrl,
}: Props) {
  const optionalEmailLinks =
    unsubscribeUrl?.trim() && managePreferencesUrl?.trim()
      ? { unsubscribeUrl: unsubscribeUrl.trim(), managePreferencesUrl: managePreferencesUrl.trim() }
      : null;

  return (
    <BaseLayout siteUrl={siteUrl} optionalEmailLinks={optionalEmailLinks}>
      {/* Red accent bar — severity indicator */}
      <div style={accentBar} />

      <Heading as="h1" style={h1}>
        Фестивалът е отменен
      </Heading>

      <Text style={lead}>
        <strong>{festivalTitle}</strong> е в твоя план, но за съжаление е отменен.
      </Text>

      <EmailSection>
        <EmailInfoRow label="Дата" value={originalDateDisplay} />
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        <EmailInfoRow label="Отменен на" value={cancellationDateDisplay} />
      </EmailSection>

      <EmailSection>
        <div style={reasonBox}>
          <Text style={reasonLabel}>Причина от организатора:</Text>
          <Text style={reasonText}>{cancellationReason}</Text>
        </div>
      </EmailSection>

      <EmailSection>
        <EmailButton href={alternativesUrl}>
          {cityDisplay ? `Виж други фестивали в ${cityDisplay} →` : "Разгледай каталога →"}
        </EmailButton>
      </EmailSection>

      <Text style={altCta}>
        Или{" "}
        <a href={calendarUrl} style={altCtaLink}>
          намери алтернативи в същия месец →
        </a>
      </Text>

      <Hr style={divider} />

      <Text style={footer}>
        Получаваш това съобщение, защото беше запазил{" "}
        <strong>{festivalTitle}</strong> в твоя план в Festivo.
      </Text>
    </BaseLayout>
  );
}

const accentBar: CSSProperties = {
  height: "4px",
  backgroundColor: "#dc2626",
  borderRadius: "2px",
  marginBottom: "28px",
};

const h1: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: "1.25",
  color: "#18181b",
};

const lead: CSSProperties = {
  margin: "0 0 20px",
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#3f3f46",
};

const reasonBox: CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  padding: "16px 20px",
};

const reasonLabel: CSSProperties = {
  margin: "0 0 6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#991b1b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const reasonText: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.55",
  color: "#7f1d1d",
};

const altCta: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "14px",
  color: "#71717a",
  textAlign: "center",
};

const altCtaLink: CSSProperties = {
  color: "#18181b",
  fontWeight: 600,
  textDecoration: "underline",
};

const divider: CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "24px 0 0",
};

const footer: CSSProperties = {
  margin: "16px 0 0",
  fontSize: "13px",
  lineHeight: "1.55",
  color: "#71717a",
};
