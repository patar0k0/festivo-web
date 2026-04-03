import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";

type Props = {
  siteUrl: string;
  organizerName: string;
};

export function OrganizerClaimRejectedEmail({ siteUrl, organizerName }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Заявката не беше одобрена
      </Heading>
      <Text style={p}>
        Съжаляваме — заявката за профила <strong>{organizerName}</strong> не беше приета на този етап. Това не
        означава непременно окончателен отказ; при промяна в обстоятелствата можеш да подадеш нова заявка от сайта.
      </Text>
      <Text style={p}>
        Ако имаш въпроси, екипът на Festivo е на разположение през контактите, публикувани на сайта.
      </Text>
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
