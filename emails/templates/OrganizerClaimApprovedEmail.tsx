import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  dashboardUrl: string;
};

export function OrganizerClaimApprovedEmail({ siteUrl, organizerName, dashboardUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Заявката е одобрена
      </Heading>
      <Text style={p}>
        Вече имаш достъп като собственик на профила <strong>{organizerName}</strong> в Festivo. Можеш да управляваш
        информацията и да подаваш фестивали за преглед от организаторския портал.
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
