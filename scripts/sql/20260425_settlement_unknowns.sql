-- Review queue: settlement names the dataset + heuristics could not classify (is_village still null).
-- Inserts are performed by service-role code only when `FESTIVO_SETTLEMENT_UNKNOWNS_LOG=1` and inference returns null; see `lib/settlements/applySettlementTypeInference.ts`.

CREATE TABLE IF NOT EXISTS public.settlement_unknowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS settlement_unknowns_name_lower_idx
  ON public.settlement_unknowns (lower(btrim(name)));

ALTER TABLE public.settlement_unknowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlement_unknowns_insert_service_only" ON public.settlement_unknowns;
CREATE POLICY "settlement_unknowns_insert_service_only"
  ON public.settlement_unknowns
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "settlement_unknowns_admin_select" ON public.settlement_unknowns;
CREATE POLICY "settlement_unknowns_admin_select"
  ON public.settlement_unknowns
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settlement_unknowns TO service_role;
GRANT SELECT ON TABLE public.settlement_unknowns TO authenticated;
