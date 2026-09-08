import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GANPATI_CENTER, SHIVAJI_IMG, TEMPLE_BG } from '@/lib/theme';
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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 text-primary">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={TEMPLE_BG} alt="" className="page-temple-bg" />
        <div className="page-vignette" />
        <img src={GANPATI_CENTER} alt="" className="page-ganesha-center" />
        <div className="page-mandala-tl" aria-hidden="true" />
        <div className="page-mandala-tr" aria-hidden="true" />
        <div className="page-diyas" aria-hidden="true" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-5 w-fit">
            <div className="absolute -inset-3 rounded-full bg-brand-saffron-400/20 blur-xl" />
            <img
              src={SHIVAJI_IMG}
              alt="Chhatrapati Shivaji Maharaj"
              className="logo-portrait relative mx-auto h-20 w-20"
            />
          </div>
          <h1 className="brand-title text-3xl font-bold text-temple-brown sm:text-4xl">Shivaji Youth</h1>
          <p className="mt-2 text-sm font-medium text-temple-muted">Shared cash ledger · Invite-only</p>
          <div className="ornament-line mx-auto mt-4 max-w-[200px]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-saffron-500/80">
              जय शिवराय
            </span>
          </div>
        </div>

        <div className="card p-6 shadow-lift sm:p-8">
          <div className="mb-6 flex rounded-full border border-white/60 bg-white/40 p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-tab-active'
                  : 'text-temple-tab hover:text-temple-brown'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-tab-active'
                  : 'text-temple-tab hover:text-temple-brown'
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-temple-brown">
              {mode === 'login' ? 'Welcome back' : 'Join the youth team'}
            </h2>
            <p className="mt-1 text-sm text-temple-muted">
              {mode === 'login'
                ? 'Sign in to view the team cash ledger.'
                : 'You need a team invite to create an account. Enter the email your admin invited.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-sm font-medium text-temple-brown">
                Your name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohan Patil"
                  className="input-field"
                />
              </label>
            )}
            <label className="block text-sm font-medium text-temple-brown">
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
            <label className="block text-sm font-medium text-temple-brown">
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
            {error && <p className="text-sm text-temple-outflow">{error}</p>}
            {notice && <p className="alert-success">{notice}</p>}
            <button disabled={busy} className="btn-primary-lg">
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in to ledger' : 'Create my account'}
            </button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          Invite-only · Only approved team members can join
        </p>
      </div>
    </main>
  );
}
