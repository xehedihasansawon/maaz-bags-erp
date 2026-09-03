/*
# MAAZ BAGS ERP — Production Readiness Schema

## Overview
Adds the full production entity set required by the SRS v2.0 audit:
extended order lifecycle, status history, inventory reservation, payment
verification, fraud/risk, courier events, returns inspection, accounting
periods, profit vaults with ledgers, partners, withdrawals, dividends, and
audit logs.

## New Tables
1. `order_status_history` — every order status change with old/new, reason, user, timestamp.
2. `inventory_reservations` — reserved stock per order (enables no-oversell).
3. `payment_verifications` — advance payment verification workflow.
4. `customer_risk_overrides` — admin override of auto-computed risk level with reason.
5. `courier_events` — separate courier shipment status timeline.
6. `return_inspections` — returned parcel inspection → restock / damaged / missing.
7. `accounting_periods` — OPEN → PENDING_RECONCILIATION → READY_TO_CLOSE → CLOSED → ALLOCATED.
8. `vaults` — three vaults: reinvestment (50%), emergency (30%), dividend (20%).
9. `vault_transactions` — ledger per vault.
10. `partners` — dividend partners with ownership percentages (stored in DB).
11. `withdrawals` — REQUESTED → APPROVED/REJECTED → PAID workflow.
12. `dividends` — CALCULATED → APPROVED → PAYABLE → PAID workflow.
13. `audit_logs` — universal audit trail.

## Modified Tables
- `sales_orders`: added order_status, payment_status, return_inspection_status, settlement fields.
- `inventory`: added reserved_qty, damaged_qty, missing_qty.

## Security
- RLS on every new table. Admin-only for financial tables.
- Staff can read operational tables (courier_events, return_inspections, reservations).
- DB functions (SECURITY DEFINER) for all financial calculations.

## Important Notes
1. No existing columns dropped or renamed.
2. Partners seeded: Md. Mehedi Hasan Sawon (50%), Uzzal Hossain (50%).
3. Vaults seeded with three vaults and 0 opening balance.
4. Triggers auto-create/release reservations and record status history.
*/

-- ============================================================
-- 1. order_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osh_select_all" ON public.order_status_history;
CREATE POLICY "osh_select_all" ON public.order_status_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "osh_insert_all" ON public.order_status_history;
CREATE POLICY "osh_insert_all" ON public.order_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "osh_admin_update" ON public.order_status_history;
CREATE POLICY "osh_admin_update" ON public.order_status_history
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "osh_admin_delete" ON public.order_status_history;
CREATE POLICY "osh_admin_delete" ON public.order_status_history
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_osh_order ON public.order_status_history(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_osh_created ON public.order_status_history(created_at);

-- ============================================================
-- 2. Extend sales_orders
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='order_status') THEN
    ALTER TABLE public.sales_orders ADD COLUMN order_status text NOT NULL DEFAULT 'draft'
      CHECK (order_status IN ('draft','pending_confirmation','confirmed','processing','ready_to_ship','dispatched','in_transit','out_for_delivery','delivered','cancelled','customer_refused','returned','lost','damaged'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='payment_status') THEN
    ALTER TABLE public.sales_orders ADD COLUMN payment_status text NOT NULL DEFAULT 'unverified'
      CHECK (payment_status IN ('unverified','pending_verification','verified','rejected'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='return_inspection_status') THEN
    ALTER TABLE public.sales_orders ADD COLUMN return_inspection_status text DEFAULT NULL
      CHECK (return_inspection_status IS NULL OR return_inspection_status IN ('pending_inspection','restocked','damaged','missing'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='settlement_expected_bdt') THEN
    ALTER TABLE public.sales_orders ADD COLUMN settlement_expected_bdt numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='settlement_actual_bdt') THEN
    ALTER TABLE public.sales_orders ADD COLUMN settlement_actual_bdt numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='settlement_difference_bdt') THEN
    ALTER TABLE public.sales_orders ADD COLUMN settlement_difference_bdt numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_orders' AND column_name='settlement_reconciled') THEN
    ALTER TABLE public.sales_orders ADD COLUMN settlement_reconciled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill order_status from delivery_status
UPDATE public.sales_orders
SET order_status = CASE
  WHEN delivery_status = 'order_placed' THEN 'pending_confirmation'
  WHEN delivery_status = 'packed' THEN 'processing'
  WHEN delivery_status = 'in_transit' THEN 'in_transit'
  WHEN delivery_status = 'delivered' THEN 'delivered'
  WHEN delivery_status = 'returned' THEN 'returned'
  WHEN delivery_status = 'cancelled' THEN 'cancelled'
  ELSE 'draft'
END
WHERE order_status = 'draft' AND delivery_status IS NOT NULL;

-- ============================================================
-- 3. Extend inventory
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='reserved_qty') THEN
    ALTER TABLE public.inventory ADD COLUMN reserved_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='damaged_qty') THEN
    ALTER TABLE public.inventory ADD COLUMN damaged_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='missing_qty') THEN
    ALTER TABLE public.inventory ADD COLUMN missing_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 4. inventory_reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  bag_id text NOT NULL,
  quantity integer NOT NULL,
  released boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ir_select_all" ON public.inventory_reservations;
CREATE POLICY "ir_select_all" ON public.inventory_reservations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ir_insert_all" ON public.inventory_reservations;
CREATE POLICY "ir_insert_all" ON public.inventory_reservations
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ir_update_all" ON public.inventory_reservations;
CREATE POLICY "ir_update_all" ON public.inventory_reservations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ir_admin_delete" ON public.inventory_reservations;
CREATE POLICY "ir_admin_delete" ON public.inventory_reservations
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_ir_order ON public.inventory_reservations(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_ir_bag ON public.inventory_reservations(bag_id);

-- ============================================================
-- 5. payment_verifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  amount_bdt numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('unverified','pending_verification','verified','rejected')),
  verification_note text,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_admin_select" ON public.payment_verifications;
CREATE POLICY "pv_admin_select" ON public.payment_verifications
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "pv_admin_insert" ON public.payment_verifications;
CREATE POLICY "pv_admin_insert" ON public.payment_verifications
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "pv_admin_update" ON public.payment_verifications;
CREATE POLICY "pv_admin_update" ON public.payment_verifications
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "pv_admin_delete" ON public.payment_verifications;
CREATE POLICY "pv_admin_delete" ON public.payment_verifications
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_pv_order ON public.payment_verifications(sales_order_id);

-- ============================================================
-- 6. customer_risk_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_risk_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  overridden_risk_level text NOT NULL CHECK (overridden_risk_level IN ('LOW','MEDIUM','HIGH')),
  reason text NOT NULL,
  overridden_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_risk_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cro_select_all" ON public.customer_risk_overrides;
CREATE POLICY "cro_select_all" ON public.customer_risk_overrides
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cro_admin_insert" ON public.customer_risk_overrides;
CREATE POLICY "cro_admin_insert" ON public.customer_risk_overrides
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "cro_admin_update" ON public.customer_risk_overrides;
CREATE POLICY "cro_admin_update" ON public.customer_risk_overrides
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "cro_admin_delete" ON public.customer_risk_overrides;
CREATE POLICY "cro_admin_delete" ON public.customer_risk_overrides
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_cro_phone ON public.customer_risk_overrides(phone_number);

-- ============================================================
-- 7. courier_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  courier_name text,
  tracking_id text,
  event_status text NOT NULL CHECK (event_status IN ('ready','picked_up','in_transit','out_for_delivery','delivered','customer_refused','returned','lost','damaged')),
  event_note text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ce_select_all" ON public.courier_events;
CREATE POLICY "ce_select_all" ON public.courier_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ce_insert_all" ON public.courier_events;
CREATE POLICY "ce_insert_all" ON public.courier_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ce_admin_update" ON public.courier_events;
CREATE POLICY "ce_admin_update" ON public.courier_events
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "ce_admin_delete" ON public.courier_events;
CREATE POLICY "ce_admin_delete" ON public.courier_events
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_ce_order ON public.courier_events(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_ce_created ON public.courier_events(created_at);

-- ============================================================
-- 8. return_inspections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.return_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  return_reason text,
  product_condition text,
  restock_qty integer NOT NULL DEFAULT 0,
  damaged_qty integer NOT NULL DEFAULT 0,
  missing_qty integer NOT NULL DEFAULT 0,
  notes text,
  inspector_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.return_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ri_select_all" ON public.return_inspections;
CREATE POLICY "ri_select_all" ON public.return_inspections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ri_insert_all" ON public.return_inspections;
CREATE POLICY "ri_insert_all" ON public.return_inspections
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ri_admin_update" ON public.return_inspections;
CREATE POLICY "ri_admin_update" ON public.return_inspections
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "ri_admin_delete" ON public.return_inspections;
CREATE POLICY "ri_admin_delete" ON public.return_inspections
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_ri_order ON public.return_inspections(sales_order_id);

-- ============================================================
-- 9. accounting_periods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','pending_reconciliation','ready_to_close','closed','allocated')),
  delivered_revenue_bdt numeric(14,2) NOT NULL DEFAULT 0,
  landed_cogs_bdt numeric(14,2) NOT NULL DEFAULT 0,
  courier_charges_bdt numeric(14,2) NOT NULL DEFAULT 0,
  cod_fees_bdt numeric(14,2) NOT NULL DEFAULT 0,
  operating_expenses_bdt numeric(14,2) NOT NULL DEFAULT 0,
  returns_refunds_bdt numeric(14,2) NOT NULL DEFAULT 0,
  approved_adjustments_bdt numeric(14,2) NOT NULL DEFAULT 0,
  courier_settlement_bdt numeric(14,2) NOT NULL DEFAULT 0,
  net_profit_bdt numeric(14,2) NOT NULL DEFAULT 0,
  closed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_admin_select" ON public.accounting_periods;
CREATE POLICY "ap_admin_select" ON public.accounting_periods
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "ap_admin_insert" ON public.accounting_periods;
CREATE POLICY "ap_admin_insert" ON public.accounting_periods
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "ap_admin_update" ON public.accounting_periods;
CREATE POLICY "ap_admin_update" ON public.accounting_periods
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "ap_admin_delete" ON public.accounting_periods;
CREATE POLICY "ap_admin_delete" ON public.accounting_periods
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_ap_status ON public.accounting_periods(status);
CREATE INDEX IF NOT EXISTS idx_ap_dates ON public.accounting_periods(start_date, end_date);

-- ============================================================
-- 10. vaults
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  allocation_percent numeric(5,2) NOT NULL,
  description text,
  opening_balance_bdt numeric(14,2) NOT NULL DEFAULT 0,
  current_balance_bdt numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vaults_admin_select" ON public.vaults;
CREATE POLICY "vaults_admin_select" ON public.vaults
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "vaults_admin_insert" ON public.vaults;
CREATE POLICY "vaults_admin_insert" ON public.vaults
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "vaults_admin_update" ON public.vaults;
CREATE POLICY "vaults_admin_update" ON public.vaults
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "vaults_admin_delete" ON public.vaults;
CREATE POLICY "vaults_admin_delete" ON public.vaults
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

INSERT INTO public.vaults (name, allocation_percent, description)
VALUES
  ('Reinvestment Vault', 50.00, '50% — For purchasing new bag stock and business growth'),
  ('Emergency & Operational Vault', 30.00, '30% — Operational safety, backup, and emergency fund'),
  ('Partner Dividend Fund', 20.00, '20% — Dividend distributions to partners')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. vault_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vault_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','adjustment','opening_balance','closing_balance')),
  amount_bdt numeric(14,2) NOT NULL,
  balance_after_bdt numeric(14,2) NOT NULL DEFAULT 0,
  transaction_reference text,
  description text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_admin_select" ON public.vault_transactions;
CREATE POLICY "vt_admin_select" ON public.vault_transactions
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "vt_admin_insert" ON public.vault_transactions;
CREATE POLICY "vt_admin_insert" ON public.vault_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "vt_admin_update" ON public.vault_transactions;
CREATE POLICY "vt_admin_update" ON public.vault_transactions
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "vt_admin_delete" ON public.vault_transactions;
CREATE POLICY "vt_admin_delete" ON public.vault_transactions
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_vt_vault ON public.vault_transactions(vault_id);
CREATE INDEX IF NOT EXISTS idx_vt_created ON public.vault_transactions(created_at);

-- ============================================================
-- 12. partners
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dividend_percent numeric(5,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_admin_select" ON public.partners;
CREATE POLICY "partners_admin_select" ON public.partners
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "partners_admin_insert" ON public.partners;
CREATE POLICY "partners_admin_insert" ON public.partners
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "partners_admin_update" ON public.partners;
CREATE POLICY "partners_admin_update" ON public.partners
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "partners_admin_delete" ON public.partners;
CREATE POLICY "partners_admin_delete" ON public.partners
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

INSERT INTO public.partners (name, dividend_percent)
VALUES
  ('Md. Mehedi Hasan Sawon', 50.00),
  ('Uzzal Hossain', 50.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. withdrawals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  amount_bdt numeric(14,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','paid')),
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  payment_reference text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wd_admin_select" ON public.withdrawals;
CREATE POLICY "wd_admin_select" ON public.withdrawals
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "wd_admin_insert" ON public.withdrawals;
CREATE POLICY "wd_admin_insert" ON public.withdrawals
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "wd_admin_update" ON public.withdrawals;
CREATE POLICY "wd_admin_update" ON public.withdrawals
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "wd_admin_delete" ON public.withdrawals;
CREATE POLICY "wd_admin_delete" ON public.withdrawals
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_wd_vault ON public.withdrawals(vault_id);
CREATE INDEX IF NOT EXISTS idx_wd_status ON public.withdrawals(status);

-- ============================================================
-- 14. dividends
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  accounting_period_id uuid REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
  amount_bdt numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'calculated'
    CHECK (status IN ('calculated','approved','payable','paid')),
  approved_by uuid REFERENCES auth.users(id),
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "div_admin_select" ON public.dividends;
CREATE POLICY "div_admin_select" ON public.dividends
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "div_admin_insert" ON public.dividends;
CREATE POLICY "div_admin_insert" ON public.dividends
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "div_admin_update" ON public.dividends;
CREATE POLICY "div_admin_update" ON public.dividends
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "div_admin_delete" ON public.dividends;
CREATE POLICY "div_admin_delete" ON public.dividends
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_div_partner ON public.dividends(partner_id);
CREATE INDEX IF NOT EXISTS idx_div_status ON public.dividends(status);

-- ============================================================
-- 15. audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "al_admin_select" ON public.audit_logs;
CREATE POLICY "al_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "al_insert_all" ON public.audit_logs;
CREATE POLICY "al_insert_all" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "al_admin_delete" ON public.audit_logs;
CREATE POLICY "al_admin_delete" ON public.audit_logs
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

CREATE INDEX IF NOT EXISTS idx_al_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_al_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_al_created ON public.audit_logs(created_at);

-- ============================================================
-- 16. DB Function: calculate_customer_risk(phone)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_customer_risk(p_phone text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'delivered') AS delivered_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'returned') AS returned_orders,
      COUNT(*) FILTER (WHERE delivery_status = 'cancelled') AS cancelled_orders,
      COUNT(*) FILTER (WHERE order_status = 'customer_refused' OR delivery_status = 'returned') AS refused_orders,
      MAX(order_date) AS last_order_date
    FROM public.sales_orders
    WHERE phone_number = p_phone
  ),
  risk AS (
    SELECT
      CASE
        WHEN total_orders = 0 THEN 'LOW'
        WHEN total_orders < 3 THEN 'LOW'
        ELSE
          CASE
            WHEN (refused_orders::numeric / total_orders) > 0.4 THEN 'HIGH'
            WHEN (refused_orders::numeric / total_orders) > 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
          END
      END AS risk_level
    FROM stats
  )
  SELECT json_build_object(
    'total_orders', stats.total_orders,
    'delivered_orders', stats.delivered_orders,
    'returned_orders', stats.returned_orders,
    'cancelled_orders', stats.cancelled_orders,
    'refused_orders', stats.refused_orders,
    'return_rate', CASE WHEN stats.total_orders > 0 THEN ROUND((stats.refused_orders::numeric / stats.total_orders) * 100, 1) ELSE 0 END,
    'last_order_date', stats.last_order_date,
    'risk_level', risk.risk_level
  )
  FROM stats, risk;
$$;

-- ============================================================
-- 17. DB Function: get_available_stock(bag_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_stock(p_bag_id text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT received_qty - sold_qty - reserved_qty - damaged_qty - missing_qty
    FROM public.inventory
    WHERE bag_id = p_bag_id
    ORDER BY created_at DESC
    LIMIT 1
  ), 0);
$$;

-- ============================================================
-- 18. DB Function: calculate_vault_allocation(net_profit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_vault_allocation(p_net_profit numeric)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'vaults', COALESCE(
      (SELECT json_agg(json_build_object(
        'id', id,
        'name', name,
        'allocation_percent', allocation_percent,
        'amount', ROUND(p_net_profit * allocation_percent / 100, 2)
      )) FROM public.vaults),
      '[]'::json
    )
  );
$$;

-- ============================================================
-- 19. DB Function: calculate_net_profit(start_date, end_date)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_net_profit(p_start date, p_end date)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH delivered AS (
    SELECT COALESCE(SUM(selling_price_bdt * quantity), 0) AS revenue,
           COALESCE(SUM(landed_cost_per_bag_bdt * quantity), 0) AS cogs
    FROM public.sales_orders
    WHERE delivery_status = 'delivered'
      AND order_date >= p_start AND order_date <= p_end
  ),
  exp AS (
    SELECT
      COALESCE(SUM(amount_bdt) FILTER (WHERE category = 'marketing'), 0) AS ad_spend,
      COALESCE(SUM(amount_bdt) FILTER (WHERE category = 'operational'), 0) AS misc_ops,
      COALESCE(SUM(amount_bdt) FILTER (WHERE category = 'return_charge'), 0) AS return_loss
    FROM public.expenses
    WHERE expense_date >= p_start AND expense_date <= p_end
  ),
  courier AS (
    SELECT COALESCE(SUM(courier_delivery_fee_bdt + courier_return_charge_bdt), 0) AS courier_charges
    FROM public.sales_orders
    WHERE delivery_status IN ('delivered','returned')
      AND order_date >= p_start AND order_date <= p_end
  )
  SELECT json_build_object(
    'revenue', delivered.revenue,
    'cogs', delivered.cogs,
    'ad_spend', exp.ad_spend,
    'misc_ops', exp.misc_ops,
    'return_loss', exp.return_loss,
    'courier_charges', courier.courier_charges,
    'net_profit', delivered.revenue - delivered.cogs - exp.ad_spend - exp.misc_ops - exp.return_loss - courier.courier_charges
  )
  FROM delivered, exp, courier;
$$;

-- ============================================================
-- 20. Trigger: auto-create reservation + status history on order insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_order_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory_reservations (sales_order_id, bag_id, quantity)
  VALUES (NEW.id, NEW.bag_id, NEW.quantity);

  UPDATE public.inventory
  SET reserved_qty = reserved_qty + NEW.quantity,
      updated_at = now()
  WHERE bag_id = NEW.bag_id;

  INSERT INTO public.order_status_history (sales_order_id, new_status, changed_by)
  VALUES (NEW.id, NEW.order_status, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_orders_reservation_ins ON public.sales_orders;
CREATE TRIGGER sales_orders_reservation_ins
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_reservation();

-- ============================================================
-- 21. Trigger: release reservation + status history on order update
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.order_status IS DISTINCT FROM NEW.order_status THEN
    INSERT INTO public.order_status_history (sales_order_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.order_status, NEW.order_status, auth.uid());
  END IF;

  IF NEW.order_status IN ('cancelled','customer_refused','returned','lost','damaged') AND OLD.order_status NOT IN ('cancelled','customer_refused','returned','lost','damaged') THEN
    UPDATE public.inventory_reservations
    SET released = true, released_at = now()
    WHERE sales_order_id = NEW.id AND released = false;

    UPDATE public.inventory
    SET reserved_qty = GREATEST(0, reserved_qty - NEW.quantity),
        updated_at = now()
    WHERE bag_id = NEW.bag_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_orders_status_upd ON public.sales_orders;
CREATE TRIGGER sales_orders_status_upd
  AFTER UPDATE OF order_status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_change();

-- ============================================================
-- 22. Trigger: release reservation on order delete
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_order_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory
  SET reserved_qty = GREATEST(0, reserved_qty - OLD.quantity),
      updated_at = now()
  WHERE bag_id = OLD.bag_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sales_orders_reservation_del ON public.sales_orders;
CREATE TRIGGER sales_orders_reservation_del
  BEFORE DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_deletion();

-- ============================================================
-- 23. Updated sold_qty trigger (only counts delivered)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_inventory_sold_qty_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_bag text;
BEGIN
  target_bag := COALESCE(NEW.bag_id, OLD.bag_id);
  IF target_bag IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.inventory
  SET sold_qty = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.sales_orders
    WHERE bag_id = inventory.bag_id
      AND delivery_status = 'delivered'
  ),
  updated_at = now()
  WHERE bag_id = target_bag;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sales_orders_sold_qty_ins ON public.sales_orders;
DROP TRIGGER IF EXISTS sales_orders_sold_qty_upd ON public.sales_orders;
DROP TRIGGER IF EXISTS sales_orders_sold_qty_del ON public.sales_orders;

CREATE TRIGGER sales_orders_sold_qty_ins
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty_v2();

CREATE TRIGGER sales_orders_sold_qty_upd
  AFTER UPDATE OF bag_id, quantity, delivery_status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty_v2();

CREATE TRIGGER sales_orders_sold_qty_del
  AFTER DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty_v2();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_status ON public.sales_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_payment_status ON public.sales_orders(payment_status);
