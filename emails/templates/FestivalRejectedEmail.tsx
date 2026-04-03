import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  festivalTitle: string;
  cityDisplay: string | null;
  startDateDisplay: string | null;
};

export function FestivalRejectedEmail({ siteUrl, festivalTitle, cityDisplay, startDateDisplay }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Фестивалът не беше одобрен
      </Heading>
      <Text style={p}>
        Благодарим, че сподели събитието с Festivo. След преглед екипът реши, че <strong>{festivalTitle}</strong> няма
        да бъде публикуван в каталога на този етап.
      </Text>
      <Text style={p}>
        Това не те спира да подадеш отново при обновена информация или друг подходящ формат.
      </Text>
      <EmailSection>
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        {startDateDisplay ? <EmailInfoRow label="Начало" value={startDateDisplay} /> : null}
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
