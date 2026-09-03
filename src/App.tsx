import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import { LoginPage } from '@/pages/LoginPage';
import { Sidebar, ModuleKey } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SourcingPage } from '@/pages/SourcingPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { SalesPage } from '@/pages/SalesPage';
import { DeliveryPage } from '@/pages/DeliveryPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { UsersPage } from '@/pages/UsersPage';
import { Loader2 } from 'lucide-react';

function AppShell() {
  const { session, profile, loading } = useAuth();
  const [active, setActive] = useState<ModuleKey>('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  const role = profile.role;

  // Guard: staff can only access dashboard, sales, delivery
  const allowedModules: ModuleKey[] =
    role === 'admin'
      ? ['dashboard', 'sourcing', 'inventory', 'sales', 'delivery', 'analytics', 'users']
      : ['dashboard', 'sales', 'delivery'];

  const currentModule = allowedModules.includes(active) ? active : 'dashboard';

  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActive} />;
      case 'sourcing':
        return role === 'admin' ? <SourcingPage /> : <AccessDenied />;
      case 'inventory':
        return role === 'admin' ? <InventoryPage /> : <AccessDenied />;
      case 'sales':
        return <SalesPage />;
      case 'delivery':
        return <DeliveryPage />;
      case 'analytics':
        return role === 'admin' ? <AnalyticsPage /> : <AccessDenied />;
      case 'users':
        return role === 'admin' ? <UsersPage /> : <AccessDenied />;
      default:
        return <DashboardPage onNavigate={setActive} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar active={currentModule} onNavigate={setActive} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Access Denied</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        You don't have permission to view this module. Contact an admin for access.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
