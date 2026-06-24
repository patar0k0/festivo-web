import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  dashboardUrl: string;
  planExpiresAtDisplay: string | null;
};

export function OrganizerVipGrantedEmail({ siteUrl, organizerName, dashboardUrl, planExpiresAtDisplay }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Профилът ти вече е VIP
      </Heading>
      <Text style={p}>
        Профилът <strong>{organizerName}</strong> в Festivo вече е с VIP план
        {planExpiresAtDisplay ? <> до <strong>{planExpiresAtDisplay}</strong></> : null}. Това увеличава лимита за
        снимки и видео в галериите на фестивалите ти и ти дава приоритет в класирането.
      </Text>
      <EmailSection>
        <EmailButton href={dashboardUrl}>Отвори таблото</EmailButton>
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
  margin: "0 0 14px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
