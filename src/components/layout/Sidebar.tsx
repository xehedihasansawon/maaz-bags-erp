import { useState } from 'react';
import {
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Users,
  LayoutDashboard,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Role } from '@/types';

export type ModuleKey =
  | 'dashboard'
  | 'sourcing'
  | 'inventory'
  | 'sales'
  | 'delivery'
  | 'analytics'
  | 'users';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: typeof Package;
  roles: Role[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
  { key: 'sales', label: 'Sales Orders', icon: ShoppingCart, roles: ['admin', 'staff'] },
  { key: 'delivery', label: 'Delivery & Courier', icon: Truck, roles: ['admin', 'staff'] },
  { key: 'sourcing', label: 'Sourcing Agent Ledger', icon: ClipboardList, roles: ['admin'] },
  { key: 'inventory', label: 'Costing & Live Inventory', icon: Package, roles: ['admin'] },
  { key: 'analytics', label: 'Accounts & Profit', icon: BarChart3, roles: ['admin'] },
  { key: 'users', label: 'User Management', icon: Users, roles: ['admin'] },
];

interface SidebarProps {
  active: ModuleKey;
  onNavigate: (key: ModuleKey) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role ?? 'staff';
  const items = navItems.filter((i) => i.roles.includes(role));

  const handleNav = (key: ModuleKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => handleNav(item.key)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={18} className={isActive ? '' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {profile?.full_name ?? 'User'}
          </p>
          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{role}</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <div className="flex items-center gap-2">
          <ShoppingBag size={22} className="text-brand-600" />
          <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100">
            MAAZ <span className="text-brand-600">BAGS</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                MAAZ <span className="text-brand-600">BAGS</span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">ERP System</p>
            </div>
          </div>
          <button
            onClick={toggle}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        {nav}
        <div className="flex-1" />
        {footer}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white animate-slide-up dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <ShoppingBag size={20} />
                </div>
                <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  MAAZ <span className="text-brand-600">BAGS</span>
                </p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            <div className="flex-1" />
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
