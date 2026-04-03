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
  padding: "24px 0",
  backgroundColor: "#f4f4f5",
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
  padding: "32px 28px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};
