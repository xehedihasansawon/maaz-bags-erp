/*
# MAAZ BAGS ERP — Dummy Sample Data

## Overview
Seeds realistic dummy data for all modules so the app is immediately explorable after signup:
- 4 suppliers (China + BD)
- 8 bags (backpacks, totes, crossbody, duffel, laptop, sling, clutch, weekender)
- 5 supply orders (mix of draft/shipped/in_warehouse)
- 5 inventory rows (landed cost + selling price computed)
- 14 sales orders (spread across couriers + delivery statuses, with COD + settlement)
- 6 expenses (marketing + operational + return charges)

## Important notes
1. Uses fixed UUIDs for bags/suppliers so inventory + sales reference them consistently.
2. landed_cost_per_bag_bdt precomputed using: unit_buy + (weight*ship/kg / qty) + packaging + (courier/qty).
3. sold_qty on inventory left to the trigger to recompute; values here are starting points.
4. Data is safe to re-run: uses ON CONFLICT DO NOTHING for bags/suppliers and deletes nothing.
*/

-- ============================================================
-- Suppliers
-- ============================================================
INSERT INTO public.suppliers (id, name, contact, country) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Guangzhou Leather Co.', '+86 138 0013 8000', 'China'),
  ('a1000000-0000-0000-0000-000000000002', 'Yiwu Bags Trading', '+86 159 8859 2210', 'China'),
  ('a1000000-0000-0000-0000-000000000003', 'Shenzhen Canvas Ltd.', '+86 755 8800 1234', 'China'),
  ('a1000000-0000-0000-0000-000000000004', 'Dhaka Leather Works', '+880 1711 000000', 'Bangladesh')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Bags
-- ============================================================
INSERT INTO public.bags (id, bag_id, name, category, image_url) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'MB-001', 'Urban Explorer Backpack', 'Backpack', NULL),
  ('b1000000-0000-0000-0000-000000000002', 'MB-002', 'Classic Leather Tote', 'Tote', NULL),
  ('b1000000-0000-0000-0000-000000000003', 'MB-003', 'Nomad Crossbody', 'Crossbody', NULL),
  ('b1000000-0000-0000-0000-000000000004', 'MB-004', 'Voyager Duffel Bag', 'Duffel', NULL),
  ('b1000000-0000-0000-0000-000000000005', 'MB-005', 'Executive Laptop Bag', 'Laptop', NULL),
  ('b1000000-0000-0000-0000-000000000006', 'MB-006', 'Street Sling Mini', 'Sling', NULL),
  ('b1000000-0000-0000-0000-000000000007', 'MB-007', 'Evening Clutch Purse', 'Clutch', NULL),
  ('b1000000-0000-0000-0000-000000000008', 'MB-008', 'Weekender Travel Bag', 'Travel', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Supply Orders (Module 1)
-- ============================================================
INSERT INTO public.supply_orders (id, order_date, supplier_id, supplier_name, bag_id, bag_name, quantity_ordered, unit_price, price_currency, exchange_rate_to_bdt, china_domestic_courier_bdt, status) VALUES
  ('c1000000-0000-0000-0000-000000000001', '2026-07-15', 'a1000000-0000-0000-0000-000000000001', 'Guangzhou Leather Co.', 'MB-001', 'Urban Explorer Backpack', 50, 120, 'RMB', 16.50, 450, 'in_warehouse'),
  ('c1000000-0000-0000-0000-000000000002', '2026-07-20', 'a1000000-0000-0000-0000-000000000002', 'Yiwu Bags Trading', 'MB-002', 'Classic Leather Tote', 40, 95, 'RMB', 16.50, 380, 'in_warehouse'),
  ('c1000000-0000-0000-0000-000000000003', '2026-08-01', 'a1000000-0000-0000-0000-000000000003', 'Shenzhen Canvas Ltd.', 'MB-003', 'Nomad Crossbody', 60, 18, 'USD', 117.00, 520, 'shipped'),
  ('c1000000-0000-0000-0000-000000000004', '2026-08-05', 'a1000000-0000-0000-0000-000000000001', 'Guangzhou Leather Co.', 'MB-004', 'Voyager Duffel Bag', 30, 180, 'RMB', 16.50, 600, 'in_warehouse'),
  ('c1000000-0000-0000-0000-000000000005', '2026-08-10', 'a1000000-0000-0000-0000-000000000002', 'Yiwu Bags Trading', 'MB-005', 'Executive Laptop Bag', 45, 140, 'RMB', 16.50, 420, 'draft')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Inventory (Module 2) — landed cost precomputed
-- MB-001: unit_buy=120*16.5=1980; weight 25kg * 220/kg = 5500 / 50 = 110; pkg 40; courier 350/50=7 => 2137
-- MB-002: unit_buy=95*16.5=1567.5; weight 18kg * 220/kg = 3960 / 40 = 99; pkg 35; courier 300/40=7.5 => 1709
-- MB-004: unit_buy=180*16.5=2970; weight 35kg * 240/kg = 8400 / 30 = 280; pkg 60; courier 400/30=13.33 => 3323.33
-- ============================================================
INSERT INTO public.inventory (id, supply_order_id, bag_id, bag_name, received_qty, sold_qty, total_batch_weight_kg, shipping_cost_per_kg_bdt, local_bd_courier_bdt, packaging_cost_bdt, unit_buying_price_bdt, landed_cost_per_bag_bdt, selling_price_bdt) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'MB-001', 'Urban Explorer Backpack', 50, 0, 25.00, 220, 350, 40, 1980.00, 2137.00, 3499.00),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'MB-002', 'Classic Leather Tote', 40, 0, 18.00, 220, 300, 35, 1567.50, 1709.00, 2899.00),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 'MB-004', 'Voyager Duffel Bag', 30, 0, 35.00, 240, 400, 60, 2970.00, 3323.00, 5499.00),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'MB-003', 'Nomad Crossbody', 60, 0, 12.00, 230, 330, 25, 2106.00, 2301.00, 3799.00),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005', 'MB-005', 'Executive Laptop Bag', 45, 0, 20.00, 225, 360, 45, 2310.00, 2465.00, 3999.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Sales Orders (Module 3 + 4)
-- ============================================================
INSERT INTO public.sales_orders (id, order_date, customer_name, phone_number, delivery_address, bag_id, bag_name, quantity, selling_price_bdt, landed_cost_per_bag_bdt, advance_paid_bdt, advance_note, cod_amount_bdt, courier_name, courier_tracking_id, delivery_status, courier_payment_status, courier_delivery_fee_bdt, courier_return_charge_bdt, actual_cash_received_bdt) VALUES
  ('e1000000-0000-0000-0000-000000000001', '2026-08-01', 'Rahim Ahmed', '01711-123456', 'House 12, Road 5, Dhanmondi, Dhaka', 'MB-001', 'Urban Explorer Backpack', 1, 3499.00, 2137.00, 500.00, 'bKash TRX8821', 2999.00, 'Pathao', 'PTH-AX9912', 'delivered', 'received', 80, 0, 2919.00),
  ('e1000000-0000-0000-0000-000000000002', '2026-08-02', 'Sadia Khan', '01822-234567', 'Flat 4B, Gulshan 2, Dhaka', 'MB-002', 'Classic Leather Tote', 1, 2899.00, 1709.00, 0, '', 2899.00, 'Steadfast', 'STF-558210', 'delivered', 'received', 70, 0, 2829.00),
  ('e1000000-0000-0000-0000-000000000003', '2026-08-03', 'Tanvir Hasan', '01911-345678', 'Mirpur 10, Dhaka', 'MB-001', 'Urban Explorer Backpack', 1, 3499.00, 2137.00, 1000.00, 'Nagad TRX5567', 2499.00, 'RedX', 'RDX-77331', 'in_transit', 'pending', 75, 0, 0),
  ('e1000000-0000-0000-0000-000000000004', '2026-08-04', 'Nusrat Jahan', '01700-456789', 'Chittagong Sadar, Chittagong', 'MB-004', 'Voyager Duffel Bag', 1, 5499.00, 3323.00, 1500.00, 'bKash TRX9912', 3999.00, 'Pathao', 'PTH-BC3345', 'delivered', 'received', 120, 0, 3879.00),
  ('e1000000-0000-0000-0000-000000000005', '2026-08-05', 'Imran Kabir', '01622-567890', 'Sylhet Town, Sylhet', 'MB-003', 'Nomad Crossbody', 1, 3799.00, 2301.00, 0, '', 3799.00, 'Paperfly', 'PFL-12098', 'returned', 'received', 90, 120, -120),
  ('e1000000-0000-0000-0000-000000000006', '2026-08-06', 'Farhana Islam', '01511-678901', 'Banani, Dhaka', 'MB-002', 'Classic Leather Tote', 1, 2899.00, 1709.00, 800.00, 'bKash TRX3344', 2099.00, 'Steadfast', 'STF-661203', 'delivered', 'received', 70, 0, 2029.00),
  ('e1000000-0000-0000-0000-000000000007', '2026-08-07', 'Sakib Rahman', '01711-789012', 'Uttara Sector 7, Dhaka', 'MB-005', 'Executive Laptop Bag', 1, 3999.00, 2465.00, 500.00, 'Nagad TRX7788', 3499.00, 'Pathao', 'PTH-DE8821', 'packed', 'pending', 80, 0, 0),
  ('e1000000-0000-0000-0000-000000000008', '2026-08-08', 'Mitu Chowdhury', '01822-890123', 'Khilgaon, Dhaka', 'MB-001', 'Urban Explorer Backpack', 1, 3499.00, 2137.00, 0, '', 3499.00, 'RedX', 'RDX-88442', 'order_placed', 'pending', 75, 0, 0),
  ('e1000000-0000-0000-0000-000000000009', '2026-08-09', 'Jahidul Islam', '01911-901234', 'Comilla Sadar, Comilla', 'MB-004', 'Voyager Duffel Bag', 1, 5499.00, 3323.00, 2000.00, 'bKash TRX1122', 3499.00, 'Steadfast', 'STF-779901', 'delivered', 'received', 120, 0, 3379.00),
  ('e1000000-0000-0000-0000-000000000010', '2026-08-10', 'Rumana Akter', '01700-012345', 'Mohakhali, Dhaka', 'MB-003', 'Nomad Crossbody', 1, 3799.00, 2301.00, 0, '', 3799.00, 'Pathao', 'PTH-EF9933', 'in_transit', 'pending', 90, 0, 0),
  ('e1000000-0000-0000-0000-000000000011', '2026-08-11', 'Nayeem Bhuiyan', '01622-123450', 'Bashundhara R/A, Dhaka', 'MB-002', 'Classic Leather Tote', 1, 2899.00, 1709.00, 2899.00, 'bKash TRX5599', 0.00, 'Paperfly', 'PFL-22110', 'delivered', 'received', 70, 0, -70),
  ('e1000000-0000-0000-0000-000000000012', '2026-08-12', 'Shamima Nasrin', '01511-234501', 'Mohammadpur, Dhaka', 'MB-001', 'Urban Explorer Backpack', 1, 3499.00, 2137.00, 0, '', 3499.00, 'Steadfast', 'STF-881122', 'returned', 'pending', 80, 100, 0),
  ('e1000000-0000-0000-0000-000000000013', '2026-08-13', 'Asif Mahmud', '01711-345012', 'DSCC, Dhaka', 'MB-005', 'Executive Laptop Bag', 1, 3999.00, 2465.00, 1000.00, 'Nagad TRX9933', 2999.00, 'RedX', 'RDX-99553', 'in_transit', 'pending', 80, 0, 0),
  ('e1000000-0000-0000-0000-000000000014', '2026-08-14', 'Lamia Sultana', '01822-450123', 'Rampura, Dhaka', 'MB-004', 'Voyager Duffel Bag', 1, 5499.00, 3323.00, 0, '', 5499.00, 'Pathao', 'PTH-GH4455', 'order_placed', 'pending', 120, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Expenses (Module 5)
-- ============================================================
INSERT INTO public.expenses (id, expense_date, category, description, amount_bdt) VALUES
  ('f1000000-0000-0000-0000-000000000001', '2026-08-01', 'marketing', 'Facebook Ads - August Campaign', 8000.00),
  ('f1000000-0000-0000-0000-000000000002', '2026-08-05', 'marketing', 'Instagram Influencer Promo', 5000.00),
  ('f1000000-0000-0000-0000-000000000003', '2026-08-08', 'operational', 'Warehouse Rent - August', 12000.00),
  ('f1000000-0000-0000-0000-000000000004', '2026-08-10', 'operational', 'Packaging Materials Restock', 3500.00),
  ('f1000000-0000-0000-0000-000000000005', '2026-08-05', 'return_charge', 'Return charge - Sylhet order', 120.00),
  ('f1000000-0000-0000-0000-000000000006', '2026-08-12', 'return_charge', 'Return charge - Mohammadpur order', 100.00)
ON CONFLICT (id) DO NOTHING;
