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
      <section className="card p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Record Cash Movement</h3>
            <p className="text-xs text-stone-500">Only admins can add or remove entries</p>
          </div>
        </div>
        <p className="rounded-lg bg-brand-saffron-50/60 px-4 py-3 text-sm text-stone-600 ring-1 ring-brand-saffron-100">
          You have read-only access. Ask an admin to record a cash entry on your behalf, or request admin access from the Members page.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-saffron-100 text-brand-saffron-700">
          <WalletCards className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-stone-900">Record Cash Movement</h3>
          <p className="text-xs text-stone-500">Add a shared entry under your name</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <label className="text-sm font-semibold text-stone-700">
            Type
            <div className="relative mt-1.5">
              <select
                value={entry.type}
                onChange={(e) => setEntry((p) => ({ ...p, type: e.target.value as TransactionType }))}
                className="input-field mt-0 appearance-none pr-10"
              >
                <option value="expense">Amount Spent (Out)</option>
                <option value="income">Amount Received (In)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-stone-400" />
            </div>
          </label>

          <label className="text-sm font-semibold text-stone-700">
            Amount (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={entry.amount}
              onChange={(e) => setEntry((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              className="input-field"
            />
          </label>

          <label className="text-sm font-semibold text-stone-700">
            Description
            <input
              value={entry.details}
              onChange={(e) => setEntry((p) => ({ ...p, details: e.target.value }))}
              placeholder="e.g. Sold light fixture, Tea/Snacks, Courier charge"
              className="input-field"
            />
          </label>

          <button disabled={submitting} className="btn-primary h-[42px]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? 'Saving' : 'Save Entry'}
          </button>
        </div>

        {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
      </form>
    </section>
  );
}
