import { Text } from "@react-email/components";
import type { CSSProperties } from "react";

export function EmailHeader() {
  return (
    <Text style={brand}>
      <span style={brandStrong}>Festivo</span>
      <span style={brandMuted}> · фестивали в България</span>
    </Text>
  );
}

const brand: CSSProperties = {
  margin: "0 0 28px",
  fontSize: "15px",
  lineHeight: "1.4",
  color: "#52525b",
};

const brandStrong: CSSProperties = {
  fontWeight: 700,
  color: "#18181b",
  letterSpacing: "-0.02em",
};

const brandMuted: CSSProperties = {
  fontWeight: 500,
  color: "#71717a",
};
