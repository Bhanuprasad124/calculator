import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import type { Profile, Transaction } from '@/lib/supabase';
import { formatCurrency, formatDate, typeLabel } from '@/lib/utils';

interface TransactionTableProps {
  transactions: Transaction[];
  profileNames: Map<string, string>;
  onDelete?: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  limit?: number;
}

export function TransactionTable({
  transactions,
  profileNames,
  onDelete,
  loading,
  error,
  emptyMessage = 'No transactions yet.',
  limit,
}: TransactionTableProps) {
  const rows = limit ? transactions.slice(0, limit) : transactions;

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">Loading team activity...</div>
    );
  }

  if (error) {
    return <p className="py-12 text-center text-sm text-rose-600">{error}</p>;
  }

  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-3 font-bold">Date</th>
            <th className="px-5 py-3 font-bold">Description</th>
            <th className="px-5 py-3 font-bold">Added by</th>
            <th className="px-5 py-3 font-bold">Type</th>
            <th className="px-5 py-3 text-right font-bold">Amount</th>
            {onDelete && <th className="px-5 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={t.id} className="group transition hover:bg-slate-50">
              <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(t.created_at)}</td>
              <td className="max-w-[280px] px-5 py-4 font-semibold text-slate-800">{t.details}</td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-[#4f00f5]">
                  {t.created_by ? profileNames.get(t.created_by) || 'Team member' : 'Earlier entry'}
                </span>
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {t.type === 'income' ? (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                  )}
                  {typeLabel(t.type)}
                </span>
              </td>
              <td
                className={`px-5 py-4 text-right font-bold tabular-nums ${
                  t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {t.type === 'income' ? '+' : '-'}
                {formatCurrency(Number(t.amount))}
              </td>
              {onDelete && (
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    aria-label="Delete entry"
                    className="rounded p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
