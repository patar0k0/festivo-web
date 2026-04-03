import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
  submissionsUrl: string;
};

export function FestivalSubmissionReceivedEmail({
  siteUrl,
  festivalTitle,
  cityDisplay,
  startDateDisplay,
  submissionsUrl,
}: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Фестивалът е изпратен за преглед
      </Heading>
      <Text style={p}>
        Записахме подаденото събитие в опашката за модерация. Ще получиш известие, когато екипът на Festivo приключи
        прегледа.
      </Text>
      <EmailSection>
        <EmailInfoRow label="Заглавие" value={festivalTitle} />
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        {startDateDisplay ? <EmailInfoRow label="Начало" value={startDateDisplay} /> : null}
      </EmailSection>
      <EmailSection>
        <EmailButton href={submissionsUrl}>Виж подадените фестивали</EmailButton>
      </EmailSection>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const p: CSSProperties = {
  margin: "0 0 18px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
