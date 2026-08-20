-- Sourcing ledger: generic agent/supplier batch tracking
CREATE TABLE IF NOT EXISTS public.sourcing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  agent_name text NOT NULL,
  batch_invoice_id text,
  total_final_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  advance_paid_bdt numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_ref text,
  remaining_due_bdt numeric(14,2) NOT NULL DEFAULT 0,
  final_gross_weight_kg numeric(10,3) NOT NULL DEFAULT 0,
  shipping_method text NOT NULL DEFAULT 'air',
  freight_rate_per_kg numeric(12,2) NOT NULL DEFAULT 750,
  freight_cost_bdt numeric(14,2) NOT NULL DEFAULT 0,
  bd_local_courier_bdt numeric(14,2) NOT NULL DEFAULT 0,
  final_settlement_paid_bdt numeric(14,2) NOT NULL DEFAULT 0,
  final_settlement_ref text,
  batch_status text NOT NULL DEFAULT 'partial_due',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sourcing_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sourcing_admin_select" ON public.sourcing_orders;
CREATE POLICY "sourcing_admin_select" ON public.sourcing_orders
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "sourcing_admin_insert" ON public.sourcing_orders;
CREATE POLICY "sourcing_admin_insert" ON public.sourcing_orders
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "sourcing_admin_update" ON public.sourcing_orders;
CREATE POLICY "sourcing_admin_update" ON public.sourcing_orders
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "sourcing_admin_delete" ON public.sourcing_orders;
CREATE POLICY "sourcing_admin_delete" ON public.sourcing_orders
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- Link inventory rows to a sourcing batch (optional)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS sourcing_order_id uuid REFERENCES public.sourcing_orders(id) ON DELETE SET NULL;
