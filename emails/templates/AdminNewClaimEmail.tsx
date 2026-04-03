import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  userId: string;
  reviewUrl: string;
};

export function AdminNewClaimEmail({ siteUrl, organizerName, userId, reviewUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Нова заявка за организаторски профил
      </Heading>
      <Text style={p}>Има изчакваща заявка за собственик в админ панела.</Text>
      <EmailSection>
        <EmailInfoRow label="Организатор" value={organizerName} />
        <EmailInfoRow label="Потребител (ID)" value={userId} />
      </EmailSection>
      <EmailSection>
        <EmailButton href={reviewUrl}>Преглед в админа</EmailButton>
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
