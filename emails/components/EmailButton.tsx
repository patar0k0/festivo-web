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
  backgroundColor: "#7c2d12",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 30px",
  lineHeight: "1.25",
  letterSpacing: "0.01em",
};
