import { Heading, Link, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";

type Props = {
  siteUrl: string;
  festivalName: string;
  festivalUrl: string;
  categoryLabel: string;
  message: string;
  reportedAt: string;
};

export function AdminFestivalReportEmail({
  siteUrl,
  festivalName,
  festivalUrl,
  categoryLabel,
  message,
  reportedAt,
}: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={heading}>
        Нов сигнал за проблем с фестивал
      </Heading>
      <Text style={label}>
        <strong>Фестивал:</strong>{" "}
        <Link href={festivalUrl} style={link}>
          {festivalName}
        </Link>
      </Text>
      <Text style={label}>
        <strong>Категория:</strong> {categoryLabel}
      </Text>
      <Text style={label}>
        <strong>Дата:</strong> {reportedAt}
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

const link: CSSProperties = {
  color: "#ff4c1f",
  textDecoration: "underline",
};

const messageText: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#18181b",
  whiteSpace: "pre-wrap",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};
