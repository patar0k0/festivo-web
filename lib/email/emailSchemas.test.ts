import { describe, it, expect } from "vitest";
import { parseAdminAutoClaimGrantedPayload } from "./emailSchemas";

describe("parseAdminAutoClaimGrantedPayload", () => {
  it("parses a valid payload", () => {
    const result = parseAdminAutoClaimGrantedPayload({
      organizerName: 'Народно читалище "Съгласие-2014"',
      organizerSlug: "narodno-chitalishte-saglasie-2014",
      userId: "726fe361-1f8b-4929-8c13-e01b6e792258",
      userEmail: "syglasie_2014@abv.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/713b40df-09b1-4452-8617-8c6f4463c3b6/edit",
    });
    expect(result).toEqual({
      organizerName: 'Народно читалище "Съгласие-2014"',
      organizerSlug: "narodno-chitalishte-saglasie-2014",
      userId: "726fe361-1f8b-4929-8c13-e01b6e792258",
      userEmail: "syglasie_2014@abv.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/713b40df-09b1-4452-8617-8c6f4463c3b6/edit",
    });
  });

  it("allows a null organizerSlug", () => {
    const result = parseAdminAutoClaimGrantedPayload({
      organizerName: "Test Org",
      organizerSlug: null,
      userId: "u1",
      userEmail: "a@b.bg",
      organizerAdminUrl: "https://festivo.bg/admin/organizers/x/edit",
    });
    expect(result.organizerSlug).toBeNull();
  });

  it("throws when organizerName is missing", () => {
    expect(() =>
      parseAdminAutoClaimGrantedPayload({
        userId: "u1",
        userEmail: "a@b.bg",
        organizerAdminUrl: "https://festivo.bg/admin/organizers/x/edit",
      }),
    ).toThrow("invalid_payload:missing_organizerName");
  });
});
