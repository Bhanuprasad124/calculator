import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  LayoutGrid,
  LogOut,
  Receipt,
  ScrollText,
  Users,
} from 'lucide-react';
import {
  supabase,
  type AuditEntry,
  type Invite,
  type Profile,
  type Transaction,
  type TransactionType,
} from '@/lib/supabase';
import { formatCurrency, formatDateTime, getInitials } from '@/lib/utils';
import { AuthScreen } from '@/components/AuthScreen';
import { EntryFormCard } from '@/components/EntryFormCard';
import { TransactionTable } from '@/components/TransactionTable';
import { UsersPage } from '@/components/UsersPage';

type EntryForm = { type: TransactionType; amount: string; details: string };
type Tab = 'overview' | 'transactions' | 'audit' | 'users';

const emptyEntry: EntryForm = { type: 'expense', amount: '', details: '' };

const SHIVAJI_IMG =
  'https://images.pexels.com/photos/38876932/pexels-photo-38876932.jpeg?auto=compress&cs=tinysrgb&h=160&w=160';
const GANPATI_BG =
  'https://images.pexels.com/photos/28288479/pexels-photo-28288479.jpeg?auto=compress&cs=tinysrgb&h=1080&w=1920';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const loadWorkspace = useCallback(async (activeSession: Session) => {
    setLoading(true);
    const [profileRes, profilesRes, txRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', activeSession.user.id).maybeSingle(),
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (invitesRes.data) setInvites(invitesRes.data as Invite[]);
    if (txRes.error) setError('Could not load the team ledger. Please refresh and try again.');
    else setTransactions((txRes.data ?? []) as Transaction[]);
    setLoading(false);
  }, []);

  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    const { data, error: auditErr } = await supabase
      .from('audit_log')
      .select('*')
      .order('deleted_at', { ascending: false });
    if (auditErr) setAuditError('Could not load the audit trail. Please try again.');
    else setAuditLog((data ?? []) as AuditEntry[]);
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) void loadWorkspace(data.session);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadWorkspace(nextSession);
      else {
        setProfile(null);
        setProfiles([]);
        setInvites([]);
        setTransactions([]);
        setAuditLog([]);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadWorkspace]);

  useEffect(() => {
    if (tab === 'audit' && session) void loadAuditLog();
  }, [tab, session, loadAuditLog]);

  const profileNames = useMemo(
    () => new Map(profiles.map((m) => [m.id, m.display_name])),
    [profiles],
  );

  const { balance, totalIncome, totalExpense } = useMemo(() => {
    const totals = transactions.reduce(
      (acc, t) => {
        const amt = Number(t.amount);
        if (t.type === 'income') acc.income += amt;
        else acc.expense += amt;
        return acc;
      },
      { income: 0, expense: 0 },
    );
    return { balance: totals.income - totals.expense, totalIncome: totals.income, totalExpense: totals.expense };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const addedBy = t.created_by ? profileNames.get(t.created_by)?.toLowerCase() ?? '' : '';
        return t.details.toLowerCase().includes(q) || addedBy.includes(q);
      }
      return true;
    });
  }, [transactions, filter, search, profileNames]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const amount = Number.parseFloat(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Please enter an amount greater than zero.');
      return;
    }
    if (!entry.details.trim()) {
      setFormError('Please add a description for this entry.');
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('transactions').insert({
      type: entry.type,
      amount,
      details: entry.details.trim(),
    });
    if (insertError) {
      setFormError('Could not save the entry. Please try again.');
      setSubmitting(false);
      return;
    }
    setEntry(emptyEntry);
    if (session) await loadWorkspace(session);
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id);
    if (deleteError) {
      setError('Could not delete that entry. Please try again.');
      return;
    }
    setTransactions((cur) => cur.filter((t) => t.id !== id));
  };

  if (!session) return <AuthScreen />;

  const memberName = profile?.display_name || session.user.email?.split('@')[0] || 'Team member';

  const tabs: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
    { id: 'users', label: 'Members', icon: Users },
  ];

  return (
    <div className="relative min-h-screen text-[#172033]">
      <div className="fixed inset-0 -z-10">
        <img src={GANPATI_BG} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-50/85 backdrop-blur-sm" />
      </div>

      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <img
              src={SHIVAJI_IMG}
              alt="Chhatrapati Shivaji Maharaj"
              className="h-10 w-10 rounded-xl object-cover ring-2 ring-[#4f00f5]"
            />
            <div>
              <h1 className="text-base font-bold tracking-tight sm:text-lg">Shivaji Youth</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Team cash movement ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-right sm:flex">
              <div>
                <p className="text-sm font-semibold text-slate-800">{memberName}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  {isAdmin && <Crown className="h-3 w-3 text-amber-500" />}
                  {isAdmin ? 'Admin' : 'Member'}
                </p>
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-[#4f00f5]">
              {getInitials(memberName)}
            </div>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              aria-label="Sign out"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                  tab === id
                    ? 'border-[#4f00f5] text-[#4f00f5]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* === OVERVIEW TAB === */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#4f00f5]">Overview</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Team finances</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 sm:flex">
                <Users className="h-4 w-4" />
                {profiles.length || 1} member{profiles.length === 1 ? '' : 's'}
              </div>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total In</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-rose-600" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Out</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-rose-600">{formatCurrency(totalExpense)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Net Balance</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${balance >= 0 ? 'text-[#4f00f5]' : 'text-rose-600'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </section>

            <EntryFormCard
              entry={entry}
              setEntry={setEntry}
              onSubmit={handleSubmit}
              submitting={submitting}
              formError={formError}
              isAdmin={isAdmin}
            />

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="font-bold text-slate-900">Recent Transactions</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Latest 5 entries</p>
                </div>
                {transactions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setTab('transactions')}
                    className="text-sm font-semibold text-[#4f00f5] transition hover:text-[#4200d1]"
                  >
                    View all
                  </button>
                )}
              </div>
              <TransactionTable
                transactions={transactions}
                profileNames={profileNames}
                onDelete={isAdmin ? handleDelete : undefined}
                loading={loading}
                error={error}
                emptyMessage="No transactions yet. Add the first team entry above."
                limit={5}
              />
            </section>
          </div>
        )}

        {/* === TRANSACTIONS TAB === */}
        {tab === 'transactions' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#4f00f5]">Transactions</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">All team activity</h2>
              <p className="mt-1 text-sm text-slate-500">Every entry recorded by the team, newest first.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description or member name..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
              <div className="flex gap-2">
                {(['all', 'income', 'expense'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                      filter === f
                        ? 'border-[#4f00f5] bg-[#4f00f5] text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'income' ? 'Received' : 'Spent'}
                  </button>
                ))}
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <TransactionTable
                transactions={filteredTransactions}
                profileNames={profileNames}
                onDelete={isAdmin ? handleDelete : undefined}
                loading={loading}
                error={error}
                emptyMessage={search || filter !== 'all' ? 'No transactions match your filters.' : 'No transactions yet.'}
              />
            </section>
          </div>
        )}

        {/* === AUDIT TAB === */}
        {tab === 'audit' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#4f00f5]">Audit Trail</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Deletion log</h2>
              <p className="mt-1 text-sm text-slate-500">
                Every deleted entry is recorded here with who removed it and when. This log cannot be edited or erased by team members.
              </p>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="font-bold text-slate-900">Deleted Entries</h3>
                <p className="mt-0.5 text-xs text-slate-500">{auditLog.length} deletion{auditLog.length === 1 ? '' : 's'} recorded</p>
              </div>

              {auditLoading ? (
                <div className="py-12 text-center text-sm text-slate-400">Loading audit trail...</div>
              ) : auditError ? (
                <p className="py-12 text-center text-sm text-rose-600">{auditError}</p>
              ) : auditLog.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No deletions recorded. When someone removes an entry, it will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-bold">Deleted At</th>
                        <th className="px-5 py-3 font-bold">Description</th>
                        <th className="px-5 py-3 font-bold">Amount</th>
                        <th className="px-5 py-3 font-bold">Originally By</th>
                        <th className="px-5 py-3 font-bold">Deleted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLog.map((entry) => (
                        <tr key={entry.id} className="transition hover:bg-rose-50/40">
                          <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDateTime(entry.deleted_at)}</td>
                          <td className="max-w-[220px] px-5 py-4 font-semibold text-slate-800">{entry.transaction_details}</td>
                          <td className={`px-5 py-4 font-bold tabular-nums ${entry.transaction_type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(Number(entry.transaction_amount))}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-[#4f00f5]">
                              {entry.original_created_by ? profileNames.get(entry.original_created_by) || 'Team member' : 'Earlier entry'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                              {entry.deleted_by ? profileNames.get(entry.deleted_by) || 'Team member' : 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* === USERS TAB === */}
        {tab === 'users' && (
          <UsersPage
            profiles={profiles}
            invites={invites}
            currentUserId={session.user.id}
            isAdmin={isAdmin}
            onRoleChanged={() => void loadWorkspace(session)}
            onInvitesChanged={() => void loadWorkspace(session)}
          />
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Shared with the Shivaji Youth team · Entries are saved automatically
        </p>
      </main>
    </div>
  );
}
