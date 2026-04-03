import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";

type TestEmailProps = {
  name: string;
  siteUrl: string;
};

export function TestEmail({ name, siteUrl }: TestEmailProps) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={heading}>
        Здравей, {name}
      </Heading>
      <Text style={paragraph}>
        Това е тестово съобщение от Festivo. Ако го виждаш, pipeline-ът React Email → Resend работи.
      </Text>
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

const paragraph: CSSProperties = {
  margin: 0,
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
