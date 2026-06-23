import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  organizerName: string;
  userEmail: string;
  organizerAdminUrl: string;
};

export function AdminAutoClaimGrantedEmail({ siteUrl, organizerName, userEmail, organizerAdminUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Автоматично предоставени права за организатор
      </Heading>
      <Text style={p}>
        Потвърден имейл на нов потребител съвпадна с имейла на неклеймнат организаторски
        профил — правата за собственик бяха дадени автоматично, без чакане за одобрение.
      </Text>
      <EmailSection>
        <EmailInfoRow label="Организатор" value={organizerName} />
        <EmailInfoRow label="Имейл на потребителя" value={userEmail} />
      </EmailSection>
      <EmailSection>
        <EmailButton href={organizerAdminUrl}>Преглед на профила в админа</EmailButton>
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
