import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, AlertTriangle, ClipboardList, Wallet, Ship, TrendingUp, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SourcingOrder, ShippingMethod, SourcingBatchStatus } from '@/types';
import { formatBDT, formatNumber, formatDate, todayInputDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export function SourcingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<SourcingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SourcingOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sourcing_orders').select('*').order('order_date', { ascending: false });
    setOrders((data as SourcingOrder[]) ?? []);
    if (error) toast.show('Failed to load sourcing orders.', 'error');
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) => o.agent_name.toLowerCase().includes(q) || (o.batch_invoice_id ?? '').toLowerCase().includes(q));
  }, [orders, search]);

  const stats = useMemo(() => {
    const totalBatches = orders.length;
    const totalValue = orders.reduce((s, o) => s + Number(o.total_final_price_bdt), 0);
    const totalDue = orders.reduce((s, o) => s + Number(o.remaining_due_bdt), 0);
    const settled = orders.filter((o) => o.batch_status === 'fully_settled').length;
    return { totalBatches, totalValue, totalDue, settled };
  }, [orders]);

  const handleDelete = async (o: SourcingOrder) => {
    if (!confirm(`Delete sourcing batch "${o.batch_invoice_id ?? o.agent_name}"?`)) return;
    const { error } = await supabase.from('sourcing_orders').delete().eq('id', o.id);
    if (error) toast.show('Failed to delete sourcing batch.', 'error');
    else { toast.show('Sourcing batch deleted.', 'success'); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sourcing Agent Ledger</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track agent batch orders with two-tier payment lifecycle</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          <Plus size={16} /> New Sourcing Batch
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Batches" value={formatNumber(stats.totalBatches)} icon={ClipboardList} tone="gray" />
        <StatCard label="Total Value" value={formatBDT(stats.totalValue)} icon={Wallet} tone="blue" />
        <StatCard label="Total Due" value={formatBDT(stats.totalDue)} icon={AlertTriangle} tone="red" />
        <StatCard label="Fully Settled" value={formatNumber(stats.settled)} icon={TrendingUp} tone="green" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agent, batch ID..." className="input pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No sourcing batches yet. Click "New Sourcing Batch" to add one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Agent / Supplier</th>
                  <th className="px-4 py-3 font-semibold">Batch / Invoice</th>
                  <th className="px-4 py-3 text-right font-semibold">Final Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance (70%)</th>
                  <th className="px-4 py-3 text-right font-semibold">Remaining Due</th>
                  <th className="px-4 py-3 text-right font-semibold">Weight (KG)</th>
                  <th className="px-4 py-3 font-semibold">Shipping</th>
                  <th className="px-4 py-3 text-right font-semibold">Freight Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Settlement</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const statusMeta: Record<SourcingBatchStatus, { label: string; color: 'green' | 'yellow' | 'gray' }> = {
                    fully_settled: { label: 'Fully Settled', color: 'green' },
                    partial_due: { label: 'Partial Due', color: 'yellow' },
                    paid: { label: 'Paid', color: 'gray' },
                  };
                  const meta = statusMeta[o.batch_status];
                  return (
                    <tr key={o.id} className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(o.order_date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{o.agent_name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{o.batch_invoice_id ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(o.total_final_price_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatBDT(o.advance_paid_bdt)}
                        {o.advance_payment_ref && <p className="text-xs text-slate-400">{o.advance_payment_ref}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">{formatBDT(o.remaining_due_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(o.final_gross_weight_kg).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs">
                          {o.shipping_method === 'air' ? <Ship size={12} className="text-blue-500" /> : <Ship size={12} className="text-emerald-500" />}
                          <span className="capitalize">{o.shipping_method}</span>
                          <span className="text-slate-400">({o.freight_rate_per_kg}/kg)</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(o.freight_cost_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatBDT(o.final_settlement_paid_bdt)}
                        {o.final_settlement_ref && <p className="text-xs text-slate-400">{o.final_settlement_ref}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge variant={meta.color}>{meta.label}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setEditing(o); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title="Edit"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(o)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" title="Delete"><Trash2 size={15} /></button>
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

      <SourcingOrderModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={load} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Package; tone: 'blue' | 'green' | 'red' | 'gray' }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
    gray: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

interface SourcingOrderModalProps {
  open: boolean;
  onClose: () => void;
  editing: SourcingOrder | null;
  onSaved: () => void;
}

function SourcingOrderModal({ open, onClose, editing, onSaved }: SourcingOrderModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    order_date: todayInputDate(),
    agent_name: '',
    batch_invoice_id: '',
    total_final_price_bdt: 0,
    advance_paid_bdt: 0,
    advance_payment_ref: '',
    final_gross_weight_kg: 0,
    shipping_method: 'air' as ShippingMethod,
    freight_rate_per_kg: 750,
    bd_local_courier_bdt: 0,
    final_settlement_paid_bdt: 0,
    final_settlement_ref: '',
    notes: '',
  });

  useEffect(() => {
    if (editing) {
      setForm({
        order_date: editing.order_date,
        agent_name: editing.agent_name,
        batch_invoice_id: editing.batch_invoice_id ?? '',
        total_final_price_bdt: Number(editing.total_final_price_bdt),
        advance_paid_bdt: Number(editing.advance_paid_bdt),
        advance_payment_ref: editing.advance_payment_ref ?? '',
        final_gross_weight_kg: Number(editing.final_gross_weight_kg),
        shipping_method: editing.shipping_method,
        freight_rate_per_kg: Number(editing.freight_rate_per_kg),
        bd_local_courier_bdt: Number(editing.bd_local_courier_bdt),
        final_settlement_paid_bdt: Number(editing.final_settlement_paid_bdt),
        final_settlement_ref: editing.final_settlement_ref ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm({
        order_date: todayInputDate(), agent_name: '', batch_invoice_id: '',
        total_final_price_bdt: 0, advance_paid_bdt: 0, advance_payment_ref: '',
        final_gross_weight_kg: 0, shipping_method: 'air', freight_rate_per_kg: 750,
        bd_local_courier_bdt: 0, final_settlement_paid_bdt: 0, final_settlement_ref: '', notes: '',
      });
    }
  }, [editing, open]);

  const remainingDue = Number(form.total_final_price_bdt) - Number(form.advance_paid_bdt);
  const freightCost = Number(form.final_gross_weight_kg) * Number(form.freight_rate_per_kg);
  const totalPaid = Number(form.advance_paid_bdt) + Number(form.final_settlement_paid_bdt);
  const batchStatus: SourcingBatchStatus = totalPaid >= Number(form.total_final_price_bdt) && Number(form.total_final_price_bdt) > 0
    ? 'fully_settled'
    : totalPaid > 0
    ? 'partial_due'
    : 'paid';

  const setAdvanceTo70 = () => {
    setForm({ ...form, advance_paid_bdt: Math.round(Number(form.total_final_price_bdt) * 0.7 * 100) / 100 });
  };

  const submit = async () => {
    if (!form.agent_name.trim()) { toast.show('Agent / Supplier name is required.', 'error'); return; }
    setSaving(true);
    const payload = {
      order_date: form.order_date,
      agent_name: form.agent_name.trim(),
      batch_invoice_id: form.batch_invoice_id.trim() || null,
      total_final_price_bdt: Number(form.total_final_price_bdt),
      advance_paid_bdt: Number(form.advance_paid_bdt),
      advance_payment_ref: form.advance_payment_ref.trim() || null,
      remaining_due_bdt: Math.round(remainingDue * 100) / 100,
      final_gross_weight_kg: Number(form.final_gross_weight_kg),
      shipping_method: form.shipping_method,
      freight_rate_per_kg: Number(form.freight_rate_per_kg),
      freight_cost_bdt: Math.round(freightCost * 100) / 100,
      bd_local_courier_bdt: Number(form.bd_local_courier_bdt),
      final_settlement_paid_bdt: Number(form.final_settlement_paid_bdt),
      final_settlement_ref: form.final_settlement_ref.trim() || null,
      batch_status: batchStatus,
      notes: form.notes.trim() || null,
    };
    const res = editing
      ? await supabase.from('sourcing_orders').update(payload).eq('id', editing.id)
      : await supabase.from('sourcing_orders').insert(payload);
    setSaving(false);
    if (res.error) { toast.show('Failed to save sourcing batch.', 'error'); return; }
    toast.show(editing ? 'Sourcing batch updated.' : 'Sourcing batch created.', 'success');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Sourcing Batch' : 'New Sourcing Batch'} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Order Date</label>
          <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Agent / Supplier Name</label>
          <input value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} placeholder="Enter agent or supplier name" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Batch / Invoice ID</label>
          <input value={form.batch_invoice_id} onChange={(e) => setForm({ ...form, batch_invoice_id: e.target.value })} placeholder="Batch or invoice reference" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Total Product Final Price (BDT)</label>
          <input type="number" step="0.01" min={0} value={form.total_final_price_bdt} onChange={(e) => setForm({ ...form, total_final_price_bdt: Number(e.target.value) })} className="input" />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">1st Payment / Advance</h3>
          <button onClick={setAdvanceTo70} className="rounded-lg bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60">
            Set 70% Default
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Advance Paid (BDT)</label>
            <input type="number" step="0.01" min={0} value={form.advance_paid_bdt} onChange={(e) => setForm({ ...form, advance_paid_bdt: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label">Payment Method / TrxID</label>
            <input value={form.advance_payment_ref} onChange={(e) => setForm({ ...form, advance_payment_ref: e.target.value })} placeholder="bKash / bank TrxID" className="input" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500 dark:text-slate-400">Remaining Product Due</span>
          <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatBDT(remainingDue)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Shipping & Freight</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Actual Arrival Weight (KG)</label>
            <input type="number" step="0.001" min={0} value={form.final_gross_weight_kg} onChange={(e) => setForm({ ...form, final_gross_weight_kg: Number(e.target.value) })} placeholder="Entered upon arrival" className="input" />
          </div>
          <div>
            <label className="label">Shipping Method</label>
            <select value={form.shipping_method} onChange={(e) => setForm({ ...form, shipping_method: e.target.value as ShippingMethod, freight_rate_per_kg: e.target.value === 'air' ? 750 : form.freight_rate_per_kg })} className="input">
              <option value="air">Air (Default: 750 BDT/KG)</option>
              <option value="sea">Sea (Editable Rate)</option>
            </select>
          </div>
          <div>
            <label className="label">Freight Rate (BDT/KG)</label>
            <input type="number" step="0.01" min={0} value={form.freight_rate_per_kg} onChange={(e) => setForm({ ...form, freight_rate_per_kg: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label">BD Local Courier / Handling (BDT)</label>
            <input type="number" step="0.01" min={0} value={form.bd_local_courier_bdt} onChange={(e) => setForm({ ...form, bd_local_courier_bdt: Number(e.target.value) })} className="input" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500 dark:text-slate-400">Calculated Freight Cost (Weight × Rate)</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatBDT(freightCost)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">2nd Payment / Final Settlement</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Final Settlement Paid (BDT)</label>
            <input type="number" step="0.01" min={0} value={form.final_settlement_paid_bdt} onChange={(e) => setForm({ ...form, final_settlement_paid_bdt: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label">Payment Method / TrxID</label>
            <input value={form.final_settlement_ref} onChange={(e) => setForm({ ...form, final_settlement_ref: e.target.value })} placeholder="bKash / bank TrxID" className="input" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500 dark:text-slate-400">Overall Batch Balance Status</span>
          <Badge variant={batchStatus === 'fully_settled' ? 'green' : batchStatus === 'partial_due' ? 'yellow' : 'gray'}>
            {batchStatus === 'fully_settled' ? 'Fully Settled' : batchStatus === 'partial_due' ? 'Partial Due' : 'Paid'}
          </Badge>
        </div>
      </div>

      <div className="mt-4">
        <label className="label">Notes (optional)</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes about this batch..." rows={2} className="input" />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null} {editing ? 'Save Changes' : 'Create Batch'}
        </button>
      </div>
    </Modal>
  );
}
