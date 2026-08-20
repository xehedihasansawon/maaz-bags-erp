/*
# Add variant_sku to sales_orders

1. Modified Tables
- `sales_orders`: added `variant_sku` (text, nullable) to track the specific color variant SKU chosen at order time.
  - Nullable so existing orders are unaffected.
  - No foreign key constraint to bag_variants.sku to avoid breaking inserts when SKU format changes; the app enforces selection.

2. Security
- No RLS policy changes. Existing sales_orders policies already cover the new column.
*/

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS variant_sku text;
