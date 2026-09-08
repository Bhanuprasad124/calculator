import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GANPATI_BG, SHIVAJI_IMG } from '@/lib/theme';
import { friendlySetupError } from '@/lib/utils';

interface CompleteSetupProps {
  email: string;
  onDone: () => void;
}

export function CompleteSetup({ email, onDone }: CompleteSetupProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name so the team can identify your entries.');
      return;
    }
    if (password.length < 6) {
      setError('Your password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);

    const trimmedName = name.trim();

    const { error: rpcError } = await supabase.rpc('complete_account_setup', {
      p_name: trimmedName,
    });
    if (rpcError) {
      setError(friendlySetupError(rpcError.message));
      setBusy(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      password,
      data: { name: trimmedName, setup_complete: true },
    });
    if (authError) {
      setError(friendlySetupError(authError.message));
      setBusy(false);
      return;
    }

    await supabase.auth.refreshSession();
    setBusy(false);
    onDone();
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
          <p className="mt-2 text-sm text-stone-500">Complete your team account</p>
        </div>

        <div className="card p-6 shadow-lift sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-stone-900">Welcome to the team!</h2>
            <p className="mt-1 text-sm text-stone-500">
              You're signing in as <span className="font-semibold text-brand-maroon-800">{email}</span>.
              Choose your name and a password to finish setting up your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-stone-700">
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohan Patil"
                className="input-field"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Choose a password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input-field"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Confirm password
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="input-field"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button disabled={busy} className="btn-primary-lg">
              {busy ? 'Setting up...' : 'Complete setup'}
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
