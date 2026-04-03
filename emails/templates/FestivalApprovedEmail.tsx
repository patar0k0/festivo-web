import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  festivalUrl: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
};

export function FestivalApprovedEmail({
  siteUrl,
  festivalTitle,
  festivalUrl,
  cityDisplay,
  startDateDisplay,
}: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Фестивалът е публикуван
      </Heading>
      <Text style={p}>
        Радваме се да съобщим, че <strong>{festivalTitle}</strong> вече е видим в каталога на Festivo.
      </Text>
      <EmailSection>
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        {startDateDisplay ? <EmailInfoRow label="Начало" value={startDateDisplay} /> : null}
      </EmailSection>
      <EmailSection>
        <EmailButton href={festivalUrl}>Виж публичната страница</EmailButton>
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
