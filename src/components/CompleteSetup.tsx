import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CompleteSetupProps {
  email: string;
  onDone: () => void;
}

const SHIVAJI_IMG =
  'https://images.pexels.com/photos/38876932/pexels-photo-38876932.jpeg?auto=compress&cs=tinysrgb&h=160&w=160';

const GANPATI_BG =
  'https://images.pexels.com/photos/28288479/pexels-photo-28288479.jpeg?auto=compress&cs=tinysrgb&h=1080&w=1920';

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
    const { error: rpcError } = await supabase.rpc('complete_account_setup', {
      p_name: name.trim(),
      p_password: password,
    });

    if (rpcError) {
      setError('Could not set up your account. Please try again.');
      setBusy(false);
      return;
    }

    await supabase.auth.refreshSession();
    onDone();
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
          <p className="mt-2 text-sm text-slate-500">Complete your team account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(35,42,65,0.08)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Welcome to the team!</h2>
            <p className="mt-1 text-sm text-slate-500">
              You're signing in as <span className="font-semibold text-slate-700">{email}</span>.
              Choose your name and a password to finish setting up your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohan Patil"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Choose a password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Confirm password
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4f00f5] py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4200d1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Setting up...' : 'Complete setup'}
            </button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Invite-only · Only approved team members can join
        </p>
      </div>
    </main>
  );
}
