import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, AlertTriangle, Boxes, TrendingDown, TrendingUp,
  Calculator, Package, Link2, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Bag, Inventory, InventoryWithBag, SourcingOrder } from '@/types';
import { formatBDT, formatNumber } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ColorTagsInput } from '@/components/ui/ColorTagsInput';

export function InventoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Inventory[]>([]);
  const [bags, setBags] = useState<Bag[]>([]);
  const [sourcingOrders, setSourcingOrders] = useState<SourcingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Inventory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bagModalOpen, setBagModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, b, so] = await Promise.all([
      supabase.from('inventory').select('*').order('created_at', { ascending: false }),
      supabase.from('bags').select('*').order('name'),
      supabase.from('sourcing_orders').select('*').order('order_date', { ascending: false }),
    ]);
    setRows((inv.data as Inventory[]) ?? []);
    setBags((b.data as Bag[]) ?? []);
    setSourcingOrders((so.data as SourcingOrder[]) ?? []);
    if (inv.error) toast.show('Failed to load inventory.', 'error');
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const bagColorsMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of bags) m.set(b.bag_id, b.colors ?? []);
    return m;
  }, [bags]);

  const enriched: InventoryWithBag[] = useMemo(() => {
    return rows.map((r) => {
      const available = r.received_qty - r.sold_qty - r.reserved_qty - r.damaged_qty - r.missing_qty;
      return { ...r, available_qty: available, low_stock: available < 5, colors: bagColorsMap.get(r.bag_id) ?? [] };
    });
  }, [rows, bagColorsMap]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (lowOnly && !r.low_stock) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.bag_id.toLowerCase().includes(q) || r.bag_name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [enriched, search, lowOnly]);

  const stats = useMemo(() => {
    const totalReceived = enriched.reduce((s, r) => s + r.received_qty, 0);
    const totalSold = enriched.reduce((s, r) => s + r.sold_qty, 0);
    const totalReserved = enriched.reduce((s, r) => s + r.reserved_qty, 0);
    const totalDamaged = enriched.reduce((s, r) => s + r.damaged_qty, 0);
    const totalAvailable = enriched.reduce((s, r) => s + Math.max(0, r.available_qty), 0);
    const lowCount = enriched.filter((r) => r.low_stock).length;
    return { totalReceived, totalSold, totalReserved, totalDamaged, totalAvailable, lowCount };
  }, [enriched]);

  const openEdit = (row: Inventory) => { setEditing(row); setModalOpen(true); };

  const handleDelete = async (row: Inventory) => {
    if (!confirm(`Delete inventory for ${row.bag_name}? This removes the stock record but keeps the bag in the product catalog.`)) return;
    setDeleting(row.id);
    const { error } = await supabase.from('inventory').delete().eq('id', row.id);
    setDeleting(null);
    if (error) { toast.show('Failed to delete inventory row.', 'error'); return; }
    toast.show('Inventory row deleted.', 'success');
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Costing & Live Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track landed costs, pricing, and live stock levels</p>
        </div>
        <button onClick={() => setBagModalOpen(true)} className="btn-primary">
          <Plus size={16} /> Add New Bag
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Received" value={formatNumber(stats.totalReceived)} icon={Boxes} tone="blue" />
        <StatCard label="Total Sold" value={formatNumber(stats.totalSold)} icon={TrendingDown} tone="orange" />
        <StatCard label="Reserved" value={formatNumber(stats.totalReserved)} icon={Package} tone="yellow" />
        <StatCard label="Damaged" value={formatNumber(stats.totalDamaged)} icon={AlertTriangle} tone="red" />
        <StatCard label="Available Stock" value={formatNumber(stats.totalAvailable)} icon={TrendingUp} tone="green" />
        <StatCard label="Low Stock Alerts" value={formatNumber(stats.lowCount)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bag or model..." className="input pl-9" />
          </div>
          <button
            onClick={() => setLowOnly((v) => !v)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              lowOnly ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Low stock only
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No inventory records. Click "Add New Bag" to create your first product.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Bag</th>
                  <th className="px-4 py-3 font-semibold">Colors</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 text-right font-semibold">Weight (KG)</th>
                  <th className="px-4 py-3 text-right font-semibold">Landed Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Selling Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin %</th>
                  <th className="px-4 py-3 text-center font-semibold">Avail</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const margin = r.net_margin_pct ?? (r.selling_price_bdt > 0
                    ? ((r.selling_price_bdt - (r.total_cost_per_bag_bdt || r.landed_cost_per_bag_bdt)) / r.selling_price_bdt) * 100
                    : 0);
                  const batch = sourcingOrders.find((s) => s.id === r.sourcing_order_id);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{r.bag_name}</p>
                        <p className="text-xs text-slate-400">{r.bag_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.colors && r.colors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.colors.map((c) => (
                              <span key={c} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {batch ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Link2 size={12} className="text-brand-500" />
                            <span>{batch.batch_invoice_id ?? batch.agent_name}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400">Standalone</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(r.single_bag_weight_kg).toFixed(3)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(r.landed_cost_per_bag_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(r.total_cost_per_bag_bdt || r.landed_cost_per_bag_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatBDT(r.selling_price_bdt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">{margin.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">{r.available_qty}</span>
                          {r.low_stock && <Badge variant="red"><AlertTriangle size={10} /> Low</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title="Edit pricing"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(r)} disabled={deleting === r.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30" title="Delete">
                            {deleting === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
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

      <EditPricingModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={load} />
      <AddNewBagModal open={bagModalOpen} onClose={() => setBagModalOpen(false)} onSaved={load} sourcingOrders={sourcingOrders} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Boxes; tone: 'blue' | 'orange' | 'green' | 'red' | 'yellow' }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
    yellow: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
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

interface EditPricingModalProps {
  open: boolean;
  onClose: () => void;
  editing: Inventory | null;
  onSaved: () => void;
}

function EditPricingModal({ open, onClose, editing, onSaved }: EditPricingModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [sellingPrice, setSellingPrice] = useState(0);

  useEffect(() => {
    if (editing) setSellingPrice(Number(editing.selling_price_bdt));
  }, [editing, open]);

  if (!editing) return null;

  const totalCost = editing.total_cost_per_bag_bdt || editing.landed_cost_per_bag_bdt;
  const margin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from('inventory').update({ selling_price_bdt: Number(sellingPrice) }).eq('id', editing.id);
    setSaving(false);
    if (error) { toast.show('Failed to update selling price.', 'error'); return; }
    toast.show('Selling price updated.', 'success');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Pricing — ${editing.bag_name}`} size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Cost Per Bag</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatBDT(totalCost)}</p>
          <p className="mt-1 text-xs text-slate-400">Landed {formatBDT(editing.landed_cost_per_bag_bdt)} + Packaging/Delivery/Ad</p>
        </div>
        <div>
          <label className="label">New Selling Price (BDT)</label>
          <input type="number" step="0.01" min={0} value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} className="input" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Margin</p>
              <p className={`text-lg font-bold ${margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : margin > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{margin.toFixed(1)}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Profit / Bag</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatBDT(sellingPrice - totalCost)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save Price
        </button>
      </div>
    </Modal>
  );
}

interface AddNewBagModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sourcingOrders: SourcingOrder[];
}

function AddNewBagModal({ open, onClose, onSaved, sourcingOrders }: AddNewBagModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [colorStock, setColorStock] = useState<Record<string, string>>({});
  const [priceTouched, setPriceTouched] = useState(false);
  const [targetMargin, setTargetMargin] = useState('45');
  const [form, setForm] = useState<Record<string, string>>({
    bag_id: '', name: '', category: '', sourcing_order_id: '',
    china_buying_cost_bdt: '264.10', single_bag_weight_kg: '0.400', air_freight_rate_per_kg: '750',
    china_bd_courier_share_bdt: '10', packaging_box_cost_bdt: '40', bubble_wrap_cost_bdt: '10',
    sticker_label_cost_bdt: '15', customer_delivery_courier_bdt: '170', facebook_ad_cost_bdt: '100',
    selling_price_bdt: '',
  });

  useEffect(() => {
    if (open) {
      setColors([]); setColorStock({});
      setPriceTouched(false);
      setTargetMargin('45');
      setForm({
        bag_id: '', name: '', category: '', sourcing_order_id: '',
        china_buying_cost_bdt: '264.10', single_bag_weight_kg: '0.400', air_freight_rate_per_kg: '750',
        china_bd_courier_share_bdt: '10', packaging_box_cost_bdt: '40', bubble_wrap_cost_bdt: '10',
        sticker_label_cost_bdt: '15', customer_delivery_courier_bdt: '170', facebook_ad_cost_bdt: '100',
        selling_price_bdt: '',
      });
    }
  }, [open]);

  const autoBagId = useMemo(() => {
    if (form.bag_id.trim()) return form.bag_id.trim().toUpperCase();
    if (!form.name.trim()) return '';
    const words = form.name.trim().toUpperCase().split(/\s+/);
    if (words.length >= 2) return `MZ-${words[0].slice(0, 3)}${words[1].slice(0, 2)}`;
    return `MZ-${words[0].slice(0, 5)}`;
  }, [form.bag_id, form.name]);

  const num = (v: string) => Number(v) || 0;
  const airShipping = num(form.single_bag_weight_kg) * num(form.air_freight_rate_per_kg);
  const landedCost = num(form.china_buying_cost_bdt) + airShipping + num(form.china_bd_courier_share_bdt);
  const packagingTotal = num(form.packaging_box_cost_bdt) + num(form.bubble_wrap_cost_bdt) + num(form.sticker_label_cost_bdt);
  const totalCostPerBag = landedCost + packagingTotal + num(form.customer_delivery_courier_bdt) + num(form.facebook_ad_cost_bdt);
  const marginPct = Math.min(99, Math.max(0, num(targetMargin))) / 100;
  const suggestedPrice = totalCostPerBag > 0 && marginPct > 0 && marginPct < 1 ? Math.ceil((totalCostPerBag / (1 - marginPct)) / 10) * 10 : 0;
  const effectiveSellingPrice = priceTouched ? num(form.selling_price_bdt) : suggestedPrice;
  const netProfitPerBag = effectiveSellingPrice - totalCostPerBag;
  const netMarginPct = effectiveSellingPrice > 0 ? (netProfitPerBag / effectiveSellingPrice) * 100 : 0;

  const generateSku = (colorName: string): string => {
    const modelPart = autoBagId.replace(/^MZ-/, '').toUpperCase();
    const colorCode = colorName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, '0');
    return `MZ-${modelPart}-${colorCode}`;
  };

  const totalColorStock = Object.values(colorStock).reduce((s, v) => s + (Number(v) || 0), 0);

  const submit = async () => {
    const bagIdToUse = autoBagId;
    if (!bagIdToUse) { toast.show('Bag ID or Name is required to generate SKU.', 'error'); return; }
    if (!form.name.trim()) { toast.show('Bag name is required.', 'error'); return; }
    setSaving(true);

    const { data: existingBag } = await supabase.from('bags').select('id').eq('bag_id', bagIdToUse).maybeSingle();
    if (existingBag) { setSaving(false); toast.show(`Bag ID "${bagIdToUse}" already exists.`, 'error'); return; }

    const { error: bagErr } = await supabase.from('bags').insert({
      bag_id: bagIdToUse, name: form.name.trim(), category: form.category.trim() || null, colors,
    });
    if (bagErr) { setSaving(false); toast.show('Failed to create bag.', 'error'); return; }

    const { error: invErr } = await supabase.from('inventory').insert({
      bag_id: bagIdToUse, bag_name: form.name.trim(),
      sourcing_order_id: form.sourcing_order_id || null,
      received_qty: totalColorStock, sold_qty: 0,
      single_bag_weight_kg: num(form.single_bag_weight_kg),
      air_freight_rate_per_kg: num(form.air_freight_rate_per_kg),
      unit_buying_price_bdt: num(form.china_buying_cost_bdt),
      china_bd_courier_share_bdt: num(form.china_bd_courier_share_bdt),
      packaging_box_cost_bdt: num(form.packaging_box_cost_bdt),
      bubble_wrap_cost_bdt: num(form.bubble_wrap_cost_bdt),
      sticker_label_cost_bdt: num(form.sticker_label_cost_bdt),
      customer_delivery_courier_bdt: num(form.customer_delivery_courier_bdt),
      facebook_ad_cost_bdt: num(form.facebook_ad_cost_bdt),
      landed_cost_per_bag_bdt: Math.round(landedCost * 100) / 100,
      total_cost_per_bag_bdt: Math.round(totalCostPerBag * 100) / 100,
      net_profit_per_bag_bdt: Math.round(netProfitPerBag * 100) / 100,
      net_margin_pct: Math.round(netMarginPct * 100) / 100,
      selling_price_bdt: effectiveSellingPrice,
    });

    if (invErr) { setSaving(false); toast.show('Bag created but inventory row failed.', 'error'); onSaved(); onClose(); return; }

    if (colors.length > 0) {
      const variantRows = colors.map((c) => ({ bag_id: bagIdToUse, color_name: c, sku: generateSku(c), stock_qty: Number(colorStock[c]) || 0 }));
      const { error: varErr } = await supabase.from('bag_variants').insert(variantRows);
      if (varErr) toast.show('Bag created but color variants failed to save.', 'error');
    }

    setSaving(false);
    toast.show('New bag added to inventory.', 'success');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Bag" size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Bag ID / Model Code</label>
          <input value={form.bag_id} onChange={(e) => setForm({ ...form, bag_id: e.target.value })} placeholder="Auto-generated from name" className="input" />
          <p className="mt-1 text-xs text-slate-400">Leave blank to auto-generate. Full SKU: {autoBagId || 'MZ-...'}</p>
        </div>
        <div>
          <label className="label">Bag Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Crescent Shoulder Bag" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Link to Sourcing Batch (optional)</label>
          <select value={form.sourcing_order_id} onChange={(e) => setForm({ ...form, sourcing_order_id: e.target.value })} className="input">
            <option value="">Standalone (no batch)</option>
            {sourcingOrders.map((s) => (
              <option key={s.id} value={s.id}>{s.agent_name} — {s.batch_invoice_id ?? 'No Invoice'} ({formatBDT(s.total_final_price_bdt)})</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Category (optional)</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Tote, Shoulder, Backpack..." className="input" />
        </div>
      </div>

      <div className="mt-5">
        <label className="label">Available Colors & Per-Color Stock</label>
        <ColorTagsInput value={colors} onChange={setColors} placeholder="Type a color name and press Enter" />
        {colors.length > 0 && (
          <div className="mt-3 space-y-2">
            {colors.map((c) => (
              <div key={c} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{c.charAt(0).toUpperCase()}</span>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{c}</span>
                <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">{generateSku(c)}</span>
                <input type="number" min={0} value={colorStock[c] ?? ''} onChange={(e) => setColorStock({ ...colorStock, [c]: e.target.value })} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" placeholder="Qty" />
              </div>
            ))}
            <p className="text-xs text-slate-400">Total stock: <span className="font-semibold text-slate-600 dark:text-slate-300">{totalColorStock}</span> units across {colors.length} color{colors.length > 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Unit Costing Breakdown</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CostInput label="China Buying Price (BDT)" value={form.china_buying_cost_bdt} onChange={(v) => setForm({ ...form, china_buying_cost_bdt: v })} step="0.01" placeholder="264.10" />
          <CostInput label="Bag Weight (KG)" value={form.single_bag_weight_kg} onChange={(v) => setForm({ ...form, single_bag_weight_kg: v })} step="0.001" placeholder="0.400" />
          <CostInput label="Air Freight Rate (BDT/KG)" value={form.air_freight_rate_per_kg} onChange={(v) => setForm({ ...form, air_freight_rate_per_kg: v })} step="0.01" placeholder="750" />
          <CostInput label="China & BD Courier Share" value={form.china_bd_courier_share_bdt} onChange={(v) => setForm({ ...form, china_bd_courier_share_bdt: v })} step="0.01" placeholder="10" />
          <CostInput label="Packaging Box Cost" value={form.packaging_box_cost_bdt} onChange={(v) => setForm({ ...form, packaging_box_cost_bdt: v })} step="0.01" placeholder="40" />
          <CostInput label="Bubble Wrap Cost" value={form.bubble_wrap_cost_bdt} onChange={(v) => setForm({ ...form, bubble_wrap_cost_bdt: v })} step="0.01" placeholder="10" />
          <CostInput label="Sticker / Label Cost" value={form.sticker_label_cost_bdt} onChange={(v) => setForm({ ...form, sticker_label_cost_bdt: v })} step="0.01" placeholder="15" />
          <CostInput label="Customer Delivery Courier" value={form.customer_delivery_courier_bdt} onChange={(v) => setForm({ ...form, customer_delivery_courier_bdt: v })} step="0.01" placeholder="170" />
          <CostInput label="Facebook Ad / Boosting" value={form.facebook_ad_cost_bdt} onChange={(v) => setForm({ ...form, facebook_ad_cost_bdt: v })} step="0.01" placeholder="100" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Target Profit Margin (%)</label>
          <input
            type="number"
            step="1"
            min={0}
            max={99}
            value={targetMargin}
            onChange={(e) => setTargetMargin(e.target.value)}
            placeholder="45"
            className="input"
          />
          <p className="mt-1 text-xs text-slate-400">Default 45%. Change to any target.</p>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="label !mb-0">Target Selling Price (BDT)</label>
            <div className="flex items-center gap-3">
              {suggestedPrice > 0 && (
                <button type="button" onClick={() => { setForm({ ...form, selling_price_bdt: String(suggestedPrice) }); setPriceTouched(true); }} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50">
                  Apply Suggested {formatBDT(suggestedPrice)}
                </button>
              )}
              {priceTouched && (
                <button type="button" onClick={() => setPriceTouched(false)} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                  <RotateCcw size={12} /> Reset to auto
                </button>
              )}
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            min={0}
            value={priceTouched ? form.selling_price_bdt : (suggestedPrice > 0 ? String(suggestedPrice) : '')}
            onChange={(e) => { setPriceTouched(true); setForm({ ...form, selling_price_bdt: e.target.value }); }}
            placeholder="Auto-calculated"
            className={`input text-lg font-semibold ${priceTouched ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'}`}
          />
          {!priceTouched && suggestedPrice > 0 && (
            <p className="mt-1 text-xs text-slate-400">Auto-suggested for {targetMargin || '0'}% margin (rounded up to nearest 10 BDT)</p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Calculator size={16} className="text-brand-600" /> Real-Time Cost & Profit Breakdown
        </div>
        <div className="rounded-lg bg-white p-3 dark:bg-slate-900/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Landed Cost</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Calc label="Buying Price" value={formatBDT(num(form.china_buying_cost_bdt))} />
            <Calc label={`Air Shipping (${num(form.single_bag_weight_kg)}kg × ${num(form.air_freight_rate_per_kg)})`} value={formatBDT(airShipping)} />
            <Calc label="Courier Share" value={formatBDT(num(form.china_bd_courier_share_bdt))} />
            <Calc label="Landed Cost" value={formatBDT(landedCost)} highlight />
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-white p-3 dark:bg-slate-900/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Total Cost Per Bag</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Calc label={`Packaging (${formatBDT(packagingTotal)})`} value={formatBDT(packagingTotal)} />
            <Calc label="Delivery Courier" value={formatBDT(num(form.customer_delivery_courier_bdt))} />
            <Calc label="Facebook Ad" value={formatBDT(num(form.facebook_ad_cost_bdt))} />
            <Calc label="Total Cost / Bag" value={formatBDT(totalCostPerBag)} highlight />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gradient-to-r from-brand-50 to-emerald-50 p-4 dark:from-brand-900/20 dark:to-emerald-900/20">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Selling Price</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatBDT(effectiveSellingPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Profit / Bag</p>
            <p className={`text-lg font-bold ${netProfitPerBag >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatBDT(netProfitPerBag)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Margin %</p>
            <p className={`text-lg font-bold ${netMarginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : netMarginPct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{netMarginPct.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null} Add Bag
        </button>
      </div>
    </Modal>
  );
}

function CostInput({ label, value, onChange, step, placeholder }: { label: string; value: string; onChange: (v: string) => void; step: string; placeholder: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step={step} min={0} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" />
    </div>
  );
}

function Calc({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-brand-700 dark:text-brand-300 text-base' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}
