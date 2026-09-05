import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError } from '@/lib/utils';

type AuthMode = 'login' | 'signup';

const SHIVAJI_IMG =
  'https://images.pexels.com/photos/38876932/pexels-photo-38876932.jpeg?auto=compress&cs=tinysrgb&h=160&w=160';

const GANPATI_BG =
  'https://images.pexels.com/photos/28288479/pexels-photo-28288479.jpeg?auto=compress&cs=tinysrgb&h=1080&w=1920';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name so the team can identify your entries.');
      return;
    }
    if (password.length < 6) {
      setError('Your password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    if (result.error) {
      setError(friendlyAuthError(result.error.message));
      setBusy(false);
      return;
    }

    if (mode === 'signup' && result.data.user) {
      if (result.data.session) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: result.data.user.id,
          display_name: name.trim(),
        });
        if (profileError) {
          setError('Your account was created, but we could not save your name. Please try again.');
        }
      } else {
        setNotice('Your account is ready. Check your email to confirm it, then sign in.');
        setMode('login');
      }
    }
    setBusy(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="fixed inset-0 -z-10">
        <img src={GANPATI_BG} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-50/85 backdrop-blur-sm" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src={SHIVAJI_IMG}
            alt="Chhatrapati Shivaji Maharaj"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-[#4f00f5]"
          />
          <h1 className="text-3xl font-bold tracking-tight text-[#172033]">Shivaji Youth</h1>
          <p className="mt-2 text-sm text-slate-500">Shared cash ledger for the whole team</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(35,42,65,0.08)] sm:p-8">
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-[#4f00f5] shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-[#4f00f5] shadow-sm' : 'text-slate-500'
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Join the youth team'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Sign in to view the team cash ledger.'
                : 'Create your member account to join the team.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-sm font-medium text-slate-700">
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohan Patil"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
                />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-600">{notice}</p>}
            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4f00f5] py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4200d1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in to ledger' : 'Create my account'}
            </button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Only signed-in team members can access the ledger
        </p>
      </div>
    </main>
  );
}
