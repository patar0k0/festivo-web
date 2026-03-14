import type { ResearchConfidenceLevel } from "@/lib/admin/research/types";

export function mapConfidenceToVerificationScore(level: ResearchConfidenceLevel): number {
  if (level === "high") return 90;
  if (level === "medium") return 60;
  return 30;
}
