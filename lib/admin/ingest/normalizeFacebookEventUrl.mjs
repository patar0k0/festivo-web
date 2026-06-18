export function normalizeFacebookEventUrl(input) {
  const trimmed = String(input ?? "").trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Invalid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "URL must start with http or https." };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "facebook.com" && !host.endsWith(".facebook.com")) {
    return { error: "URL must contain facebook.com/events/." };
  }
  if (!parsed.pathname.toLowerCase().includes("/events/")) {
    return { error: "URL must contain facebook.com/events/." };
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return { value: parsed.toString() };
}
