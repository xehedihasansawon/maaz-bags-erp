import { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, Briefcase, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Profile, Role } from '@/types';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

export function UsersPage() {
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: false });
    if (error) toast.show('Failed to load users.', 'error');
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = async (p: Profile) => {
    const newRole: Role = p.role === 'admin' ? 'staff' : 'admin';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', p.id);
    if (error) {
      toast.show('Failed to update role.', 'error');
      return;
    }
    toast.show(`${p.full_name} is now ${newRole}.`, 'success');
    load();
    refreshProfile();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage team member roles and permissions</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {p.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">{p.full_name}</p>
                          <p className="text-xs text-slate-400">{p.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.role === 'admin' ? (
                        <Badge variant="blue"><Shield size={10} /> Admin</Badge>
                      ) : (
                        <Badge variant="gray"><Briefcase size={10} /> Staff</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => toggleRole(p)}
                          className="btn-secondary text-xs"
                        >
                          <UserCog size={14} />
                          Make {p.role === 'admin' ? 'Staff' : 'Admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Role Permissions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <Shield size={16} className="text-brand-600" />
              <p className="font-semibold text-slate-800 dark:text-slate-100">Admin (Owner)</p>
            </div>
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <li>Full access to all 5 modules</li>
              <li>View cost, pricing & profit data</li>
              <li>Manage supply orders & inventory</li>
              <li>Manage user roles</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <Briefcase size={16} className="text-slate-500" />
              <p className="font-semibold text-slate-800 dark:text-slate-100">Staff (BD Team)</p>
            </div>
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <li>Access to Sales Orders & Delivery only</li>
              <li>Create orders & update courier status</li>
              <li>Cannot view landed costs or profit</li>
              <li>Cannot access supply, inventory, or analytics</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
