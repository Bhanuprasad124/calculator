import type { FormEvent } from 'react';
import { ChevronDown, Loader2, Lock, Plus, WalletCards } from 'lucide-react';
import type { TransactionType } from '@/lib/supabase';

type EntryForm = {
  type: TransactionType;
  amount: string;
  details: string;
};

interface EntryFormProps {
  entry: EntryForm;
  setEntry: (updater: (prev: EntryForm) => EntryForm) => void;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  formError: string | null;
  isAdmin: boolean;
}

export function EntryFormCard({ entry, setEntry, onSubmit, submitting, formError, isAdmin }: EntryFormProps) {
  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Record Cash Movement</h3>
            <p className="text-xs text-slate-500">Only admins can add or remove entries</p>
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          You have read-only access. Ask an admin to record a cash entry on your behalf, or request admin access from the Users page.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-[#4f00f5]">
          <WalletCards className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Record Cash Movement</h3>
          <p className="text-xs text-slate-500">Add a shared entry under your name</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <label className="text-sm font-semibold text-slate-700">
            Type
            <div className="relative mt-1.5">
              <select
                value={entry.type}
                onChange={(e) => setEntry((p) => ({ ...p, type: e.target.value as TransactionType }))}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              >
                <option value="expense">Amount Spent (Out)</option>
                <option value="income">Amount Received (In)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Amount (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={entry.amount}
              onChange={(e) => setEntry((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Description
            <input
              value={entry.details}
              onChange={(e) => setEntry((p) => ({ ...p, details: e.target.value }))}
              placeholder="e.g. Sold light fixture, Tea/Snacks, Courier charge"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
            />
          </label>

          <button
            disabled={submitting}
            className="flex h-[42px] items-center justify-center gap-2 rounded-lg bg-[#4f00f5] px-6 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-[#4200d1] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? 'Saving' : 'Save Entry'}
          </button>
        </div>

        {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
      </form>
    </section>
  );
}
