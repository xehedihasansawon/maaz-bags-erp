import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, Package, Megaphone,
  AlertTriangle, PiggyBank, Shield, Wallet, Plus, Trash2, Banknote,
  Calendar, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, Users, Award, Truck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  SalesOrder, Expense, ExpenseCategory, Vault, VaultTransaction, VaultTransactionType,
  Withdrawal, WithdrawalStatus, Partner, Dividend, DividendStatus,
  AccountingPeriod, AccountingPeriodStatus,
} from '@/types';
import { formatBDT, formatNumber, formatDate, formatDateTime, todayInputDate, monthKey, monthLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

type Tab = 'overview' | 'periods' | 'vaults' | 'withdrawals' | 'dividends';

export function AnalyticsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultTxns, setVaultTxns] = useState<VaultTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayInputDate());
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [dividendModalOpen, setDividendModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [vaultTxnModalOpen, setVaultTxnModalOpen] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const [so, ex, vt, wd, pt, dv, pr, ap] = await Promise.all([
      supabase.from('sales_orders').select('*').order('order_date', { ascending: true }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('vaults').select('*').order('allocation_percent'),
      supabase.from('vault_transactions').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('withdrawals').select('*').order('requested_at', { ascending: false }),
      supabase.from('dividends').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('name'),
      supabase.from('accounting_periods').select('*').order('start_date', { ascending: false }),
    ]);
    setOrders((so.data as SalesOrder[]) ?? []);
    setExpenses((ex.data as Expense[]) ?? []);
    setVaults((vt.data as Vault[]) ?? []);
    setVaultTxns((wd.data as VaultTransaction[]) ?? []);
    setWithdrawals((wd.data as Withdrawal[]) ?? []);
    setPartners((pt.data as Partner[]) ?? []);
    setDividends((dv.data as Dividend[]) ?? []);
    setPeriods((ap.data as AccountingPeriod[]) ?? []);
    if (so.error) toast.show('Failed to load orders.', 'error');
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = o.order_date;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.expense_date;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [expenses, fromDate, toDate]);

  const metrics = useMemo(() => {
    const delivered = filteredOrders.filter((o) => o.order_status === 'delivered' || o.delivery_status === 'delivered');
    const returned = filteredOrders.filter((o) => o.order_status === 'returned' || o.delivery_status === 'returned');
    const inTransit = filteredOrders.filter((o) => ['dispatched', 'in_transit', 'out_for_delivery'].includes(o.order_status) || o.delivery_status === 'in_transit');
    const placed = filteredOrders.length;

    const successRate = delivered.length + returned.length > 0
      ? (delivered.length / (delivered.length + returned.length)) * 100
      : 0;

    const revenue = delivered.reduce((s, o) => s + Number(o.selling_price_bdt) * o.quantity, 0);
    const cogs = delivered.reduce((s, o) => s + Number(o.landed_cost_per_bag_bdt) * o.quantity, 0);
    const adSpend = filteredExpenses.filter((e) => e.category === 'marketing').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const returnLoss = filteredExpenses.filter((e) => e.category === 'return_charge').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const miscOps = filteredExpenses.filter((e) => e.category === 'operational').reduce((s, e) => s + Number(e.amount_bdt), 0);
    const courierCharges = delivered.reduce((s, o) => s + Number(o.courier_delivery_fee_bdt) + Number(o.courier_return_charge_bdt), 0);

    const netProfit = revenue - (cogs + adSpend + returnLoss + miscOps + courierCharges);

    return { placed, delivered: delivered.length, inTransit: inTransit.length, returned: returned.length, successRate, revenue, cogs, adSpend, returnLoss, miscOps, courierCharges, netProfit };
  }, [filteredOrders, filteredExpenses]);

  const allocation = useMemo(() => {
    const profit = Math.max(0, metrics.netProfit);
    return vaults.map((v) => ({
      ...v,
      computedAmount: (profit * Number(v.allocation_percent)) / 100,
    }));
  }, [metrics.netProfit, vaults]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { revenue: number; expense: number; profit: number }>();
    for (const o of filteredOrders) {
      if (o.order_status !== 'delivered' && o.delivery_status !== 'delivered') continue;
      const k = monthKey(o.order_date);
      const cur = map.get(k) ?? { revenue: 0, expense: 0, profit: 0 };
      cur.revenue += Number(o.selling_price_bdt) * o.quantity;
      cur.expense += Number(o.landed_cost_per_bag_bdt) * o.quantity;
      cur.profit += (Number(o.selling_price_bdt) - Number(o.landed_cost_per_bag_bdt)) * o.quantity;
      map.set(k, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredOrders]);

  const topBags = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of filteredOrders) {
      if (o.order_status !== 'delivered' && o.delivery_status !== 'delivered') continue;
      const cur = map.get(o.bag_id) ?? { name: o.bag_name, qty: 0, revenue: 0 };
      cur.qty += o.quantity;
      cur.revenue += Number(o.selling_price_bdt) * o.quantity;
      map.set(o.bag_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredOrders]);

  const maxMonthlyRevenue = Math.max(1, ...monthlyTrend.map((m) => m[1].revenue));
  const maxTopBagQty = Math.max(1, ...topBags.map((b) => b.qty));

  const handleDeleteExpense = async (e: Expense) => {
    if (!confirm(`Delete expense "${e.description ?? e.category}"?`)) return;
    const { error } = await supabase.from('expenses').delete().eq('id', e.id);
    if (error) toast.show('Failed to delete expense.', 'error');
    else { toast.show('Expense deleted.', 'success'); load(); }
  };

  const updateWithdrawalStatus = async (w: Withdrawal, status: WithdrawalStatus) => {
    const update: Record<string, unknown> = { status };
    if (status === 'approved') { update.approved_by = profile?.id ?? null; update.approved_at = new Date().toISOString(); }
    if (status === 'paid') { update.paid_at = new Date().toISOString(); }
    const { error } = await supabase.from('withdrawals').update(update).eq('id', w.id);
    if (error) toast.show('Failed to update withdrawal.', 'error');
    else { toast.show('Withdrawal updated.', 'success'); load(); }
  };

  const updateDividendStatus = async (d: Dividend, status: DividendStatus) => {
    const update: Record<string, unknown> = { status };
    if (status === 'approved') { update.approved_by = profile?.id ?? null; update.approved_at = new Date().toISOString(); }
    if (status === 'paid') { update.paid_at = new Date().toISOString(); }
    const { error } = await supabase.from('dividends').update(update).eq('id', d.id);
    if (error) toast.show('Failed to update dividend.', 'error');
    else { toast.show('Dividend updated.', 'success'); load(); }
  };

  const closePeriod = async (p: AccountingPeriod) => {
    if (!confirm(`Close accounting period "${p.period_name}"? This will lock it from further edits.`)) return;
    const { error } = await supabase.from('accounting_periods').update({ status: 'closed', closed_by: profile?.id ?? null }).eq('id', p.id);
    if (error) toast.show('Failed to close period.', 'error');
    else { toast.show('Period closed.', 'success'); load(); }
  };

  const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'periods', label: 'Accounting Periods', icon: Calendar },
    { key: 'vaults', label: 'Profit Vaults', icon: Shield },
    { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
    { key: 'dividends', label: 'Dividends', icon: Award },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Accounts & Profit Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Revenue, vaults, withdrawals, dividends, and accounting periods</p>
        </div>
        <div className="flex gap-2">
          {tab === 'overview' && (
            <button onClick={() => setExpenseModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Add Expense
            </button>
          )}
          {tab === 'periods' && (
            <button onClick={() => setPeriodModalOpen(true)} className="btn-primary">
              <Plus size={16} /> New Period
            </button>
          )}
          {tab === 'vaults' && (
            <button onClick={() => setVaultTxnModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Vault Transaction
            </button>
          )}
          {tab === 'withdrawals' && (
            <button onClick={() => setWithdrawalModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Request Withdrawal
            </button>
          )}
          {tab === 'dividends' && (
            <button onClick={() => setDividendModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Add Dividend
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : tab === 'overview' ? (
        <>
          {/* Date filter */}
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <div>
              <label className="label">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
            </div>
            {(fromDate || toDate !== todayInputDate()) && (
              <button onClick={() => { setFromDate(''); setToDate(todayInputDate()); }} className="btn-ghost">Reset</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Orders Placed" value={formatNumber(metrics.placed)} icon={Package} tone="gray" />
            <MetricCard label="Delivered" value={formatNumber(metrics.delivered)} icon={TrendingUp} tone="green" />
            <MetricCard label="In Transit" value={formatNumber(metrics.inTransit)} icon={TrendingUp} tone="blue" />
            <MetricCard label="Returned" value={formatNumber(metrics.returned)} icon={TrendingDown} tone="red" />
            <MetricCard label="Success Rate" value={`${metrics.successRate.toFixed(1)}%`} icon={TrendingUp} tone="green" />
            <MetricCard label="Total Revenue" value={formatBDT(metrics.revenue)} icon={DollarSign} tone="green" />
            <MetricCard label="Total COGS" value={formatBDT(metrics.cogs)} icon={Package} tone="orange" />
            <MetricCard label="Ad Spend" value={formatBDT(metrics.adSpend)} icon={Megaphone} tone="purple" />
            <MetricCard label="Return Loss" value={formatBDT(metrics.returnLoss)} icon={AlertTriangle} tone="red" />
            <MetricCard label="Courier Charges" value={formatBDT(metrics.courierCharges)} icon={Truck} tone="gray" />
            <MetricCard label="Misc Operational" value={formatBDT(metrics.miscOps)} icon={Package} tone="gray" />
            <MetricCard label="Net Profit" value={formatBDT(metrics.netProfit)} icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown} tone={metrics.netProfit >= 0 ? 'green' : 'red'} highlight />
          </div>

          {/* 50-30-20 Vault Allocation */}
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Profit Vault Allocation</h2>
            {metrics.netProfit <= 0 ? (
              <p className="text-sm text-slate-400">No profit to allocate in this period.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {allocation.map((v) => {
                  const Icon = v.name.toLowerCase().includes('reinvest') ? Package : v.name.toLowerCase().includes('reserve') ? Shield : Wallet;
                  const tone = v.name.toLowerCase().includes('reinvest') ? 'blue' : v.name.toLowerCase().includes('reserve') ? 'amber' : 'green';
                  return (
                    <AllocCard
                      key={v.id}
                      label={v.name}
                      percent={`${Number(v.allocation_percent)}%`}
                      value={v.computedAmount}
                      vaultBalance={Number(v.current_balance_bdt)}
                      icon={Icon}
                      tone={tone as 'blue' | 'amber' | 'green'}
                      desc={v.description ?? ''}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Monthly Profit Trend</h2>
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-slate-400">No delivered orders in this period.</p>
              ) : (
                <div className="space-y-3">
                  {monthlyTrend.map(([k, v]) => (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{monthLabel(k)}</span>
                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(v.profit)}</span>
                      </div>
                      <div className="h-6 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 transition-all" style={{ width: `${(v.revenue / maxMonthlyRevenue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Top Selling Bags</h2>
              {topBags.length === 0 ? (
                <p className="text-sm text-slate-400">No delivered orders in this period.</p>
              ) : (
                <div className="space-y-3">
                  {topBags.map((b, i) => (
                    <div key={i}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{b.name}</span>
                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">{b.qty} sold</span>
                      </div>
                      <div className="h-6 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${(b.qty / maxTopBagQty) * 100}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{formatBDT(b.revenue)} revenue</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revenue vs Expense */}
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Revenue vs Expense Summary</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryItem label="Revenue" value={formatBDT(metrics.revenue)} color="text-emerald-600 dark:text-emerald-400" />
              <SummaryItem label="COGS" value={formatBDT(metrics.cogs)} color="text-orange-600 dark:text-orange-400" />
              <SummaryItem label="Ad + Misc" value={formatBDT(metrics.adSpend + metrics.miscOps)} color="text-violet-600 dark:text-violet-400" />
              <SummaryItem label="Return + Courier" value={formatBDT(metrics.returnLoss + metrics.courierCharges)} color="text-rose-600 dark:text-rose-400" />
            </div>
          </div>

          {/* Expenses list */}
          <div className="card">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Expense Records</h2>
            </div>
            {filteredExpenses.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No expenses recorded in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(e.expense_date)}</td>
                        <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">{e.category.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{e.description ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(e.amount_bdt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button onClick={() => handleDeleteExpense(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : tab === 'periods' ? (
        <PeriodsTab periods={periods} onClosePeriod={closePeriod} />
      ) : tab === 'vaults' ? (
        <VaultsTab vaults={vaults} vaultTxns={vaultTxns} />
      ) : tab === 'withdrawals' ? (
        <WithdrawalsTab withdrawals={withdrawals} vaults={vaults} onUpdateStatus={updateWithdrawalStatus} />
      ) : (
        <DividendsTab dividends={dividends} partners={partners} onUpdateStatus={updateDividendStatus} />
      )}

      <ExpenseModal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} onSaved={load} />
      <WithdrawalModal open={withdrawalModalOpen} onClose={() => setWithdrawalModalOpen(false)} onSaved={load} vaults={vaults} />
      <DividendModal open={dividendModalOpen} onClose={() => setDividendModalOpen(false)} onSaved={load} partners={partners} periods={periods} />
      <PeriodModal open={periodModalOpen} onClose={() => setPeriodModalOpen(false)} onSaved={load} />
      <VaultTxnModal open={vaultTxnModalOpen} onClose={() => setVaultTxnModalOpen(false)} onSaved={load} vaults={vaults} />
    </div>
  );
}

// ---- Periods Tab ----
function PeriodsTab({ periods, onClosePeriod }: { periods: AccountingPeriod[]; onClosePeriod: (p: AccountingPeriod) => void }) {
  const statusMeta: Record<AccountingPeriodStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }> = {
    open: { label: 'Open', color: 'green' },
    pending_reconciliation: { label: 'Pending Reconciliation', color: 'yellow' },
    ready_to_close: { label: 'Ready to Close', color: 'blue' },
    closed: { label: 'Closed', color: 'gray' },
    allocated: { label: 'Allocated', color: 'purple' },
  };
  return (
    <div className="card">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Accounting Periods</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Monthly or quarterly profit periods with reconciliation</p>
      </div>
      {periods.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">No accounting periods created yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Date Range</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">COGS</th>
                <th className="px-4 py-3 text-right font-semibold">Net Profit</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const meta = statusMeta[p.status];
                return (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.period_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(p.delivered_revenue_bdt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(p.landed_cogs_bdt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(p.net_profit_bdt)}</td>
                    <td className="px-4 py-3"><Badge variant={meta.color}>{meta.label}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {p.status !== 'closed' ? (
                        <button onClick={() => onClosePeriod(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title="Close period">
                          <Lock size={15} />
                        </button>
                      ) : (
                        <Lock size={15} className="ml-auto text-slate-300" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Vaults Tab ----
function VaultsTab({ vaults, vaultTxns }: { vaults: Vault[]; vaultTxns: VaultTransaction[] }) {
  const txnTypeMeta: Record<VaultTransactionType, { label: string; color: 'green' | 'red' | 'gray' | 'blue' }> = {
    deposit: { label: 'Deposit', color: 'green' },
    withdrawal: { label: 'Withdrawal', color: 'red' },
    adjustment: { label: 'Adjustment', color: 'gray' },
    opening_balance: { label: 'Opening', color: 'blue' },
    closing_balance: { label: 'Closing', color: 'blue' },
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {vaults.map((v) => (
          <div key={v.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{v.name}</h3>
              <Badge variant="blue">{Number(v.allocation_percent)}%</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{v.description ?? '—'}</p>
            <div className="mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Current Balance</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBDT(v.current_balance_bdt)}</p>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Opening: {formatBDT(v.opening_balance_bdt)}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Vault Transactions</h2>
        </div>
        {vaultTxns.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No vault transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {vaultTxns.map((t) => {
                  const meta = txnTypeMeta[t.type];
                  const vault = vaults.find((v) => v.id === t.vault_id);
                  return (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-3"><Badge variant={meta.color}>{meta.label}</Badge></td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${t.type === 'withdrawal' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {t.type === 'withdrawal' ? '−' : '+'}{formatBDT(t.amount_bdt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatBDT(t.balance_after_bdt)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {t.description ?? '—'}
                        {vault && <span className="ml-1 text-xs text-slate-400">({vault.name})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Withdrawals Tab ----
function WithdrawalsTab({ withdrawals, vaults, onUpdateStatus }: { withdrawals: Withdrawal[]; vaults: Vault[]; onUpdateStatus: (w: Withdrawal, s: WithdrawalStatus) => void }) {
  const statusMeta: Record<WithdrawalStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' }> = {
    requested: { label: 'Requested', color: 'yellow' },
    approved: { label: 'Approved', color: 'blue' },
    rejected: { label: 'Rejected', color: 'red' },
    paid: { label: 'Paid', color: 'green' },
  };
  return (
    <div className="card">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Withdrawals</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Approved cash outflows from profit vaults</p>
      </div>
      {withdrawals.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">No withdrawal requests yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">Requested</th>
                <th className="px-4 py-3 font-semibold">Vault</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const meta = statusMeta[w.status];
                const vault = vaults.find((v) => v.id === w.vault_id);
                return (
                  <tr key={w.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(w.requested_at)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{vault?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(w.amount_bdt)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{w.reason ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant={meta.color}>{meta.label}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{w.payment_reference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {w.status === 'requested' && (
                          <>
                            <button onClick={() => onUpdateStatus(w, 'approved')} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30" title="Approve"><TrendingUp size={15} /></button>
                            <button onClick={() => onUpdateStatus(w, 'rejected')} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" title="Reject"><TrendingDown size={15} /></button>
                          </>
                        )}
                        {w.status === 'approved' && (
                          <button onClick={() => onUpdateStatus(w, 'paid')} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30" title="Mark as paid"><DollarSign size={15} /></button>
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
  );
}

// ---- Dividends Tab ----
function DividendsTab({ dividends, partners, onUpdateStatus }: { dividends: Dividend[]; partners: Partner[]; onUpdateStatus: (d: Dividend, s: DividendStatus) => void }) {
  const statusMeta: Record<DividendStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' }> = {
    calculated: { label: 'Calculated', color: 'yellow' },
    approved: { label: 'Approved', color: 'blue' },
    payable: { label: 'Payable', color: 'gray' },
    paid: { label: 'Paid', color: 'green' },
  };
  return (
    <div className="space-y-5">
      {/* Partners list */}
      <div className="card">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Users size={18} /> Partners</h2>
        </div>
        {partners.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No partners configured yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                  <Badge variant={p.active ? 'green' : 'gray'}>{p.active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">Dividend: {Number(p.dividend_percent)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dividends table */}
      <div className="card">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Award size={18} /> Dividend Payments</h2>
        </div>
        {dividends.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No dividends recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Partner</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d) => {
                  const meta = statusMeta[d.status];
                  const partner = partners.find((p) => p.id === d.partner_id);
                  return (
                    <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(d.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{partner?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatBDT(d.amount_bdt)}</td>
                      <td className="px-4 py-3"><Badge variant={meta.color}>{meta.label}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{d.payment_reference ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {d.status === 'calculated' && (
                            <button onClick={() => onUpdateStatus(d, 'approved')} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30" title="Approve"><TrendingUp size={15} /></button>
                          )}
                          {d.status === 'approved' && (
                            <button onClick={() => onUpdateStatus(d, 'paid')} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30" title="Mark as paid"><DollarSign size={15} /></button>
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
    </div>
  );
}

// ---- Shared components ----
function MetricCard({ label, value, icon: Icon, tone, highlight }: { label: string; value: string; icon: typeof DollarSign; tone: 'gray' | 'green' | 'blue' | 'red' | 'orange' | 'purple'; highlight?: boolean }) {
  const tones = {
    gray: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400',
  };
  return (
    <div className={`card p-4 ${highlight ? 'ring-2 ring-brand-500/30' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={16} /></div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-bold ${highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

function AllocCard({ label, percent, value, vaultBalance, icon: Icon, tone, desc }: { label: string; percent: string; value: number; vaultBalance: number; icon: typeof Package; tone: 'blue' | 'amber' | 'green'; desc: string }) {
  const tones = { blue: 'from-blue-500 to-blue-600', amber: 'from-amber-500 to-amber-600', green: 'from-emerald-500 to-emerald-600' };
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]} text-white`}><Icon size={20} /></div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{percent}</span>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{formatBDT(value)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Vault Balance: {formatBDT(vaultBalance)}</p>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return <div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className={`text-lg font-bold ${color}`}>{value}</p></div>;
}

// ---- Modals ----
function ExpenseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ expense_date: todayInputDate(), category: 'marketing' as ExpenseCategory, description: '', amount_bdt: 0 });
  useEffect(() => { if (open) setForm({ expense_date: todayInputDate(), category: 'marketing', description: '', amount_bdt: 0 }); }, [open]);
  const submit = async () => {
    if (form.amount_bdt <= 0) { toast.show('Amount must be greater than 0.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({ expense_date: form.expense_date, category: form.category, description: form.description.trim() || null, amount_bdt: Number(form.amount_bdt) });
    setSaving(false);
    if (error) { toast.show('Failed to add expense.', 'error'); return; }
    toast.show('Expense added.', 'success'); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Expense" size="md">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className="label">Expense Date</label><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input" /></div>
        <div><label className="label">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className="input"><option value="marketing">Marketing / Ad Spend</option><option value="operational">Operational</option><option value="return_charge">Return Charge</option></select></div>
        <div className="sm:col-span-2"><label className="label">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Facebook Ads - August" className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Amount (BDT)</label><input type="number" step="0.01" min={0} value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: Number(e.target.value) })} className="input" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Add Expense</button></div>
    </Modal>
  );
}

function WithdrawalModal({ open, onClose, onSaved, vaults }: { open: boolean; onClose: () => void; onSaved: () => void; vaults: Vault[] }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vault_id: '', amount_bdt: 0, reason: '', payment_reference: '' });
  useEffect(() => { if (open) setForm({ vault_id: vaults[0]?.id ?? '', amount_bdt: 0, reason: '', payment_reference: '' }); }, [open, vaults]);
  const submit = async () => {
    if (!form.vault_id) { toast.show('Select a vault.', 'error'); return; }
    if (form.amount_bdt <= 0) { toast.show('Amount must be greater than 0.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('withdrawals').insert({ vault_id: form.vault_id, amount_bdt: Number(form.amount_bdt), reason: form.reason.trim() || null, status: 'requested', payment_reference: form.payment_reference.trim() || null });
    setSaving(false);
    if (error) { toast.show('Failed to request withdrawal.', 'error'); return; }
    toast.show('Withdrawal requested.', 'success'); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Request Withdrawal" size="md">
      <div className="space-y-4">
        <div><label className="label">Vault</label><select value={form.vault_id} onChange={(e) => setForm({ ...form, vault_id: e.target.value })} className="input"><option value="">Select vault...</option>{vaults.map((v) => <option key={v.id} value={v.id}>{v.name} ({formatBDT(v.current_balance_bdt)})</option>)}</select></div>
        <div><label className="label">Amount (BDT)</label><input type="number" step="0.01" min={0} value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: Number(e.target.value) })} className="input" /></div>
        <div><label className="label">Reason</label><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Purchase new stock" className="input" /></div>
        <div><label className="label">Payment Reference</label><input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} placeholder="bKash / bank TrxID" className="input" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Request</button></div>
    </Modal>
  );
}

function DividendModal({ open, onClose, onSaved, partners, periods }: { open: boolean; onClose: () => void; onSaved: () => void; partners: Partner[]; periods: AccountingPeriod[] }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ partner_id: '', accounting_period_id: '', amount_bdt: 0, payment_reference: '' });
  useEffect(() => { if (open) setForm({ partner_id: partners[0]?.id ?? '', accounting_period_id: '', amount_bdt: 0, payment_reference: '' }); }, [open, partners]);
  const submit = async () => {
    if (!form.partner_id) { toast.show('Select a partner.', 'error'); return; }
    if (form.amount_bdt <= 0) { toast.show('Amount must be greater than 0.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('dividends').insert({ partner_id: form.partner_id, accounting_period_id: form.accounting_period_id || null, amount_bdt: Number(form.amount_bdt), status: 'calculated', payment_reference: form.payment_reference.trim() || null });
    setSaving(false);
    if (error) { toast.show('Failed to add dividend.', 'error'); return; }
    toast.show('Dividend added.', 'success'); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Dividend" size="md">
      <div className="space-y-4">
        <div><label className="label">Partner</label><select value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })} className="input"><option value="">Select partner...</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({Number(p.dividend_percent)}%)</option>)}</select></div>
        <div><label className="label">Accounting Period (optional)</label><select value={form.accounting_period_id} onChange={(e) => setForm({ ...form, accounting_period_id: e.target.value })} className="input"><option value="">None</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.period_name}</option>)}</select></div>
        <div><label className="label">Amount (BDT)</label><input type="number" step="0.01" min={0} value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: Number(e.target.value) })} className="input" /></div>
        <div><label className="label">Payment Reference</label><input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} placeholder="bKash / bank TrxID" className="input" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Add Dividend</button></div>
    </Modal>
  );
}

function PeriodModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ period_name: '', start_date: todayInputDate(), end_date: todayInputDate() });
  useEffect(() => { if (open) setForm({ period_name: '', start_date: todayInputDate(), end_date: todayInputDate() }); }, [open]);
  const submit = async () => {
    if (!form.period_name.trim()) { toast.show('Period name is required.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('accounting_periods').insert({ period_name: form.period_name.trim(), start_date: form.start_date, end_date: form.end_date, status: 'open' });
    setSaving(false);
    if (error) { toast.show('Failed to create period.', 'error'); return; }
    toast.show('Accounting period created.', 'success'); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New Accounting Period" size="md">
      <div className="space-y-4">
        <div><label className="label">Period Name</label><input value={form.period_name} onChange={(e) => setForm({ ...form, period_name: e.target.value })} placeholder="e.g. August 2026" className="input" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Start Date</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" /></div>
          <div><label className="label">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" /></div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Create Period</button></div>
    </Modal>
  );
}

function VaultTxnModal({ open, onClose, onSaved, vaults }: { open: boolean; onClose: () => void; onSaved: () => void; vaults: Vault[] }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vault_id: '', type: 'deposit' as VaultTransactionType, amount_bdt: 0, description: '', transaction_reference: '' });
  useEffect(() => { if (open) setForm({ vault_id: vaults[0]?.id ?? '', type: 'deposit', amount_bdt: 0, description: '', transaction_reference: '' }); }, [open, vaults]);
  const submit = async () => {
    if (!form.vault_id) { toast.show('Select a vault.', 'error'); return; }
    if (form.amount_bdt <= 0) { toast.show('Amount must be greater than 0.', 'error'); return; }
    setSaving(true);
    const vault = vaults.find((v) => v.id === form.vault_id);
    const amount = Number(form.amount_bdt);
    const currentBal = Number(vault?.current_balance_bdt ?? 0);
    const newBalance = form.type === 'withdrawal' ? currentBal - amount : currentBal + amount;
    const { error } = await supabase.from('vault_transactions').insert({
      vault_id: form.vault_id, type: form.type, amount_bdt: amount, balance_after_bdt: Math.round(newBalance * 100) / 100,
      description: form.description.trim() || null, transaction_reference: form.transaction_reference.trim() || null,
    });
    if (error) { setSaving(false); toast.show('Failed to add transaction.', 'error'); return; }
    // Update vault balance
    await supabase.from('vaults').update({ current_balance_bdt: Math.round(newBalance * 100) / 100 }).eq('id', form.vault_id);
    setSaving(false);
    toast.show('Vault transaction added.', 'success'); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Vault Transaction" size="md">
      <div className="space-y-4">
        <div><label className="label">Vault</label><select value={form.vault_id} onChange={(e) => setForm({ ...form, vault_id: e.target.value })} className="input"><option value="">Select vault...</option>{vaults.map((v) => <option key={v.id} value={v.id}>{v.name} ({formatBDT(v.current_balance_bdt)})</option>)}</select></div>
        <div><label className="label">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VaultTransactionType })} className="input"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="adjustment">Adjustment</option></select></div>
        <div><label className="label">Amount (BDT)</label><input type="number" step="0.01" min={0} value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: Number(e.target.value) })} className="input" /></div>
        <div><label className="label">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Reason / note" className="input" /></div>
        <div><label className="label">Transaction Reference</label><input value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} placeholder="bKash / bank TrxID" className="input" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Add Transaction</button></div>
    </Modal>
  );
}
