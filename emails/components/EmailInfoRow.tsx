import { Text } from "@react-email/components";
import type { CSSProperties } from "react";

type EmailInfoRowProps = {
  label: string;
  value: string;
};

export function EmailInfoRow({ label, value }: EmailInfoRowProps) {
  return (
    <Text style={row}>
      <span style={labelStyle}>{label}</span>
      <br />
      <span style={valueStyle}>{value}</span>
    </Text>
  );
}

const row: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "14px",
  lineHeight: "1.5",
};

const labelStyle: CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const valueStyle: CSSProperties = {
  color: "#18181b",
  fontWeight: 500,
  marginTop: "4px",
  display: "inline-block",
};
