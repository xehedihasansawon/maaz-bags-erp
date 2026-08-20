/*
# MAAZ BAGS ERP — Simplified Costing Model

## Overview
Updates the inventory and bags tables to support the new simplified costing workflow:
- Landed cost = China Buying Cost (BDT) + (Single Bag Weight × Air Freight Rate per KG)
- Removes per-bag packaging/courier/bubble-wrap from the per-unit calculation (those are lump-sum expenses in the Expenses table)
- Adds product colors/variants as a multi-tag field

## Changes
1. `bags` table: add `colors text[]` column for available color variants (e.g., ['Black','Brown','Olive']).
2. `inventory` table: add `single_bag_weight_kg numeric(10,3)` and `air_freight_rate_per_kg numeric(12,2) DEFAULT 750`.
   - Existing columns (total_batch_weight_kg, shipping_cost_per_kg_bdt, local_bd_courier_bdt, packaging_cost_bdt) are kept for data safety but no longer used in the new workflow.

## Security
- No policy changes. Existing RLS policies cover the new columns automatically.

## Important notes
1. No columns dropped — old data preserved.
2. New columns default to 0/750 so existing rows remain valid.
3. Colors stored as a PostgreSQL text array; frontend sends a JS string array.
*/
ALTER TABLE public.bags
  ADD COLUMN IF NOT EXISTS colors text[] DEFAULT '{}';

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS single_bag_weight_kg numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS air_freight_rate_per_kg numeric(12,2) NOT NULL DEFAULT 750;

-- Backfill existing inventory rows with approximate single-bag weight from batch weight / qty
UPDATE public.inventory
SET single_bag_weight_kg = CASE
  WHEN received_qty > 0 THEN ROUND((total_batch_weight_kg / received_qty)::numeric, 3)
  ELSE 0
END
WHERE single_bag_weight_kg = 0 AND total_batch_weight_kg > 0;

-- Backfill air_freight_rate from old shipping_cost_per_kg where available
UPDATE public.inventory
SET air_freight_rate_per_kg = shipping_cost_per_kg_bdt
WHERE air_freight_rate_per_kg = 750 AND shipping_cost_per_kg_bdt > 0;

-- Recalculate landed_cost_per_bag using the new formula for existing rows
UPDATE public.inventory
SET landed_cost_per_bag_bdt = unit_buying_price_bdt + (single_bag_weight_kg * air_freight_rate_per_kg)
WHERE single_bag_weight_kg > 0;
