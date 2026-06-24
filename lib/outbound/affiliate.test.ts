import { describe, expect, it } from "vitest";
import { withBookingAffiliate } from "@/lib/outbound/affiliate";

const BASE =
  "https://www.booking.com/searchresults.html?ss=Sofia&checkin=2026-07-01&checkout=2026-07-02";

describe("withBookingAffiliate", () => {
  it("returns the url unchanged when no aid is provided", () => {
    expect(withBookingAffiliate(BASE, "abc", { aid: "" })).toBe(BASE);
    expect(withBookingAffiliate(BASE, "abc", { aid: undefined })).toBe(BASE);
  });

  it("appends aid and a festival-scoped label when aid is provided", () => {
    const out = new URL(withBookingAffiliate(BASE, "fest-123", { aid: "9999" }));
    expect(out.searchParams.get("aid")).toBe("9999");
    expect(out.searchParams.get("label")).toBe("festivo-fest-123");
  });

  it("preserves existing query params", () => {
    const out = new URL(withBookingAffiliate(BASE, "fest-123", { aid: "9999" }));
    expect(out.searchParams.get("ss")).toBe("Sofia");
    expect(out.searchParams.get("checkin")).toBe("2026-07-01");
    expect(out.searchParams.get("checkout")).toBe("2026-07-02");
  });

  it("uses a custom label prefix when given", () => {
    const out = new URL(
      withBookingAffiliate(BASE, "fest-123", { aid: "9999", labelPrefix: "fv" }),
    );
    expect(out.searchParams.get("label")).toBe("fv-fest-123");
  });

  it("falls back to a 'site' label segment when festivalId is missing", () => {
    const out = new URL(withBookingAffiliate(BASE, null, { aid: "9999" }));
    expect(out.searchParams.get("label")).toBe("festivo-site");
  });

  it("sanitizes the label to alnum, dash and underscore", () => {
    const out = new URL(
      withBookingAffiliate(BASE, "a b/c?d", { aid: "9999", labelPrefix: "fes tivo" }),
    );
    // spaces and slashes/question marks collapse to dashes
    expect(out.searchParams.get("label")).toBe("fes-tivo-a-b-c-d");
  });

  it("returns the original string unchanged on an unparseable url", () => {
    expect(withBookingAffiliate("not a url", "abc", { aid: "9999" })).toBe("not a url");
  });
});
