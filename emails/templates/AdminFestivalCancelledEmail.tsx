import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  festivalAdminUrl: string;
  cancelledByType: "admin" | "organizer";
  cancelledByDisplay: string;
  organizerName: string | null;
  cancellationReason: string;
  planUsersCount: number;
  cancelledAt: string;
};

export function AdminFestivalCancelledEmail({
  siteUrl,
  festivalTitle,
  festivalAdminUrl,
  cancelledByType,
  cancelledByDisplay,
  organizerName,
  cancellationReason,
  planUsersCount,
  cancelledAt,
}: Props) {
  const cancelledByLabel =
    cancelledByType === "organizer"
      ? `Организатор — ${cancelledByDisplay}${organizerName ? ` (${organizerName})` : ""}`
      : `Админ — ${cancelledByDisplay}`;

  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Отменен фестивал
      </Heading>
      <Text style={lead}>
        Фестивалът <strong>{festivalTitle}</strong> беше маркиран като отменен.
      </Text>

      <EmailSection>
        <EmailInfoRow label="Фестивал" value={festivalTitle} />
        <EmailInfoRow label="Отменен от" value={cancelledByLabel} />
        <EmailInfoRow label="Засегнати потребители (план)" value={String(planUsersCount)} />
        <EmailInfoRow label="Отменен на" value={cancelledAt} />
        <EmailInfoRow label="Причина" value={cancellationReason} />
      </EmailSection>

      <EmailSection>
        <EmailButton href={festivalAdminUrl}>Отвори в Admin →</EmailButton>
      </EmailSection>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "1.3",
  color: "#18181b",
};

const lead: CSSProperties = {
  margin: "0 0 18px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
