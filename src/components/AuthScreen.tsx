import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GANPATI_BG, SHIVAJI_IMG } from '@/lib/theme';
import { friendlyAuthError } from '@/lib/utils';

type AuthMode = 'login' | 'signup';

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
    if (mode === 'signup') {
      const { data: isInvited } = await supabase.rpc('is_email_invited', {
        p_email: email.trim().toLowerCase(),
      });
      if (!isInvited) {
        setError('This email has not been invited. Ask a team admin to invite you first.');
        setBusy(false);
        return;
      }
    }

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: name.trim() } },
          });

    if (result.error) {
      const msg = result.error.message.toLowerCase();
      if (msg.includes('not on the team invite list') || msg.includes('invite')) {
        setError('This email has not been invited. Ask a team admin to invite you first.');
      } else {
        setError(friendlyAuthError(result.error.message));
      }
      setBusy(false);
      return;
    }

    if (mode === 'signup' && result.data.user && !result.data.session) {
      setNotice('Your account is ready. Check your email to confirm it, then sign in.');
      setMode('login');
    }
    setBusy(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="fixed inset-0 -z-10">
        <img src={GANPATI_BG} alt="" className="h-full w-full object-cover" />
        <div className="page-backdrop" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src={SHIVAJI_IMG}
            alt="Chhatrapati Shivaji Maharaj"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-brand-saffron-500"
          />
          <h1 className="text-3xl font-bold tracking-tight text-brand-maroon-900">Shivaji Youth</h1>
          <p className="mt-2 text-sm text-stone-500">Shared cash ledger · Invite-only</p>
        </div>

        <div className="card p-6 shadow-lift sm:p-8">
          <div className="mb-6 flex rounded-lg bg-brand-saffron-50 p-1 ring-1 ring-brand-saffron-100">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-brand-saffron-700 shadow-sm' : 'text-stone-500'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-brand-saffron-700 shadow-sm' : 'text-stone-500'
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-stone-900">
              {mode === 'login' ? 'Welcome back' : 'Join the youth team'}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {mode === 'login'
                ? 'Sign in to view the team cash ledger.'
                : 'You need a team invite to create an account. Enter the email your admin invited.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-sm font-medium text-stone-700">
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohan Patil"
                  className="input-field"
                />
              </label>
            )}
            <label className="block text-sm font-medium text-stone-700">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input-field"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}
            <button disabled={busy} className="btn-primary-lg">
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in to ledger' : 'Create my account'}
            </button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Invite-only · Only approved team members can join
        </p>
      </div>
    </main>
  );
}
