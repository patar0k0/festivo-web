import { getBaseUrl } from "@/lib/config/baseUrl";

export function absoluteSiteUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
