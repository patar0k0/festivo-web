import {
  Body,
  Container,
  Head,
  Html,
  Section,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

type BaseLayoutProps = {
  children: ReactNode;
};

export function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <Html lang="bg">
      <Head />
      <Body style={body}>
        <Section style={outer}>
          <Container style={container}>{children}</Container>
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
};
