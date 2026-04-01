/**
 * PostgREST filter fragments for `/festivals?tag=` — `festivals.tags` is **text[]**, not jsonb.
 * `tags.cs.` must use a Postgres array literal `{elem,...}`; JSON `["elem"]` is invalid and errors at runtime.
 *
 * @see https://postgrest.org/en/stable/references/api/tables_views.html#operators
 */

/** Scalar `eq` value: quote when needed for PostgREST. */
export function postgrestEqText(value: string): string {
  if (/^[a-zA-Z0-9_.-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '""')}"`;
}

/**
 * Right-hand side for `tags=cs....` on a **text[]** column: `{a}`, or `{"a b"}` for spaces / non-ASCII.
 */
export function postgrestTextArrayContainsLiteral(tag: string): string {
  if (/^[a-zA-Z0-9_.-]+$/.test(tag)) {
    return `{${tag}}`;
  }
  return `{"${tag.replace(/\\/g, "\\\\").replace(/"/g, '""')}"}`;
}

/** Argument to supabase `.or(...)`: category match OR tags array contains this string. */
export function buildFestivalsTagOrFilter(tag: string): string {
  return `category.eq.${postgrestEqText(tag)},tags.cs.${postgrestTextArrayContainsLiteral(tag)}`;
}
