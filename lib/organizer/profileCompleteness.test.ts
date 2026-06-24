import { describe, it, expect } from "vitest";
import { computeOrganizerCompleteness } from "./profileCompleteness";

function baseInput() {
  return {
    logo_url: "",
    description: "",
    website_url: "",
    facebook_url: "",
    instagram_url: "",
    email: "",
    phone: "",
    festivalCount: 0,
  };
}

describe("computeOrganizerCompleteness", () => {
  it("returns 0/5 done when everything is empty", () => {
    const result = computeOrganizerCompleteness(baseInput());
    expect(result.doneCount).toBe(0);
    expect(result.total).toBe(5);
    expect(result.items.every((item) => !item.done)).toBe(true);
  });

  it("returns 5/5 done when every field is filled", () => {
    const result = computeOrganizerCompleteness({
      logo_url: "https://example.com/logo.png",
      description: "Народно читалище",
      website_url: "https://example.bg",
      facebook_url: "",
      instagram_url: "",
      email: "org@example.bg",
      phone: "",
      festivalCount: 1,
    });
    expect(result.doneCount).toBe(5);
  });

  it("counts the links item as done when only facebook_url is set", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), facebook_url: "https://facebook.com/x" });
    const linksItem = result.items.find((item) => item.key === "links");
    expect(linksItem?.done).toBe(true);
  });

  it("counts the contact item as done when only phone is set", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), phone: "0888123456" });
    const contactItem = result.items.find((item) => item.key === "contact");
    expect(contactItem?.done).toBe(true);
  });

  it("treats whitespace-only strings as empty", () => {
    const result = computeOrganizerCompleteness({ ...baseInput(), description: "   " });
    const descItem = result.items.find((item) => item.key === "description");
    expect(descItem?.done).toBe(false);
  });

  it("marks the festival item done only when festivalCount is greater than 0", () => {
    const zero = computeOrganizerCompleteness({ ...baseInput(), festivalCount: 0 });
    const one = computeOrganizerCompleteness({ ...baseInput(), festivalCount: 1 });
    expect(zero.items.find((i) => i.key === "festival")?.done).toBe(false);
    expect(one.items.find((i) => i.key === "festival")?.done).toBe(true);
  });
});
