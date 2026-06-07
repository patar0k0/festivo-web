// lib/admin/discovery/config.ts
// Shared defaults + validation for the discovery_config singleton.

export type DiscoveryConfig = {
  score_threshold: number;
  max_sources_per_run: number;
  max_links_per_source: number;
  max_jobs_per_run: number;
  fetch_timeout_ms: number;
  soft_disable_approval_floor: number;
  soft_disable_min_enqueued: number;
  recovery_every: number;
  cron_enabled: boolean;
};

export const DISCOVERY_CONFIG_DEFAULTS: DiscoveryConfig = {
  score_threshold: 65,
  max_sources_per_run: 10,
  max_links_per_source: 40,
  max_jobs_per_run: 30,
  fetch_timeout_ms: 12000,
  soft_disable_approval_floor: 0.05,
  soft_disable_min_enqueued: 30,
  recovery_every: 5,
  cron_enabled: true,
};

type ValidationResult =
  | { ok: true; value: Partial<DiscoveryConfig> }
  | { ok: false; error: string };

function intField(v: unknown, name: string, { min, max }: { min: number; max: number }): number | string {
  if (typeof v !== "number" || !Number.isInteger(v)) return `${name} must be an integer`;
  if (v < min || v > max) return `${name} must be between ${min} and ${max}`;
  return v;
}

// Validates a PATCH body (all fields optional). Returns only provided fields.
export function validateDiscoveryConfigPatch(body: Record<string, unknown>): ValidationResult {
  const out: Partial<DiscoveryConfig> = {};

  const intChecks: Array<[keyof DiscoveryConfig, { min: number; max: number }]> = [
    ["score_threshold", { min: 0, max: 200 }],
    ["max_sources_per_run", { min: 1, max: 500 }],
    ["max_links_per_source", { min: 1, max: 500 }],
    ["max_jobs_per_run", { min: 1, max: 500 }],
    ["fetch_timeout_ms", { min: 1000, max: 60000 }],
    ["soft_disable_min_enqueued", { min: 0, max: 100000 }],
    ["recovery_every", { min: 2, max: 1000 }],
  ];

  for (const [key, range] of intChecks) {
    if (body[key] === undefined) continue;
    const r = intField(body[key], key, range);
    if (typeof r === "string") return { ok: false, error: r };
    (out[key] as number) = r;
  }

  if (body.soft_disable_approval_floor !== undefined) {
    const v = body.soft_disable_approval_floor;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return { ok: false, error: "soft_disable_approval_floor must be between 0 and 1" };
    }
    out.soft_disable_approval_floor = v;
  }

  if (body.cron_enabled !== undefined) {
    if (typeof body.cron_enabled !== "boolean") {
      return { ok: false, error: "cron_enabled must be a boolean" };
    }
    out.cron_enabled = body.cron_enabled;
  }

  if (Object.keys(out).length === 0) return { ok: false, error: "no valid fields to update" };
  return { ok: true, value: out };
}
