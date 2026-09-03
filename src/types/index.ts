export type Role = 'admin' | 'staff';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  country: string;
  created_at: string;
}

export interface Bag {
  id: string;
  bag_id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  colors: string[] | null;
  created_at: string;
}

export type SupplyStatus = 'draft' | 'shipped' | 'in_warehouse';
export type PriceCurrency = 'RMB' | 'USD';

export interface SupplyOrder {
  id: string;
  order_date: string;
  supplier_id: string | null;
  supplier_name: string;
  bag_id: string;
  bag_name: string;
  quantity_ordered: number;
  unit_price: number;
  price_currency: PriceCurrency;
  exchange_rate_to_bdt: number;
  china_domestic_courier_bdt: number;
  status: SupplyStatus;
  created_at: string;
  updated_at: string;
}

export type ShippingMethod = 'air' | 'sea';
export type SourcingBatchStatus = 'paid' | 'partial_due' | 'fully_settled';

export interface SourcingOrder {
  id: string;
  order_date: string;
  agent_name: string;
  batch_invoice_id: string | null;
  total_final_price_bdt: number;
  advance_paid_bdt: number;
  advance_payment_ref: string | null;
  remaining_due_bdt: number;
  final_gross_weight_kg: number;
  shipping_method: ShippingMethod;
  freight_rate_per_kg: number;
  freight_cost_bdt: number;
  bd_local_courier_bdt: number;
  final_settlement_paid_bdt: number;
  final_settlement_ref: string | null;
  batch_status: SourcingBatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  supply_order_id: string | null;
  sourcing_order_id: string | null;
  bag_id: string;
  bag_name: string;
  received_qty: number;
  sold_qty: number;
  total_batch_weight_kg: number;
  shipping_cost_per_kg_bdt: number;
  local_bd_courier_bdt: number;
  packaging_cost_bdt: number;
  unit_buying_price_bdt: number;
  landed_cost_per_bag_bdt: number;
  selling_price_bdt: number;
  single_bag_weight_kg: number;
  air_freight_rate_per_kg: number;
  reserved_qty: number;
  damaged_qty: number;
  missing_qty: number;
  china_bd_courier_share_bdt: number;
  packaging_box_cost_bdt: number;
  bubble_wrap_cost_bdt: number;
  sticker_label_cost_bdt: number;
  customer_delivery_courier_bdt: number;
  facebook_ad_cost_bdt: number;
  total_cost_per_bag_bdt: number;
  net_profit_per_bag_bdt: number;
  net_margin_pct: number;
  created_at: string;
  updated_at: string;
}

export interface BagVariant {
  id: string;
  bag_id: string;
  color_name: string;
  sku: string;
  stock_qty: number;
  created_at: string;
}

export type CourierName = 'Pathao' | 'Steadfast' | 'RedX' | 'Paperfly';

// Legacy delivery status (kept for backward compat with old data)
export type DeliveryStatus =
  | 'order_placed'
  | 'packed'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'cancelled';
export type CourierPaymentStatus = 'pending' | 'received';

// New order lifecycle
export type OrderStatus =
  | 'draft'
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'dispatched'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'customer_refused'
  | 'returned'
  | 'lost'
  | 'damaged';

export type PaymentStatus = 'unverified' | 'pending_verification' | 'verified' | 'rejected';

export type ReturnInspectionStatus = 'pending_inspection' | 'restocked' | 'damaged' | 'missing';

export interface SalesOrder {
  id: string;
  order_date: string;
  customer_name: string;
  phone_number: string;
  delivery_address: string;
  bag_id: string;
  bag_name: string;
  quantity: number;
  selling_price_bdt: number;
  landed_cost_per_bag_bdt: number;
  advance_paid_bdt: number;
  advance_note: string | null;
  cod_amount_bdt: number;
  courier_name: CourierName;
  courier_tracking_id: string | null;
  variant_sku: string | null;
  delivery_status: DeliveryStatus;
  courier_payment_status: CourierPaymentStatus;
  courier_delivery_fee_bdt: number;
  courier_return_charge_bdt: number;
  actual_cash_received_bdt: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  return_inspection_status: ReturnInspectionStatus | null;
  settlement_expected_bdt: number;
  settlement_actual_bdt: number;
  settlement_difference_bdt: number;
  settlement_reconciled: boolean;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory = 'marketing' | 'operational' | 'return_charge';

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string | null;
  amount_bdt: number;
  created_at: string;
}

export interface InventoryWithBag extends Inventory {
  available_qty: number;
  low_stock: boolean;
  colors: string[] | null;
}

export interface BagPricingInfo {
  bag_id: string;
  bag_name: string;
  selling_price_bdt: number;
  landed_cost_per_bag_bdt: number;
}

// ---- New production entities ----

export interface OrderStatusHistory {
  id: string;
  sales_order_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface InventoryReservation {
  id: string;
  sales_order_id: string;
  bag_id: string;
  quantity: number;
  released: boolean;
  created_at: string;
  released_at: string | null;
}

export interface PaymentVerification {
  id: string;
  sales_order_id: string;
  amount_bdt: number;
  status: PaymentStatus;
  verification_note: string | null;
  verified_by: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface CustomerRiskOverride {
  id: string;
  phone_number: string;
  overridden_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  overridden_by: string | null;
  created_at: string;
}

export type CourierEventStatus =
  | 'ready'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'customer_refused'
  | 'returned'
  | 'lost'
  | 'damaged';

export interface CourierEvent {
  id: string;
  sales_order_id: string;
  courier_name: string | null;
  tracking_id: string | null;
  event_status: CourierEventStatus;
  event_note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ReturnInspection {
  id: string;
  sales_order_id: string;
  return_reason: string | null;
  product_condition: string | null;
  restock_qty: number;
  damaged_qty: number;
  missing_qty: number;
  notes: string | null;
  inspector_id: string | null;
  created_at: string;
}

export type AccountingPeriodStatus =
  | 'open'
  | 'pending_reconciliation'
  | 'ready_to_close'
  | 'closed'
  | 'allocated';

export interface AccountingPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  delivered_revenue_bdt: number;
  landed_cogs_bdt: number;
  courier_charges_bdt: number;
  cod_fees_bdt: number;
  operating_expenses_bdt: number;
  returns_refunds_bdt: number;
  approved_adjustments_bdt: number;
  courier_settlement_bdt: number;
  net_profit_bdt: number;
  closed_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface Vault {
  id: string;
  name: string;
  allocation_percent: number;
  description: string | null;
  opening_balance_bdt: number;
  current_balance_bdt: number;
  created_at: string;
}

export type VaultTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'adjustment'
  | 'opening_balance'
  | 'closing_balance';

export interface VaultTransaction {
  id: string;
  vault_id: string;
  type: VaultTransactionType;
  amount_bdt: number;
  balance_after_bdt: number;
  transaction_reference: string | null;
  description: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  dividend_percent: number;
  active: boolean;
  created_at: string;
}

export type WithdrawalStatus = 'requested' | 'approved' | 'rejected' | 'paid';

export interface Withdrawal {
  id: string;
  vault_id: string;
  amount_bdt: number;
  reason: string | null;
  status: WithdrawalStatus;
  requested_by: string | null;
  approved_by: string | null;
  payment_reference: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export type DividendStatus = 'calculated' | 'approved' | 'payable' | 'paid';

export interface Dividend {
  id: string;
  partner_id: string;
  accounting_period_id: string | null;
  amount_bdt: number;
  status: DividendStatus;
  approved_by: string | null;
  payment_reference: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export interface CustomerRiskInfo {
  total_orders: number;
  delivered_orders: number;
  returned_orders: number;
  cancelled_orders: number;
  refused_orders: number;
  return_rate: number;
  last_order_date: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VaultAllocation {
  id: string;
  name: string;
  allocation_percent: number;
  amount: number;
}

export interface NetProfitResult {
  revenue: number;
  cogs: number;
  ad_spend: number;
  misc_ops: number;
  return_loss: number;
  courier_charges: number;
  net_profit: number;
}
