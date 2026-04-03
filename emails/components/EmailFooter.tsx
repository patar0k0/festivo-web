import { Hr, Link, Text } from "@react-email/components";
import type { CSSProperties } from "react";

type EmailFooterProps = {
  siteUrl: string;
};

export function EmailFooter({ siteUrl }: EmailFooterProps) {
  return (
    <>
      <Hr style={divider} />
      <Text style={footer}>
        Festivo е каталог на фестивали в България.{" "}
        <Link href={siteUrl} style={link}>
          Отвори сайта
        </Link>
      </Text>
      <Text style={fine}>Това е автоматично съобщение — моля, не отговаряйте директно на този имейл.</Text>
    </>
  );
}

const divider: CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "32px 0 0",
};

const footer: CSSProperties = {
  margin: "20px 0 8px",
  fontSize: "13px",
  lineHeight: "1.55",
  color: "#71717a",
};

const fine: CSSProperties = {
  margin: 0,
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#a1a1aa",
};

const link: CSSProperties = {
  color: "#18181b",
  fontWeight: 600,
  textDecoration: "underline",
};
