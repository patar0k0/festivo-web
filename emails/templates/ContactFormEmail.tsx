import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";

type ContactFormEmailProps = {
  siteUrl: string;
  visitorName: string;
  visitorEmail: string;
  message: string;
};

export function ContactFormEmail({ siteUrl, visitorName, visitorEmail, message }: ContactFormEmailProps) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={heading}>
        Съобщение от контактната форма
      </Heading>
      <Text style={label}>
        <strong>Име:</strong> {visitorName}
      </Text>
      <Text style={label}>
        <strong>Имейл:</strong> {visitorEmail}
      </Text>
      <Text style={label}>
        <strong>Съобщение:</strong>
      </Text>
      <Text style={messageText}>{message}</Text>
    </BaseLayout>
  );
}

const heading: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const label: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};

const messageText: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#18181b",
  whiteSpace: "pre-wrap",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};
