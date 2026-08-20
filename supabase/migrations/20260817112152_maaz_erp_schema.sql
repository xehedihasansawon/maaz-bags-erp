/*
# MAAZ BAGS ERP — Core Schema

## Overview
Schema for an internal E-Commerce ERP & Order Management app for "MAAZ BAGS". Role-based auth (Admin vs Staff) via Supabase Auth, five interconnected modules (Supply, Costing/Inventory, Sales, Delivery, Analytics).

## Tables
1. `profiles` — extends auth.users with role (admin/staff) + display name.
2. `suppliers` — supplier directory.
3. `bags` — product master.
4. `supply_orders` — Module 1: inbound purchase orders + landing-cost fields.
5. `inventory` — Module 2: landed cost, selling price, live stock (received - sold).
6. `sales_orders` — Module 3 + 4: sales entries + delivery/courier settlement.
7. `expenses` — Module 5: marketing/operational/return expenses.

## Role-based access
- Admin: full CRUD everywhere.
- Staff: read bags/suppliers; INSERT/UPDATE sales_orders. Cannot read supply_orders, inventory, expenses (cost/profit hidden); cannot delete sales.
- `is_current_user_admin()` SECURITY DEFINER function enforces role server-side.

## Security
- RLS on every table. All policies TO authenticated (app requires sign-in).
- profiles.role defaults to 'staff'; first user promoted to admin in seed migration.
- inventory.sold_qty kept in sync with sales via triggers.
*/

-- ============================================================
-- profiles table (no policies yet — function must exist first)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Team Member',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Helper: is_current_user_admin() — needed by policies below
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Now enable RLS and add profile policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

-- Auto-create profile on signup, default role staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Team Member'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  country text NOT NULL DEFAULT 'China',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_all" ON public.suppliers;
CREATE POLICY "suppliers_select_all" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "suppliers_admin_write" ON public.suppliers;
CREATE POLICY "suppliers_admin_write" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "suppliers_admin_update" ON public.suppliers;
CREATE POLICY "suppliers_admin_update" ON public.suppliers
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "suppliers_admin_delete" ON public.suppliers;
CREATE POLICY "suppliers_admin_delete" ON public.suppliers
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- bags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id text UNIQUE NOT NULL,
  name text NOT NULL,
  category text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bags_select_all" ON public.bags;
CREATE POLICY "bags_select_all" ON public.bags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bags_admin_insert" ON public.bags;
CREATE POLICY "bags_admin_insert" ON public.bags
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "bags_admin_update" ON public.bags;
CREATE POLICY "bags_admin_update" ON public.bags
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "bags_admin_delete" ON public.bags;
CREATE POLICY "bags_admin_delete" ON public.bags
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- supply_orders (Module 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supply_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  bag_id text NOT NULL,
  bag_name text NOT NULL,
  quantity_ordered integer NOT NULL DEFAULT 0,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  price_currency text NOT NULL DEFAULT 'RMB' CHECK (price_currency IN ('RMB','USD')),
  exchange_rate_to_bdt numeric(10,4) NOT NULL DEFAULT 1,
  china_domestic_courier_bdt numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shipped','in_warehouse')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supply_orders_admin_select" ON public.supply_orders;
CREATE POLICY "supply_orders_admin_select" ON public.supply_orders
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "supply_orders_admin_insert" ON public.supply_orders;
CREATE POLICY "supply_orders_admin_insert" ON public.supply_orders
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "supply_orders_admin_update" ON public.supply_orders;
CREATE POLICY "supply_orders_admin_update" ON public.supply_orders
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "supply_orders_admin_delete" ON public.supply_orders;
CREATE POLICY "supply_orders_admin_delete" ON public.supply_orders
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- inventory (Module 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_order_id uuid REFERENCES public.supply_orders(id) ON DELETE SET NULL,
  bag_id text NOT NULL,
  bag_name text NOT NULL,
  received_qty integer NOT NULL DEFAULT 0,
  sold_qty integer NOT NULL DEFAULT 0,
  total_batch_weight_kg numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost_per_kg_bdt numeric(12,2) NOT NULL DEFAULT 0,
  local_bd_courier_bdt numeric(12,2) NOT NULL DEFAULT 0,
  packaging_cost_bdt numeric(12,2) NOT NULL DEFAULT 0,
  unit_buying_price_bdt numeric(12,2) NOT NULL DEFAULT 0,
  landed_cost_per_bag_bdt numeric(12,2) NOT NULL DEFAULT 0,
  selling_price_bdt numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_admin_select" ON public.inventory;
CREATE POLICY "inventory_admin_select" ON public.inventory
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "inventory_admin_insert" ON public.inventory;
CREATE POLICY "inventory_admin_insert" ON public.inventory
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "inventory_admin_update" ON public.inventory;
CREATE POLICY "inventory_admin_update" ON public.inventory
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "inventory_admin_delete" ON public.inventory;
CREATE POLICY "inventory_admin_delete" ON public.inventory
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- sales_orders (Module 3 + Module 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text NOT NULL,
  phone_number text NOT NULL,
  delivery_address text NOT NULL,
  bag_id text NOT NULL,
  bag_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  selling_price_bdt numeric(12,2) NOT NULL DEFAULT 0,
  landed_cost_per_bag_bdt numeric(12,2) NOT NULL DEFAULT 0,
  advance_paid_bdt numeric(12,2) NOT NULL DEFAULT 0,
  advance_note text,
  cod_amount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  courier_name text NOT NULL DEFAULT 'Pathao' CHECK (courier_name IN ('Pathao','Steadfast','RedX','Paperfly')),
  courier_tracking_id text,
  delivery_status text NOT NULL DEFAULT 'order_placed' CHECK (delivery_status IN ('order_placed','packed','in_transit','delivered','returned','cancelled')),
  courier_payment_status text NOT NULL DEFAULT 'pending' CHECK (courier_payment_status IN ('pending','received')),
  courier_delivery_fee_bdt numeric(12,2) NOT NULL DEFAULT 0,
  courier_return_charge_bdt numeric(12,2) NOT NULL DEFAULT 0,
  actual_cash_received_bdt numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_orders_select_all" ON public.sales_orders;
CREATE POLICY "sales_orders_select_all" ON public.sales_orders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sales_orders_insert_all" ON public.sales_orders;
CREATE POLICY "sales_orders_insert_all" ON public.sales_orders
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sales_orders_update_all" ON public.sales_orders;
CREATE POLICY "sales_orders_update_all" ON public.sales_orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sales_orders_admin_delete" ON public.sales_orders;
CREATE POLICY "sales_orders_admin_delete" ON public.sales_orders
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- expenses (Module 5)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'marketing' CHECK (category IN ('marketing','operational','return_charge')),
  description text,
  amount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_admin_select" ON public.expenses;
CREATE POLICY "expenses_admin_select" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "expenses_admin_insert" ON public.expenses;
CREATE POLICY "expenses_admin_insert" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "expenses_admin_update" ON public.expenses;
CREATE POLICY "expenses_admin_update" ON public.expenses
  FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "expenses_admin_delete" ON public.expenses;
CREATE POLICY "expenses_admin_delete" ON public.expenses
  FOR DELETE TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- Trigger: keep inventory.sold_qty in sync with sales
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_inventory_sold_qty()
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
      AND delivery_status NOT IN ('cancelled')
  ),
  updated_at = now()
  WHERE bag_id = target_bag;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sales_orders_sold_qty_ins ON public.sales_orders;
CREATE TRIGGER sales_orders_sold_qty_ins
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty();

DROP TRIGGER IF EXISTS sales_orders_sold_qty_upd ON public.sales_orders;
CREATE TRIGGER sales_orders_sold_qty_upd
  AFTER UPDATE OF bag_id, quantity, delivery_status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty();

DROP TRIGGER IF EXISTS sales_orders_sold_qty_del ON public.sales_orders;
CREATE TRIGGER sales_orders_sold_qty_del
  AFTER DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_inventory_sold_qty();

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_orders_touch ON public.supply_orders;
CREATE TRIGGER supply_orders_touch BEFORE UPDATE ON public.supply_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS inventory_touch ON public.inventory;
CREATE TRIGGER inventory_touch BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS sales_orders_touch ON public.sales_orders;
CREATE TRIGGER sales_orders_touch BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supply_orders_status ON public.supply_orders(status);
CREATE INDEX IF NOT EXISTS idx_supply_orders_bag_id ON public.supply_orders(bag_id);
CREATE INDEX IF NOT EXISTS idx_inventory_bag_id ON public.inventory(bag_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_phone ON public.sales_orders(phone_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tracking ON public.sales_orders(courier_tracking_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_courier ON public.sales_orders(courier_name);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON public.sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
