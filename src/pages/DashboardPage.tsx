import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Truck, Package, BarChart3, ArrowRight, Clock, CheckCircle2, XCircle, AlertTriangle,
  Banknote, Wallet, TrendingUp, Boxes, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SalesOrder, Inventory, Vault, Expense } from '@/types';
import { formatBDT, formatNumber, formatDate } from '@/lib/format';
import { orderStatusMeta } from '@/lib/status';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { ModuleKey } from '@/components/layout/Sidebar';

interface DashboardPageProps {
  onNavigate: (key: ModuleKey) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const queries = [
      supabase.from('sales_orders').select('*').order('order_date', { ascending: false }).limit(50),
    ] as const;
    if (isAdmin) {
      const [so, inv, vt, ex] = await Promise.all([
        ...queries,
        supabase.from('inventory').select('*'),
        supabase.from('vaults').select('*'),
        supabase.from('expenses').select('*'),
      ]);
      setOrders((so.data as SalesOrder[]) ?? []);
      setInventory((inv.data as Inventory[]) ?? []);
      setVaults((vt.data as Vault[]) ?? []);
      setExpenses((ex.data as Expense[]) ?? []);
    } else {
      const [so] = await Promise.all([...queries]);
      setOrders((so.data as SalesOrder[]) ?? []);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const delivered = orders.filter((o) => o.order_status === 'delivered' || o.delivery_status === 'delivered');
    const returned = orders.filter((o) => o.order_status === 'returned' || o.delivery_status === 'returned');
    const inTransit = orders.filter((o) =>
      ['dispatched', 'in_transit', 'out_for_delivery'].includes(o.order_status) ||
      o.delivery_status === 'in_transit'
    );
    const readyToShip = orders.filter((o) => o.order_status === 'ready_to_ship');
    const ordersToday = orders.filter((o) => o.order_date === today);
    const refused = orders.filter((o) => o.order_status === 'customer_refused');

    const successRate = delivered.length + returned.length + refused.length > 0
      ? (delivered.length / (delivered.length + returned.length + refused.length)) * 100
      : 0;

    const grossRevenue = delivered.reduce((s, o) => s + Number(o.selling_price_bdt) * o.quantity, 0);
    const deliveredCash = delivered.reduce((s, o) => s + Number(o.actual_cash_received_bdt), 0);
    const inTransitCash = inTransit.reduce((s, o) => s + Number(o.cod_amount_bdt), 0);
    const cogs = delivered.reduce((s, o) => s + Number(o.landed_cost_per_bag_bdt) * o.quantity, 0);
    const adSpend = expenses.filter((e) => e.category === 'marketing').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const miscOps = expenses.filter((e) => e.category === 'operational').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const returnLoss = expenses.filter((e) => e.category === 'return_charge').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const courierCharges = delivered.reduce((s, o) => s + Number(o.courier_delivery_fee_bdt) + Number(o.courier_return_charge_bdt), 0);
    const netProfit = grossRevenue - cogs - adSpend - miscOps - returnLoss - courierCharges;
    const availableCash = deliveredCash;

    return {
      total: orders.length,
      delivered: delivered.length,
      inTransit: inTransit.length,
      returned: returned.length,
      readyToShip: readyToShip.length,
      ordersToday: ordersToday.length,
      successRate,
      grossRevenue,
      deliveredCash,
      inTransitCash,
      netProfit,
      availableCash,
    };
  }, [orders, expenses]);

  const lowStockItems = useMemo(() => {
    return inventory
      .map((r) => ({
        ...r,
        available: r.received_qty - r.sold_qty - r.reserved_qty - r.damaged_qty - r.missing_qty,
      }))
      .filter((r) => r.available < 5)
      .slice(0, 5);
  }, [inventory]);

  const courierSnapshot = useMemo(() => {
    const map = new Map<string, { total: number; delivered: number; returned: number }>();
    for (const o of orders) {
      const c = o.courier_name;
      const cur = map.get(c) ?? { total: 0, delivered: 0, returned: 0 };
      cur.total++;
      if (o.order_status === 'delivered' || o.delivery_status === 'delivered') cur.delivered++;
      if (o.order_status === 'returned' || o.delivery_status === 'returned') cur.returned++;
      map.set(c, cur);
    }
    return Array.from(map.entries()).slice(0, 4);
  }, [orders]);

  const vaultSummary = useMemo(() => {
    return vaults.map((v) => ({
      ...v,
      computedAmount: stats.netProfit > 0 ? (stats.netProfit * Number(v.allocation_percent)) / 100 : 0,
    }));
  }, [vaults, stats.netProfit]);

  const quickLinks: { key: ModuleKey; label: string; icon: typeof Package; desc: string; roles: string[] }[] = [
    { key: 'sales', label: 'Sales Orders', icon: ShoppingCart, desc: 'Create & manage orders', roles: ['admin', 'staff'] },
    { key: 'delivery', label: 'Delivery & Courier', icon: Truck, desc: 'Track & settle deliveries', roles: ['admin', 'staff'] },
    { key: 'sourcing', label: 'Sourcing Agent Ledger', icon: Package, desc: 'Agent batch orders & payments', roles: ['admin'] },
    { key: 'inventory', label: 'Costing & Live Inventory', icon: Package, desc: 'Landed cost & live stock', roles: ['admin'] },
    { key: 'analytics', label: 'Accounts & Profit', icon: BarChart3, desc: 'Revenue & 50-30-20 split', roles: ['admin'] },
  ];

  const visibleLinks = quickLinks.filter((l) => l.roles.includes(profile?.role ?? 'staff'));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Here's what's happening with MAAZ BAGS today
        </p>
      </div>

      {/* Financial overview cards (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Gross Revenue" value={formatBDT(stats.grossRevenue)} icon={TrendingUp} tone="green" isCurrency />
          <StatCard label="Delivered Cash" value={formatBDT(stats.deliveredCash)} icon={Banknote} tone="green" isCurrency />
          <StatCard label="In-Transit Pipeline" value={formatBDT(stats.inTransitCash)} icon={Truck} tone="blue" isCurrency />
          <StatCard label="Available Cash" value={formatBDT(stats.availableCash)} icon={Wallet} tone="green" isCurrency />
          <StatCard label="Real Net Profit" value={formatBDT(stats.netProfit)} icon={BarChart3} tone={stats.netProfit >= 0 ? 'green' : 'red'} isCurrency />
          <StatCard label="Delivery Success" value={`${stats.successRate.toFixed(1)}%`} icon={CheckCircle2} tone="green" />
          <StatCard label="Orders Today" value={formatNumber(stats.ordersToday)} icon={ShoppingCart} tone="gray" />
          <StatCard label="Total Orders" value={formatNumber(stats.total)} icon={ShoppingCart} tone="gray" />
        </div>
      )}

      {/* Operational cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ready to Ship" value={formatNumber(stats.readyToShip)} icon={Package} tone="orange" />
        <StatCard label="In Transit" value={formatNumber(stats.inTransit)} icon={Clock} tone="blue" />
        <StatCard label="Delivered" value={formatNumber(stats.delivered)} icon={CheckCircle2} tone="green" />
        <StatCard label="Returned" value={formatNumber(stats.returned)} icon={XCircle} tone="red" />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.key}
                onClick={() => onNavigate(link.key)}
                className="card group flex items-center gap-4 p-4 text-left transition hover:shadow-card-hover"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{link.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{link.desc}</p>
                </div>
                <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recent Orders</h2>
            <button onClick={() => onNavigate('sales')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all
            </button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No orders yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {orders.slice(0, 6).map((o) => {
                const meta = orderStatusMeta[o.order_status] ?? deliveryFallback(o);
                return (
                  <div key={o.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{o.customer_name}</p>
                      <p className="text-xs text-slate-400">{o.bag_name} · {formatDate(o.order_date)}</p>
                    </div>
                    <Badge variant={meta.color}>{meta.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low stock alerts (admin only) */}
        {isAdmin && (
          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <AlertTriangle size={16} className="text-amber-500" />
                Low Stock Alerts
              </h2>
              <button onClick={() => onNavigate('inventory')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View all
              </button>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">All stock levels are healthy.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {lowStockItems.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.bag_name}</p>
                      <p className="text-xs text-slate-400">{r.bag_id}</p>
                    </div>
                    <Badge variant={r.available <= 0 ? 'red' : 'yellow'}>
                      {r.available} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Courier snapshot (admin only) */}
      {isAdmin && courierSnapshot.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Truck size={16} className="text-brand-600" />
              Courier Snapshot
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            {courierSnapshot.map(([name, s]) => (
              <div key={name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p>Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{s.total}</span></p>
                  <p>Delivered: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{s.delivered}</span></p>
                  <p>Returned: <span className="font-semibold text-rose-600 dark:text-rose-400">{s.returned}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 50-30-20 Vault Summary (admin only) */}
      {isAdmin && vaultSummary.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Wallet size={16} className="text-brand-600" />
              50-30-20 Vault Summary
            </h2>
            <button onClick={() => onNavigate('analytics')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View details
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
            {vaultSummary.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{v.name}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{Number(v.allocation_percent)}%</span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {formatBDT(v.computedAmount)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Vault Balance: {formatBDT(Number(v.current_balance_bdt))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function deliveryFallback(o: SalesOrder): { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' } {
  const map: Record<string, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' }> = {
    order_placed: { label: 'Order Placed', color: 'yellow' },
    packed: { label: 'Packed', color: 'purple' },
    in_transit: { label: 'In Transit', color: 'blue' },
    delivered: { label: 'Delivered', color: 'green' },
    returned: { label: 'Returned', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'gray' },
  };
  return map[o.delivery_status] ?? { label: 'Unknown', color: 'gray' };
}

function StatCard({
  label, value, icon: Icon, tone, isCurrency,
}: {
  label: string;
  value: string;
  icon: typeof ShoppingCart;
  tone: 'gray' | 'green' | 'blue' | 'red' | 'orange';
  isCurrency?: boolean;
}) {
  const tones = {
    gray: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`font-bold text-slate-900 dark:text-slate-100 ${isCurrency ? 'text-base' : 'text-xl'}`}>{value}</p>
      </div>
    </div>
  );
}
