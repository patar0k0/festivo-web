/** Grep-friendly structured planner logs (no tokens, emails, or payload dumps). */

export type PlannerLogBase = {
  event:
    | "planner_state_success"
    | "planner_state_partial"
    | "planner_state_failed"
    | "planner_query_failed"
    | "planner_stats_failed";
  authed: boolean;
  /** Elapsed ms since request handler start (when provided). */
  duration_ms?: number;
};

export function logPlannerEvent(payload: Record<string, unknown>) {
  console.info(JSON.stringify(payload));
}
