import { Heading, Hr, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailSection } from "@/emails/components/EmailSection";

type Props = {
  siteUrl: string;
  firstName?: string | null;
  unsubscribeUrl?: string | null;
  managePreferencesUrl?: string | null;
};

const FEATURES = [
  {
    icon: "🔍",
    title: "Открий",
    description: "65+ верифицирани фестивала по град, дата и категория",
  },
  {
    icon: "📅",
    title: "Планирай",
    description: 'Запази фестивали в „Моят план" и получи напомняне преди началото',
  },
  {
    icon: "📍",
    title: "Посети",
    description: "Карта, програма и локация — всичко на едно място",
  },
] as const;

export function WelcomeEmail({ siteUrl, firstName, unsubscribeUrl, managePreferencesUrl }: Props) {
  const greeting = firstName?.trim() ? `Здравей, ${firstName.trim()}!` : "Здравей!";

  const optionalEmailLinks =
    unsubscribeUrl?.trim() && managePreferencesUrl?.trim()
      ? { unsubscribeUrl: unsubscribeUrl.trim(), managePreferencesUrl: managePreferencesUrl.trim() }
      : null;

  return (
    <BaseLayout siteUrl={siteUrl} optionalEmailLinks={optionalEmailLinks}>
      {/* Hero accent bar */}
      <div style={accentBar} />

      <Heading as="h1" style={h1}>
        {greeting}
      </Heading>

      <Text style={lead}>
        Добре дошъл в <strong>Festivo</strong> — каталога на фестивалите в България.
        Открий, планирай и посети.
      </Text>

      {/* Feature list */}
      <EmailSection>
        <div style={featuresBox}>
          {FEATURES.map((f) => (
            <div key={f.title} style={featureRow}>
              <span style={featureIcon}>{f.icon}</span>
              <div>
                <span style={featureTitle}>{f.title}</span>
                <span style={featureSep}> — </span>
                <span style={featureDesc}>{f.description}</span>
              </div>
            </div>
          ))}
        </div>
      </EmailSection>

      {/* CTA */}
      <EmailSection>
        <EmailButton href={`${siteUrl}/festivals`}>Разгледай фестивалите →</EmailButton>
      </EmailSection>

      <Hr style={divider} />

      <Text style={footer}>
        Имаш въпроси? Пиши ни на{" "}
        <a href="mailto:admin@festivo.bg" style={link}>
          admin@festivo.bg
        </a>{" "}
        — отговаряме бързо.
      </Text>
    </BaseLayout>
  );
}

const accentBar: CSSProperties = {
  height: "4px",
  backgroundColor: "#7c2d12",
  borderRadius: "2px",
  marginBottom: "28px",
};

const h1: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "26px",
  fontWeight: 700,
  lineHeight: "1.25",
  color: "#18181b",
  letterSpacing: "-0.02em",
};

const lead: CSSProperties = {
  margin: "0 0 24px",
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#3f3f46",
};

const featuresBox: CSSProperties = {
  backgroundColor: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  padding: "20px 24px",
  marginBottom: "8px",
};

const featureRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
};

const featureIcon: CSSProperties = {
  fontSize: "18px",
  lineHeight: "1.5",
  flexShrink: 0,
};

const featureTitle: CSSProperties = {
  fontWeight: 700,
  color: "#18181b",
  fontSize: "15px",
};

const featureSep: CSSProperties = {
  color: "#a1a1aa",
  fontSize: "15px",
};

const featureDesc: CSSProperties = {
  color: "#52525b",
  fontSize: "15px",
  lineHeight: "1.5",
};

const divider: CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "24px 0 0",
};

const footer: CSSProperties = {
  margin: "16px 0 0",
  fontSize: "13px",
  lineHeight: "1.55",
  color: "#71717a",
};

const link: CSSProperties = {
  color: "#18181b",
  fontWeight: 600,
};
