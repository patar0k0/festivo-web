import {
  Body,
  Container,
  Head,
  Html,
  Section,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

import { EmailFooter } from "./EmailFooter";
import { EmailHeader } from "./EmailHeader";

type BaseLayoutProps = {
  children: ReactNode;
  /** Absolute site origin for footer link (e.g. https://festivo.bg). */
  siteUrl: string;
  optionalEmailLinks?: {
    unsubscribeUrl: string;
    managePreferencesUrl: string;
  } | null;
};

export function BaseLayout({ children, siteUrl, optionalEmailLinks }: BaseLayoutProps) {
  return (
    <Html lang="bg">
      <Head />
      <Body style={body}>
        <Section style={outer}>
          <Container style={container}>
            <EmailHeader />
            {children}
            <EmailFooter siteUrl={siteUrl} optionalEmailLinks={optionalEmailLinks} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const body: CSSProperties = {
  margin: 0,
  padding: "28px 0",
  backgroundColor: "#faf8f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const outer: CSSProperties = {
  margin: 0,
  padding: "0 16px",
};

const container: CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "36px 32px 28px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #efe9dc",
  boxShadow: "0 2px 8px rgba(124,45,18,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};
