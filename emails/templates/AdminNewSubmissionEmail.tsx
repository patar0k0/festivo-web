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
  reviewUrl: string;
};

export function AdminNewSubmissionEmail({
  siteUrl,
  festivalTitle,
  cityDisplay,
  startDateDisplay,
  reviewUrl,
}: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Нов фестивал от организаторски портал
      </Heading>
      <Text style={p}>Постъпи подаване за модерация — прегледай записа в админ панела.</Text>
      <EmailSection>
        <EmailInfoRow label="Заглавие" value={festivalTitle} />
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        {startDateDisplay ? <EmailInfoRow label="Начало" value={startDateDisplay} /> : null}
      </EmailSection>
      <EmailSection>
        <EmailButton href={reviewUrl}>Отвори модерацията</EmailButton>
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
