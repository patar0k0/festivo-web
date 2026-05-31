import { Heading, Text, Hr } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailSection } from "@/emails/components/EmailSection";

export type OrganizerOutreachFestival = {
  title: string;
  url: string;
};

type Props = {
  siteUrl: string;
  organizerName: string;
  festivals: OrganizerOutreachFestival[];
  claimUrl: string;
};

export function OrganizerOutreachEmail({ siteUrl, organizerName, festivals, claimUrl }: Props) {
  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        Вашите фестивали вече са в Festivo.bg
      </Heading>

      <Text style={p}>Здравейте,</Text>

      <Text style={p}>
        Казвам се Боко и съм основателят на{" "}
        <a href={siteUrl} style={link}>
          Festivo.bg
        </a>{" "}
        — каталогът на фестивалите в България. Платформата помага на хората да намират, планират и не
        пропускат фестивали в цялата страна.
      </Text>

      <Text style={p}>
        Фестивалите на <strong>{organizerName}</strong> вече са добавени в каталога:
      </Text>

      <EmailSection>
        {festivals.map((f) => (
          <Text key={f.url} style={festivalRow}>
            →{" "}
            <a href={f.url} style={link}>
              {f.title}
            </a>
          </Text>
        ))}
      </EmailSection>

      <Hr style={hr} />

      <Text style={p}>
        Поканваме ви да заявите профила си безплатно. Ще получите достъп до организаторски таблo,
        от което можете да редактирате описания и снимки, да добавяте нови фестивали и да
        виждате колко хора са ги добавили в плановете си.
      </Text>

      <Text style={p}>
        За 2026 г. предлагаме безплатен <strong>VIP Организатор</strong> статус — по-добро
        класиране в резултатите и отличителен знак на вашия профил.
      </Text>

      <EmailSection>
        <EmailButton href={claimUrl}>Заяви профила си безплатно →</EmailButton>
      </EmailSection>

      <Text style={footer}>
        Ако имате въпроси, отговорете директно на този имейл.
        <br />
        Поздрави, Боко — Festivo.bg
      </Text>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 20px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const p: CSSProperties = {
  margin: "0 0 14px",
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#3f3f46",
};

const festivalRow: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#3f3f46",
};

const link: CSSProperties = {
  color: "#7c2d12",
  textDecoration: "underline",
};

const hr: CSSProperties = {
  border: "none",
  borderTop: "1px solid #e4e4e7",
  margin: "20px 0",
};

const footer: CSSProperties = {
  margin: "20px 0 0",
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#71717a",
};
