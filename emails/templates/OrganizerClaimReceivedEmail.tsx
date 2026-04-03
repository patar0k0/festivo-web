import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  organizerPortalUrl: string;
};

export function OrganizerClaimReceivedEmail({ siteUrl, organizerName, organizerPortalUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Получихме заявката ти
      </Heading>
      <Text style={p}>
        Заявката за достъп до профила на <strong>{organizerName}</strong> е записана успешно. Екипът на Festivo
        прегледа данните и ще се свърже при нужда от допълнителна информация.
      </Text>
      <Text style={p}>
        Обикновено отговорът отнема малко време — благодарим за търпението.
      </Text>
      <EmailSection>
        <EmailButton href={organizerPortalUrl}>Към зоната за организатори</EmailButton>
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
