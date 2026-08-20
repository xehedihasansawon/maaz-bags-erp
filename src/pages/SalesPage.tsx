import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, ShoppingCart, Phone, Package, X, Check,
  ShieldAlert, AlertTriangle, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Bag, Inventory, SalesOrder, CourierName, OrderStatus,
  CustomerRiskInfo, CustomerRiskOverride, BagVariant,
} from '@/types';
import { formatBDT, formatDate, todayInputDate, toInputDate } from '@/lib/format';
import { courierNames, orderStatusMeta, orderStatusFlow, orderStatusTerminal, paymentStatusMeta } from '@/lib/status';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

export function SalesPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [bags, setBags] = useState<Bag[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [variants, setVariants] = useState<BagVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courierFilter, setCourierFilter] = useState<'all' | CourierName>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [so, b, inv, vars] = await Promise.all([
      supabase.from('sales_orders').select('*').order('order_date', { ascending: false }),
      supabase.from('bags').select('*').order('name'),
      isAdmin
        ? supabase.from('inventory').select('*')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('bag_variants').select('*'),
    ]);
    setOrders((so.data as SalesOrder[]) ?? []);
    setBags((b.data as Bag[]) ?? []);
    setInventory((inv.data as Inventory[]) ?? []);
    setVariants((vars.data as BagVariant[]) ?? []);
    if (so.error) toast.show('Failed to load sales orders.', 'error');
    setLoading(false);
  }, [toast, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const pricingMap = useMemo(() => {
    const m = new Map<string, { selling: number; landed: number }>();
    for (const inv of inventory) {
      const cur = m.get(inv.bag_id);
      if (!cur || inv.created_at > (cur as any)._t) {
        m.set(inv.bag_id, { selling: inv.selling_price_bdt, landed: inv.landed_cost_per_bag_bdt, _t: inv.created_at } as any);
      }
    }
    return m;
  }, [inventory]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (courierFilter !== 'all' && o.courier_name !== courierFilter) return false;
      if (statusFilter !== 'all' && o.order_status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.phone_number.toLowerCase().includes(q) ||
          (o.courier_tracking_id ?? '').toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.bag_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, courierFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      delivered: orders.filter((o) => o.order_status === 'delivered').length,
      inTransit: orders.filter((o) => ['dispatched', 'in_transit', 'out_for_delivery'].includes(o.order_status)).length,
      pending: orders.filter((o) => ['draft', 'pending_confirmation', 'confirmed', 'processing', 'ready_to_ship'].includes(o.order_status)).length,
    };
  }, [orders]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (o: SalesOrder) => {
    setEditing(o);
    setModalOpen(true);
  };

  const handleDelete = async (o: SalesOrder) => {
    if (!confirm(`Delete order for ${o.customer_name}?`)) return;
    const { error } = await supabase.from('sales_orders').delete().eq('id', o.id);
    if (error) toast.show('Failed to delete order.', 'error');
    else {
      toast.show('Order deleted.', 'success');
      load();
    }
  };

  const quickStatusUpdate = async (o: SalesOrder, status: OrderStatus) => {
    const { error } = await supabase
      .from('sales_orders')
      .update({ order_status: status })
      .eq('id', o.id);
    if (error) toast.show('Failed to update status.', 'error');
    else {
      toast.show('Status updated.', 'success');
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Orders & Dispatch</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Daily order entry, lifecycle tracking, and courier dispatch</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> New Sales Order
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Orders" value={stats.total} icon={ShoppingCart} tone="gray" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="yellow" />
        <StatCard label="In Transit" value={stats.inTransit} icon={ShoppingCart} tone="blue" />
        <StatCard label="Delivered" value={stats.delivered} icon={Check} tone="green" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, tracking, customer, bag..."
              className="input pl-9"
            />
          </div>
          <select
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value as 'all' | CourierName)}
            className="input w-auto"
          >
            <option value="all">All Couriers</option>
            {courierNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
          <div className="py-16 text-center text-sm text-slate-400">
            No sales orders found. Click "New Sales Order" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Bag</th>
                  <th className="px-4 py-3 text-right font-semibold">Selling</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance</th>
                  <th className="px-4 py-3 text-right font-semibold">COD</th>
                  <th className="px-4 py-3 font-semibold">Courier</th>
                  <th className="px-4 py-3 font-semibold">Order Status</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const meta = orderStatusMeta[o.order_status] ?? { label: o.order_status, color: 'gray' as const };
                  const payMeta = paymentStatusMeta[o.payment_status] ?? paymentStatusMeta.unverified;
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(o.order_date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{o.customer_name}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-400">
                          <Phone size={10} /> {o.phone_number}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 dark:text-slate-200">{o.bag_name}</p>
                        <p className="text-xs text-slate-400">{o.bag_id} · Qty {o.quantity}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(o.selling_price_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(o.advance_paid_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(o.cod_amount_bdt)}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 dark:text-slate-200">{o.courier_name}</p>
                        <p className="text-xs text-slate-400">{o.courier_tracking_id ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.order_status}
                          onChange={(e) => quickStatusUpdate(o, e.target.value as OrderStatus)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {[...orderStatusFlow, ...orderStatusTerminal].map((s) => (
                            <option key={s} value={s}>{orderStatusMeta[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={payMeta.color}>{payMeta.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(o)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(o)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                              title="Delete"
                            >
                              <Trash2 size={15} />
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

      <SalesOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        bags={bags}
        variants={variants}
        pricingMap={pricingMap}
        onSaved={load}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShoppingCart;
  tone: 'gray' | 'yellow' | 'blue' | 'green';
}) {
  const tones = {
    gray: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    yellow: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
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

interface SalesOrderModalProps {
  open: boolean;
  onClose: () => void;
  editing: SalesOrder | null;
  bags: Bag[];
  variants: BagVariant[];
  pricingMap: Map<string, { selling: number; landed: number }>;
  onSaved: () => void;
}

function SalesOrderModal({ open, onClose, editing, bags, variants, pricingMap, onSaved }: SalesOrderModalProps) {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    order_date: todayInputDate(),
    customer_name: '',
    phone_number: '',
    delivery_address: '',
    bag_id: '',
    quantity: 1,
    selling_price_bdt: 0,
    advance_paid_bdt: 0,
    advance_note: '',
    courier_name: 'Pathao' as CourierName,
    courier_tracking_id: '',
    variant_sku: '',
  });

  // Risk detection state
  const [riskInfo, setRiskInfo] = useState<CustomerRiskInfo | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskOverride, setRiskOverride] = useState<CustomerRiskOverride | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLevel, setOverrideLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');

  useEffect(() => {
    if (editing) {
      setForm({
        order_date: toInputDate(editing.order_date),
        customer_name: editing.customer_name,
        phone_number: editing.phone_number,
        delivery_address: editing.delivery_address,
        bag_id: editing.bag_id,
        quantity: editing.quantity,
        selling_price_bdt: Number(editing.selling_price_bdt),
        advance_paid_bdt: Number(editing.advance_paid_bdt),
        advance_note: editing.advance_note ?? '',
        courier_name: editing.courier_name,
        courier_tracking_id: editing.courier_tracking_id ?? '',
        variant_sku: editing.variant_sku ?? '',
      });
    } else {
      setForm({
        order_date: todayInputDate(),
        customer_name: '',
        phone_number: '',
        delivery_address: '',
        bag_id: '',
        quantity: 1,
        selling_price_bdt: 0,
        advance_paid_bdt: 0,
        advance_note: '',
        courier_name: 'Pathao',
        courier_tracking_id: '',
        variant_sku: '',
      });
    }
    setRiskInfo(null);
    setRiskOverride(null);
  }, [editing, open]);

  // Fetch risk info when phone number changes
  useEffect(() => {
    if (!open || form.phone_number.trim().length < 6) {
      setRiskInfo(null);
      setRiskOverride(null);
      return;
    }
    const timer = setTimeout(async () => {
      setRiskLoading(true);
      try {
        const { data, error } = await supabase.rpc('calculate_customer_risk', { p_phone: form.phone_number.trim() });
        if (!error && data) {
          setRiskInfo(data as CustomerRiskInfo);
        }
        if (isAdmin) {
          const { data: override } = await supabase
            .from('customer_risk_overrides')
            .select('*')
            .eq('phone_number', form.phone_number.trim())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setRiskOverride((override as CustomerRiskOverride) ?? null);
        }
      } catch {
        // ignore
      }
      setRiskLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.phone_number, open, isAdmin]);

  const selectedBag = bags.find((b) => b.bag_id === form.bag_id);
  const bagVariants = variants.filter((v) => v.bag_id === form.bag_id);
  const selectedVariant = bagVariants.find((v) => v.sku === form.variant_sku) ?? null;
  const variantStock = selectedVariant ? selectedVariant.stock_qty : 0;
  const pricing = form.bag_id ? pricingMap.get(form.bag_id) : undefined;
  const sellingPrice = pricing ? pricing.selling : form.selling_price_bdt;
  const landedCost = pricing ? pricing.landed : editing?.landed_cost_per_bag_bdt ?? 0;
  const codAmount = Math.max(0, sellingPrice * form.quantity - form.advance_paid_bdt);

  const onBagChange = (bagId: string) => {
    const p = pricingMap.get(bagId);
    setForm((f) => ({
      ...f,
      bag_id: bagId,
      variant_sku: '',
      selling_price_bdt: p ? p.selling : f.selling_price_bdt,
    }));
  };

  const effectiveRiskLevel = riskOverride?.overridden_risk_level ?? riskInfo?.risk_level ?? 'LOW';

  const submitOverride = async () => {
    if (!overrideReason.trim()) {
      toast.show('Reason is required for risk override.', 'error');
      return;
    }
    const { error } = await supabase.from('customer_risk_overrides').insert({
      phone_number: form.phone_number.trim(),
      overridden_risk_level: overrideLevel,
      reason: overrideReason.trim(),
    });
    if (error) {
      toast.show('Failed to save override.', 'error');
      return;
    }
    toast.show('Risk level overridden.', 'success');
    setOverrideModalOpen(false);
    setOverrideReason('');
    // Refresh override
    const { data } = await supabase
      .from('customer_risk_overrides')
      .select('*')
      .eq('phone_number', form.phone_number.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRiskOverride((data as CustomerRiskOverride) ?? null);
  };

  const submit = async () => {
    if (!form.customer_name.trim()) {
      toast.show('Customer name is required.', 'error');
      return;
    }
    if (!form.phone_number.trim()) {
      toast.show('Phone number is required.', 'error');
      return;
    }
    if (!form.bag_id) {
      toast.show('Please select a bag.', 'error');
      return;
    }
    if (bagVariants.length > 0 && !form.variant_sku) {
      toast.show('Please select a color variant.', 'error');
      return;
    }
    if (selectedVariant && form.quantity > variantStock) {
      toast.show(`Only ${variantStock} units in stock for this variant.`, 'error');
      return;
    }
    setSaving(true);
    const payload = {
      order_date: form.order_date,
      customer_name: form.customer_name.trim(),
      phone_number: form.phone_number.trim(),
      delivery_address: form.delivery_address.trim(),
      bag_id: form.bag_id,
      bag_name: selectedBag?.name ?? 'Unknown Bag',
      quantity: Number(form.quantity),
      selling_price_bdt: Number(sellingPrice),
      landed_cost_per_bag_bdt: Number(landedCost),
      advance_paid_bdt: Number(form.advance_paid_bdt),
      advance_note: form.advance_note.trim() || null,
      cod_amount_bdt: Number(codAmount),
      courier_name: form.courier_name,
      courier_tracking_id: form.courier_tracking_id.trim() || null,
      variant_sku: form.variant_sku || null,
      order_status: editing ? editing.order_status : 'pending_confirmation',
    };
    const res = editing
      ? await supabase.from('sales_orders').update(payload).eq('id', editing.id)
      : await supabase.from('sales_orders').insert(payload);
    if (res.error) {
      setSaving(false);
      toast.show('Failed to save order.', 'error');
      return;
    }
    if (!editing && form.variant_sku && selectedVariant) {
      const newStock = Math.max(0, selectedVariant.stock_qty - Number(form.quantity));
      await supabase.from('bag_variants').update({ stock_qty: newStock }).eq('id', selectedVariant.id);
    }
    toast.show(editing ? 'Order updated.' : 'Order created.', 'success');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Sales Order' : 'New Sales Order'} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Order Date</label>
          <input
            type="date"
            value={form.order_date}
            onChange={(e) => setForm({ ...form, order_date: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Customer Name</label>
          <input
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="Customer name"
            className="input"
          />
        </div>
        <div>
          <label className="label">Phone Number</label>
          <input
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            placeholder="01XXX-XXXXXX"
            className="input"
          />
        </div>
        <div>
          <label className="label">Courier Name</label>
          <select
            value={form.courier_name}
            onChange={(e) => setForm({ ...form, courier_name: e.target.value as CourierName })}
            className="input"
          >
            {courierNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Full Delivery Address</label>
          <textarea
            value={form.delivery_address}
            onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
            placeholder="House, road, area, city"
            rows={2}
            className="input"
          />
        </div>

        {/* Fraud/Risk Detection Panel */}
        {form.phone_number.trim().length >= 6 && (
          <div className="sm:col-span-2">
            <div className={`rounded-xl border p-4 ${
              effectiveRiskLevel === 'HIGH'
                ? 'border-rose-300 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20'
                : effectiveRiskLevel === 'MEDIUM'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
                  : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className={
                    effectiveRiskLevel === 'HIGH' ? 'text-rose-600 dark:text-rose-400'
                    : effectiveRiskLevel === 'MEDIUM' ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                  } />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Customer Risk Assessment</span>
                </div>
                {riskLoading ? (
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                ) : riskInfo ? (
                  <Badge variant={
                    effectiveRiskLevel === 'HIGH' ? 'red'
                    : effectiveRiskLevel === 'MEDIUM' ? 'yellow'
                    : 'green'
                  }>
                    {effectiveRiskLevel}
                    {riskOverride && ' (Overridden)'}
                  </Badge>
                ) : null}
              </div>
              {riskInfo && (
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs sm:grid-cols-6">
                  <RiskStat label="Total" value={riskInfo.total_orders} />
                  <RiskStat label="Delivered" value={riskInfo.delivered_orders} />
                  <RiskStat label="Returned" value={riskInfo.returned_orders} />
                  <RiskStat label="Refused" value={riskInfo.refused_orders} />
                  <RiskStat label="Cancelled" value={riskInfo.cancelled_orders} />
                  <RiskStat label="Return Rate" value={`${riskInfo.return_rate}%`} />
                </div>
              )}
              {riskInfo && riskInfo.total_orders > 0 && riskInfo.last_order_date && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Last order: {formatDate(riskInfo.last_order_date)}
                </p>
              )}
              {isAdmin && riskInfo && (
                <button
                  onClick={() => {
                    setOverrideLevel(effectiveRiskLevel as 'LOW' | 'MEDIUM' | 'HIGH');
                    setOverrideReason('');
                    setOverrideModalOpen(true);
                  }}
                  className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Override Risk Level
                </button>
              )}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label">Step 1: Select Bag / Model</label>
          <select
            value={form.bag_id}
            onChange={(e) => onBagChange(e.target.value)}
            className="input"
          >
            <option value="">Select bag...</option>
            {bags.map((b) => (
              <option key={b.id} value={b.bag_id}>{b.name} ({b.bag_id})</option>
            ))}
          </select>
          {pricing && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Auto-filled selling price: {formatBDT(pricing.selling)}
            </p>
          )}
        </div>
        {form.bag_id && bagVariants.length > 0 && (
          <div className="sm:col-span-2">
            <label className="label">Step 2: Select Color / Variant</label>
            <select
              value={form.variant_sku}
              onChange={(e) => setForm({ ...form, variant_sku: e.target.value })}
              className="input"
            >
              <option value="">Select variant...</option>
              {bagVariants.map((v) => (
                <option key={v.id} value={v.sku}>
                  {v.color_name} ({v.sku}) — In Stock: {v.stock_qty}
                </option>
              ))}
            </select>
            {selectedVariant && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Locked to variant: <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">{selectedVariant.sku}</span> · Available: {variantStock} units
              </p>
            )}
          </div>
        )}
        {form.bag_id && bagVariants.length === 0 && (
          <div className="sm:col-span-2">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No color variants found for this bag. Order will use general inventory stock.
            </p>
          </div>
        )}
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Selling Price (BDT)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={sellingPrice}
            onChange={(e) => setForm({ ...form, selling_price_bdt: Number(e.target.value) })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Advance Paid (BDT)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.advance_paid_bdt}
            onChange={(e) => setForm({ ...form, advance_paid_bdt: Number(e.target.value) })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Advance Note / TrxID</label>
          <input
            value={form.advance_note}
            onChange={(e) => setForm({ ...form, advance_note: e.target.value })}
            placeholder="bKash / Nagad TrxID"
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Courier Tracking ID</label>
          <input
            value={form.courier_tracking_id}
            onChange={(e) => setForm({ ...form, courier_tracking_id: e.target.value })}
            placeholder="Tracking number"
            className="input"
          />
        </div>
      </div>

      {/* COD auto-calc */}
      <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/40 dark:bg-brand-900/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Courier COD Amount (auto)</p>
            <p className="text-xs text-brand-600 dark:text-brand-400">(Selling Price × Qty) − Advance Paid</p>
          </div>
          <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">{formatBDT(codAmount)}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {editing ? 'Save Changes' : 'Create Order'}
        </button>
      </div>

      {/* Risk Override Modal */}
      {overrideModalOpen && (
        <Modal open={true} onClose={() => setOverrideModalOpen(false)} title="Override Customer Risk Level" size="md">
          <div className="space-y-4">
            <div>
              <label className="label">Override Risk Level</label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setOverrideLevel(lvl)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      overrideLevel === lvl
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Reason (required)</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this risk level is being overridden..."
                rows={3}
                className="input"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setOverrideModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={submitOverride} className="btn-primary">Save Override</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function RiskStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
