import {
  DeliveryStatus, SupplyStatus, CourierPaymentStatus,
  OrderStatus, PaymentStatus, CourierEventStatus,
} from '@/types';

// Legacy delivery status (kept for backward compat with old data)
export const deliveryStatusMeta: Record<
  DeliveryStatus,
  { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }
> = {
  order_placed: { label: 'Order Placed', color: 'yellow' },
  packed: { label: 'Packed', color: 'purple' },
  in_transit: { label: 'In Transit', color: 'blue' },
  delivered: { label: 'Delivered', color: 'green' },
  returned: { label: 'Returned', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'gray' },
};

export const supplyStatusMeta: Record<
  SupplyStatus,
  { label: string; color: 'gray' | 'blue' | 'green' }
> = {
  draft: { label: 'Draft', color: 'gray' },
  shipped: { label: 'Shipped', color: 'blue' },
  in_warehouse: { label: 'In Warehouse', color: 'green' },
};

export const courierPaymentMeta: Record<
  CourierPaymentStatus,
  { label: string; color: 'yellow' | 'green' }
> = {
  pending: { label: 'Pending', color: 'yellow' },
  received: { label: 'Received', color: 'green' },
};

export const deliveryStatusOrder: DeliveryStatus[] = [
  'order_placed',
  'packed',
  'in_transit',
  'delivered',
  'returned',
  'cancelled',
];

// ---- New order lifecycle ----
export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' }
> = {
  draft: { label: 'Draft', color: 'gray' },
  pending_confirmation: { label: 'Pending Confirmation', color: 'yellow' },
  confirmed: { label: 'Confirmed', color: 'blue' },
  processing: { label: 'Processing', color: 'purple' },
  ready_to_ship: { label: 'Ready to Ship', color: 'orange' },
  dispatched: { label: 'Dispatched', color: 'blue' },
  in_transit: { label: 'In Transit', color: 'blue' },
  out_for_delivery: { label: 'Out for Delivery', color: 'blue' },
  delivered: { label: 'Delivered', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'gray' },
  customer_refused: { label: 'Customer Refused', color: 'red' },
  returned: { label: 'Returned', color: 'red' },
  lost: { label: 'Lost', color: 'red' },
  damaged: { label: 'Damaged', color: 'red' },
};

export const orderStatusFlow: OrderStatus[] = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'processing',
  'ready_to_ship',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export const orderStatusTerminal: OrderStatus[] = [
  'cancelled',
  'customer_refused',
  'returned',
  'lost',
  'damaged',
];

export const allOrderStatuses: OrderStatus[] = [...orderStatusFlow, ...orderStatusTerminal];

export const paymentStatusMeta: Record<
  PaymentStatus,
  { label: string; color: 'gray' | 'yellow' | 'green' | 'red' }
> = {
  unverified: { label: 'Unverified', color: 'gray' },
  pending_verification: { label: 'Pending Verification', color: 'yellow' },
  verified: { label: 'Verified', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
};

export const courierEventStatusMeta: Record<
  CourierEventStatus,
  { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }
> = {
  ready: { label: 'Ready', color: 'yellow' },
  picked_up: { label: 'Picked Up', color: 'purple' },
  in_transit: { label: 'In Transit', color: 'blue' },
  out_for_delivery: { label: 'Out for Delivery', color: 'blue' },
  delivered: { label: 'Delivered', color: 'green' },
  customer_refused: { label: 'Customer Refused', color: 'red' },
  returned: { label: 'Returned', color: 'red' },
  lost: { label: 'Lost', color: 'red' },
  damaged: { label: 'Damaged', color: 'red' },
};

export const courierEventStatusOrder: CourierEventStatus[] = [
  'ready',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'customer_refused',
  'returned',
  'lost',
  'damaged',
];

export const courierNames: Array<'Pathao' | 'Steadfast' | 'RedX' | 'Paperfly'> = [
  'Pathao',
  'Steadfast',
  'RedX',
  'Paperfly',
];
