import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";

import { BaseLayout } from "@/emails/components/BaseLayout";
import { EmailButton } from "@/emails/components/EmailButton";
import { EmailInfoRow } from "@/emails/components/EmailInfoRow";
import { EmailSection } from "@/emails/components/EmailSection";

type ReminderVariant = "1_day_before" | "two_hours_before";

type Props = {
  siteUrl: string;
  variant: ReminderVariant;
  festivalTitle: string;
  festivalUrl: string;
  cityDisplay: string | null;
  locationSummary: string | null;
  startDateDisplay: string | null;
  startTimeDisplay: string | null;
};

export function FestivalReminderEmail({
  siteUrl,
  variant,
  festivalTitle,
  festivalUrl,
  cityDisplay,
  locationSummary,
  startDateDisplay,
  startTimeDisplay,
}: Props) {
  const isDayBefore = variant === "1_day_before";

  const dayBeforeLead =
    startTimeDisplay != null && startTimeDisplay.trim() !== "" ? (
      <>
        <strong>{festivalTitle}</strong> е в плана ти и започва утре в {startTimeDisplay}.
      </>
    ) : (
      <>
        <strong>{festivalTitle}</strong> е в плана ти и започва утре. Часът на начало не е посочен в каталога — виж
        страницата на фестивала по-долу.
      </>
    );

  const twoHoursLead =
    startTimeDisplay != null && startTimeDisplay.trim() !== "" ? (
      <>
        <strong>{festivalTitle}</strong> започва в {startTimeDisplay}. Това напомняне се изпраща около <strong>2 часа</strong>{" "}
        преди очакваното начало — провери последните детайли преди тръгване.
      </>
    ) : (
      <>
        <strong>{festivalTitle}</strong> е в плана ти. Това напомняне се изпраща около <strong>2 часа</strong> преди
        очакваното начало; часът не е посочен в каталога — отвори страницата на фестивала за актуална информация.
      </>
    );

  return (
    <BaseLayout siteUrl={siteUrl}>
      <Heading as="h1" style={h1}>
        {isDayBefore ? "Напомняне за утре" : "Напомняне преди началото"}
      </Heading>
      <Text style={p}>{isDayBefore ? dayBeforeLead : twoHoursLead}</Text>
      <EmailSection>
        {startDateDisplay ? <EmailInfoRow label="Дата" value={startDateDisplay} /> : null}
        {startTimeDisplay ? <EmailInfoRow label="Начало" value={startTimeDisplay} /> : null}
        {cityDisplay ? <EmailInfoRow label="Място" value={cityDisplay} /> : null}
        {locationSummary ? <EmailInfoRow label="Локация" value={locationSummary} /> : null}
      </EmailSection>
      <EmailSection>
        <EmailButton href={festivalUrl}>Виж фестивала</EmailButton>
      </EmailSection>
    </BaseLayout>
  );
}

const h1: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  color: "#18181b",
};

const p: CSSProperties = {
  margin: "0 0 18px",
  fontSize: "16px",
  lineHeight: "1.55",
  color: "#3f3f46",
};
