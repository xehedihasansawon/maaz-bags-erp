import { useState, FormEvent } from 'react';
import { ShoppingBag, Mail, Lock, User, Shield, Briefcase, Moon, Sun, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Role } from '@/types';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email.trim(), password, fullName.trim() || 'Team Member', role);
      if (error) setError(error);
      else {
        setError(null);
        setMode('signin');
        setEmail(email.trim());
        // show a hint
        setError('Account created. Please sign in with your credentials.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-brand-50 to-slate-100 dark:from-slate-950 dark:via-brand-950 dark:to-slate-950">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <ShoppingBag size={22} />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              MAAZ <span className="text-brand-600">BAGS</span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">ERP & Order Management</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="card p-7">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {mode === 'signin'
                  ? 'Sign in to manage your bag business'
                  : 'Join the MAAZ BAGS team workspace'}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label" htmlFor="fullName">Full Name</label>
                  <div className="relative">
                    <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Maaz Rahman"
                      className="input pl-9"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@maazbags.com"
                    className="input pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-9"
                    required
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="label">Account Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                        role === 'admin'
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-900/20'
                          : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
                      }`}
                    >
                      <Shield size={18} className={role === 'admin' ? 'text-brand-600' : 'text-slate-400'} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Admin</p>
                        <p className="text-[11px] text-slate-500">Full access</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('staff')}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                        role === 'staff'
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-900/20'
                          : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
                      }`}
                    >
                      <Briefcase size={18} className={role === 'staff' ? 'text-brand-600' : 'text-slate-400'} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Staff</p>
                        <p className="text-[11px] text-slate-500">Orders & delivery</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            MAAZ BAGS ERP · Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
