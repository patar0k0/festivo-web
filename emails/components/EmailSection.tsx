import { Section } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

type EmailSectionProps = {
  children: ReactNode;
};

export function EmailSection({ children }: EmailSectionProps) {
  return <Section style={section}>{children}</Section>;
}

const section: CSSProperties = {
  margin: "0 0 20px",
};
