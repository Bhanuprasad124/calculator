import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import type { Transaction } from '@/lib/supabase';
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
    return <div className="py-12 text-center text-sm text-muted">Loading team activity...</div>;
  }

  if (error) {
    return <p className="py-12 text-center text-sm text-maratha-outflow">{error}</p>;
  }

  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-shell w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Added by</th>
            <th>Type</th>
            <th className="text-right">Amount</th>
            {onDelete && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="group">
              <td className="whitespace-nowrap text-muted">{formatDate(t.created_at)}</td>
              <td className="max-w-[280px] font-semibold text-white">{t.details}</td>
              <td>
                <span className="member-chip">
                  {t.created_by ? profileNames.get(t.created_by) || 'Team member' : 'Earlier entry'}
                </span>
              </td>
              <td>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    t.type === 'income' ? 'text-maratha-inflow' : 'text-maratha-outflow'
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
                className={`text-right font-bold tabular-nums ${
                  t.type === 'income' ? 'text-maratha-inflow' : 'text-maratha-outflow'
                }`}
              >
                {t.type === 'income' ? '+' : '-'}
                {formatCurrency(Number(t.amount))}
              </td>
              {onDelete && (
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    aria-label="Delete entry"
                    className="rounded p-1 text-muted opacity-0 transition hover:bg-maratha-outflow/15 hover:text-maratha-outflow group-hover:opacity-100"
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
