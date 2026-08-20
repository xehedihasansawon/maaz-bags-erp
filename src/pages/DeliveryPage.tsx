import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, Truck, CheckCircle2, XCircle, Clock, Package, Banknote,
  AlertTriangle, Eye, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SalesOrder, CourierName, OrderStatus, CourierEvent, CourierEventStatus,
} from '@/types';
import { formatBDT, formatDate, formatDateTime } from '@/lib/format';
import { courierNames, orderStatusMeta, orderStatusFlow, orderStatusTerminal, courierEventStatusMeta, courierEventStatusOrder } from '@/lib/status';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

export function DeliveryPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [settleOrder, setSettleOrder] = useState<SalesOrder | null>(null);
  const [eventsOrder, setEventsOrder] = useState<SalesOrder | null>(null);
  const [courierEvents, setCourierEvents] = useState<CourierEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .order('order_date', { ascending: false });
    if (error) toast.show('Failed to load delivery data.', 'error');
    setOrders((data as SalesOrder[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.order_status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.phone_number.toLowerCase().includes(q) ||
          (o.courier_tracking_id ?? '').toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      readyToShip: orders.filter((o) => o.order_status === 'ready_to_ship').length,
      inTransit: orders.filter((o) => ['dispatched', 'in_transit', 'out_for_delivery'].includes(o.order_status)).length,
      delivered: orders.filter((o) => o.order_status === 'delivered').length,
      returned: orders.filter((o) => ['returned', 'customer_refused', 'lost', 'damaged'].includes(o.order_status)).length,
    };
  }, [orders]);

  const quickStatus = async (o: SalesOrder, status: OrderStatus) => {
    const { error } = await supabase
      .from('sales_orders')
      .update({ order_status: status })
      .eq('id', o.id);
    if (error) toast.show('Failed to update status.', 'error');
    else {
      toast.show('Order status updated.', 'success');
      load();
    }
  };

  const openEvents = async (o: SalesOrder) => {
    setEventsOrder(o);
    const { data } = await supabase
      .from('courier_events')
      .select('*')
      .eq('sales_order_id', o.id)
      .order('created_at', { ascending: false });
    setCourierEvents((data as CourierEvent[]) ?? []);
  };

  const addCourierEvent = async (orderId: string, status: CourierEventStatus, note: string, courierName: string, trackingId: string) => {
    const { error } = await supabase.from('courier_events').insert({
      sales_order_id: orderId,
      event_status: status,
      event_note: note.trim() || null,
      courier_name: courierName || null,
      tracking_id: trackingId || null,
    });
    if (error) {
      toast.show('Failed to add courier event.', 'error');
      return;
    }
    toast.show('Courier event added.', 'success');
    // Refresh events
    const { data } = await supabase
      .from('courier_events')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: false });
    setCourierEvents((data as CourierEvent[]) ?? []);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Delivery & Courier Settlement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track order lifecycle, courier events, and reconcile settlements</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ready to Ship" value={stats.readyToShip} icon={Package} tone="orange" />
        <StatCard label="In Transit" value={stats.inTransit} icon={Truck} tone="blue" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} tone="green" />
        <StatCard label="Returned/Failed" value={stats.returned} icon={XCircle} tone="red" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, tracking, customer..."
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
            className="input w-auto"
          >
            <option value="all">All Statuses</option>
            {[...orderStatusFlow, ...orderStatusTerminal].map((s) => (
              <option key={s} value={s}>{orderStatusMeta[s].label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Courier</th>
                  <th className="px-4 py-3 text-right font-semibold">COD</th>
                  <th className="px-4 py-3 font-semibold">Order Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Cash Received</th>
                  <th className="px-4 py-3 text-center font-semibold">Settled</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const meta = orderStatusMeta[o.order_status] ?? { label: o.order_status, color: 'gray' as const };
                  const hasSettlementDiff = Math.abs(Number(o.settlement_difference_bdt)) > 0.01;
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(o.order_date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{o.customer_name}</p>
                        <p className="text-xs text-slate-400">{o.phone_number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 dark:text-slate-200">{o.courier_name}</p>
                        <p className="text-xs text-slate-400">{o.courier_tracking_id ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(o.cod_amount_bdt)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={o.order_status}
                          onChange={(e) => quickStatus(o, e.target.value as OrderStatus)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {[...orderStatusFlow, ...orderStatusTerminal].map((s) => (
                            <option key={s} value={s}>{orderStatusMeta[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(o.actual_cash_received_bdt)}</td>
                      <td className="px-4 py-3 text-center">
                        {o.settlement_reconciled ? (
                          <CheckCircle2 size={16} className="mx-auto text-emerald-500" />
                        ) : hasSettlementDiff ? (
                          <AlertTriangle size={16} className="mx-auto text-amber-500" />
                        ) : (
                          <Clock size={16} className="mx-auto text-slate-300" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openEvents(o)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            title="Courier events"
                          >
                            <Eye size={15} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setSettleOrder(o)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                              title="Settle courier payment"
                            >
                              <Banknote size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {settleOrder && (
        <SettlementModal
          order={settleOrder}
          onClose={() => setSettleOrder(null)}
          onSaved={() => {
            setSettleOrder(null);
            load();
          }}
        />
      )}

      {eventsOrder && (
        <CourierEventsModal
          order={eventsOrder}
          events={courierEvents}
          onClose={() => setEventsOrder(null)}
          onAddEvent={addCourierEvent}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: typeof Truck;
  tone: 'yellow' | 'blue' | 'green' | 'red' | 'orange';
}) {
  const tones = {
    yellow: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

interface SettlementModalProps {
  order: SalesOrder;
  onClose: () => void;
  onSaved: () => void;
}

function SettlementModal({ order, onClose, onSaved }: SettlementModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    courier_delivery_fee_bdt: Number(order.courier_delivery_fee_bdt),
    courier_return_charge_bdt: Number(order.courier_return_charge_bdt),
    actual_cash_received_bdt: Number(order.actual_cash_received_bdt),
  settlement_actual_bdt: Number(order.settlement_actual_bdt) || Number(order.actual_cash_received_bdt),
    approved_deductions_bdt: 0,
  cod_fee_bdt: 0,
  settlement_reconciled: order.settlement_reconciled,
  return_reason: '',
    product_condition: '',
    restock_qty: 0,
    damaged_qty: 0,
    missing_qty: 0,
    inspection_notes: '',
  });

  const isDelivered = order.order_status === 'delivered' || order.delivery_status === 'delivered';
  const isReturned = order.order_status === 'returned' || order.delivery_status === 'returned';
  const cod = Number(order.cod_amount_bdt);
  const fee = Number(form.courier_delivery_fee_bdt);
  const returnCharge = Number(form.courier_return_charge_bdt);
  const codFee = Number(form.cod_fee_bdt);
  const deductions = Number(form.approved_deductions_bdt);

  const expectedSettlement = isDelivered
    ? cod - fee - codFee - deductions
    : isReturned
      ? -(returnCharge + deductions)
      : 0;

  const actualSettlement = Number(form.settlement_actual_bdt);
  const settlementDiff = expectedSettlement - actualSettlement;
  const hasMismatch = Math.abs(settlementDiff) > 0.01;

  const submit = async () => {
    setSaving(true);
    const update: Record<string, unknown> = {
      courier_delivery_fee_bdt: fee,
      courier_return_charge_bdt: returnCharge,
      actual_cash_received_bdt: Math.round(actualSettlement * 100) / 100,
      settlement_expected_bdt: Math.round(expectedSettlement * 100) / 100,
      settlement_actual_bdt: Math.round(actualSettlement * 100) / 100,
      settlement_difference_bdt: Math.round(settlementDiff * 100) / 100,
      settlement_reconciled: form.settlement_reconciled || !hasMismatch,
    };

    const { error } = await supabase
      .from('sales_orders')
      .update(update)
      .eq('id', order.id);

    if (error) {
      setSaving(false);
      toast.show('Failed to save settlement.', 'error');
      return;
    }

    // If returned, create return inspection record
    if (isReturned && (form.restock_qty > 0 || form.damaged_qty > 0 || form.missing_qty > 0)) {
      await supabase.from('return_inspections').insert({
        sales_order_id: order.id,
        return_reason: form.return_reason.trim() || null,
        product_condition: form.product_condition.trim() || null,
        restock_qty: Number(form.restock_qty),
        damaged_qty: Number(form.damaged_qty),
        missing_qty: Number(form.missing_qty),
        notes: form.inspection_notes.trim() || null,
      });

      // Update inventory for restock/damaged/missing
      const invUpdate: Record<string, unknown> = {};
      if (form.restock_qty > 0) {
        invUpdate.sold_qty = Math.max(0, 0); // sold_qty recalculated by trigger
      }
      if (form.damaged_qty > 0) {
        invUpdate.damaged_qty = form.damaged_qty;
      }
      if (form.missing_qty > 0) {
        invUpdate.missing_qty = form.missing_qty;
      }
      if (Object.keys(invUpdate).length > 0) {
        await supabase.from('inventory').update(invUpdate).eq('bag_id', order.bag_id);
      }

      // Update order return inspection status
      const inspStatus = form.damaged_qty > 0 ? 'damaged' : form.missing_qty > 0 ? 'missing' : 'restocked';
      await supabase.from('sales_orders').update({ return_inspection_status: inspStatus }).eq('id', order.id);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'courier_settlement',
      module: 'delivery',
      record_id: order.id,
      new_value: update,
      reason: `Settlement for ${order.customer_name}`,
    });

    setSaving(false);
    toast.show('Courier settlement saved.', 'success');
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={`Courier Settlement — ${order.customer_name}`} size="lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Courier</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{order.courier_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tracking ID</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{order.courier_tracking_id ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Order Status</p>
              <Badge variant={orderStatusMeta[order.order_status]?.color ?? 'gray'}>
                {orderStatusMeta[order.order_status]?.label ?? order.order_status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">COD Amount</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{formatBDT(cod)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Courier Delivery Fee (BDT)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.courier_delivery_fee_bdt}
              onChange={(e) => setForm({ ...form, courier_delivery_fee_bdt: Number(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label className="label">COD Fee (BDT)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.cod_fee_bdt}
              onChange={(e) => setForm({ ...form, cod_fee_bdt: Number(e.target.value) })}
              className="input"
            />
          </div>
          {isReturned && (
            <div>
              <label className="label">Courier Return Charge (BDT)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.courier_return_charge_bdt}
                onChange={(e) => setForm({ ...form, courier_return_charge_bdt: Number(e.target.value) })}
                className="input"
              />
            </div>
          )}
          <div>
            <label className="label">Approved Deductions (BDT)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.approved_deductions_bdt}
              onChange={(e) => setForm({ ...form, approved_deductions_bdt: Number(e.target.value) })}
              className="input"
            />
          </div>
        </div>

        {/* Return inspection section */}
        {isReturned && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
            <h3 className="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-300">Return Inspection</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Return Reason</label>
                <input
                  value={form.return_reason}
                  onChange={(e) => setForm({ ...form, return_reason: e.target.value })}
                  placeholder="e.g. Customer refused, wrong address..."
                  className="input"
                />
              </div>
              <div>
                <label className="label">Product Condition</label>
                <input
                  value={form.product_condition}
                  onChange={(e) => setForm({ ...form, product_condition: e.target.value })}
                  placeholder="e.g. Good, Damaged, Sealed..."
                  className="input"
                />
              </div>
              <div>
                <label className="label">Restock Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={form.restock_qty}
                  onChange={(e) => setForm({ ...form, restock_qty: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Damaged Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={form.damaged_qty}
                  onChange={(e) => setForm({ ...form, damaged_qty: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Missing Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={form.missing_qty}
                  onChange={(e) => setForm({ ...form, missing_qty: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Inspection Notes</label>
                <textarea
                  value={form.inspection_notes}
                  onChange={(e) => setForm({ ...form, inspection_notes: e.target.value })}
                  rows={2}
                  className="input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Settlement calculation */}
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/40 dark:bg-brand-900/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Expected Settlement</p>
              <p className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatBDT(expectedSettlement)}</p>
              <p className="text-xs text-brand-600 dark:text-brand-400">
                {isDelivered ? 'COD − Fee − COD Fee − Deductions' : isReturned ? '−(Return Charge + Deductions)' : '—'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-brand-700 dark:text-brand-300">Actual Settlement (BDT)</label>
              <input
                type="number"
                step="0.01"
                value={form.settlement_actual_bdt}
                onChange={(e) => setForm({ ...form, settlement_actual_bdt: Number(e.target.value) })}
                className="input mt-1"
              />
            </div>
          </div>
          {hasMismatch && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Settlement mismatch! Difference: {formatBDT(settlementDiff)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Save Settlement
        </button>
      </div>
    </Modal>
  );
}

interface CourierEventsModalProps {
  order: SalesOrder;
  events: CourierEvent[];
  onClose: () => void;
  onAddEvent: (orderId: string, status: CourierEventStatus, note: string, courierName: string, trackingId: string) => void;
}

function CourierEventsModal({ order, events, onClose, onAddEvent }: CourierEventsModalProps) {
  const [newEventStatus, setNewEventStatus] = useState<CourierEventStatus>('ready');
  const [newEventNote, setNewEventNote] = useState('');

  const handleAdd = () => {
    onAddEvent(order.id, newEventStatus, newEventNote, order.courier_name, order.courier_tracking_id ?? '');
    setNewEventNote('');
    setNewEventStatus('ready');
  };

  return (
    <Modal open={true} onClose={onClose} title={`Courier Events — ${order.customer_name}`} size="lg">
      <div className="space-y-4">
        {/* Add new event */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Add Courier Event</h3>
          <div className="flex flex-wrap gap-3">
            <select
              value={newEventStatus}
              onChange={(e) => setNewEventStatus(e.target.value as CourierEventStatus)}
              className="input w-auto"
            >
              {courierEventStatusOrder.map((s) => (
                <option key={s} value={s}>{courierEventStatusMeta[s].label}</option>
              ))}
            </select>
            <input
              value={newEventNote}
              onChange={(e) => setNewEventNote(e.target.value)}
              placeholder="Event note (optional)"
              className="input flex-1"
            />
            <button onClick={handleAdd} className="btn-primary">
              <Plus size={14} /> Add Event
            </button>
          </div>
        </div>

        {/* Events timeline */}
        {events.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No courier events recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const meta = courierEventStatusMeta[ev.event_status];
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    meta.color === 'green' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : meta.color === 'red' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                    : meta.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : meta.color === 'yellow' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    : meta.color === 'purple' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <Truck size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{meta.label}</p>
                      <span className="text-xs text-slate-400">{formatDateTime(ev.created_at)}</span>
                    </div>
                    {ev.event_note && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{ev.event_note}</p>
                    )}
                    {ev.courier_name && (
                      <p className="mt-0.5 text-xs text-slate-400">{ev.courier_name} · {ev.tracking_id ?? '—'}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
