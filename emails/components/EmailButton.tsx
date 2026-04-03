import { Button } from "@react-email/components";
import type { CSSProperties } from "react";

type EmailButtonProps = {
  href: string;
  children: string;
};

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button href={href} style={btn}>
      {children}
    </Button>
  );
}

const btn: CSSProperties = {
  backgroundColor: "#18181b",
  borderRadius: "8px",
  color: "#fafafa",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 22px",
  lineHeight: "1.25",
};
