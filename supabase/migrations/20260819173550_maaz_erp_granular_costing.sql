-- Granular per-bag costing columns on inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS china_bd_courier_share_bdt numeric(12,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS packaging_box_cost_bdt numeric(12,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS bubble_wrap_cost_bdt numeric(12,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sticker_label_cost_bdt numeric(12,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS customer_delivery_courier_bdt numeric(12,2) NOT NULL DEFAULT 170,
  ADD COLUMN IF NOT EXISTS facebook_ad_cost_bdt numeric(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS total_cost_per_bag_bdt numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit_per_bag_bdt numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_margin_pct numeric(8,2) NOT NULL DEFAULT 0;

-- Color-variant stock with auto SKU
CREATE TABLE IF NOT EXISTS public.bag_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id text NOT NULL,
  color_name text NOT NULL,
  sku text NOT NULL,
  stock_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bag_id, color_name),
  UNIQUE (sku)
);

ALTER TABLE public.bag_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bag_variants_select" ON public.bag_variants;
CREATE POLICY "bag_variants_select" ON public.bag_variants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bag_variants_insert" ON public.bag_variants;
CREATE POLICY "bag_variants_insert" ON public.bag_variants
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "bag_variants_update" ON public.bag_variants;
CREATE POLICY "bag_variants_update" ON public.bag_variants
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "bag_variants_delete" ON public.bag_variants;
CREATE POLICY "bag_variants_delete" ON public.bag_variants
  FOR DELETE TO authenticated USING (public.is_current_user_admin());
