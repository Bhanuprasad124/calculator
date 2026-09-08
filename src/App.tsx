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
import { formatCurrency, formatDateTime, getInitials, invitedUserNeedsSetup } from '@/lib/utils';
import { AuthScreen } from '@/components/AuthScreen';
import { CompleteSetup } from '@/components/CompleteSetup';
import { EntryFormCard } from '@/components/EntryFormCard';
import { TransactionTable } from '@/components/TransactionTable';
import { UsersPage } from '@/components/UsersPage';
import { GANPATI_CENTER, SHIVAJI_IMG, TEMPLE_BG } from '@/lib/theme';

type EntryForm = { type: TransactionType; amount: string; details: string };
type Tab = 'overview' | 'transactions' | 'audit' | 'users';

const emptyEntry: EntryForm = { type: 'expense', amount: '', details: '' };

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
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const loadWorkspace = useCallback(async (activeSession: Session) => {
    setLoading(true);
    setSetupChecked(false);
    const [profileRes, profilesRes, txRes, invitesRes, setupRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', activeSession.user.id).maybeSingle(),
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.rpc('user_needs_account_setup'),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (invitesRes.data) setInvites(invitesRes.data as Invite[]);
    if (txRes.error) setError('Could not load the team ledger. Please refresh and try again.');
    else setTransactions((txRes.data ?? []) as Transaction[]);

    if (setupRes.error) {
      setNeedsSetup(
        invitedUserNeedsSetup(activeSession.user, (profileRes.data as Profile | null) ?? null),
      );
    } else {
      const profile = profileRes.data as Profile | null;
      const emailPrefix = activeSession.user.email?.split('@')[0]?.toLowerCase() ?? '';
      const hasRealProfile =
        !!profile?.display_name?.trim() &&
        profile.display_name.trim().toLowerCase() !== emailPrefix;
      const setupComplete = activeSession.user.user_metadata?.setup_complete === true;
      setNeedsSetup(setupRes.data === true && !hasRealProfile && !setupComplete);
    }
    setSetupChecked(true);
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
      if (data.session) {
        setTab('overview');
        void loadWorkspace(data.session);
      } else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        // Avoid re-checking setup mid-flow when updateUser refreshes metadata.
        if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') return;
        setTab('overview');
        void loadWorkspace(nextSession);
      } else {
        setProfile(null);
        setProfiles([]);
        setInvites([]);
        setTransactions([]);
        setAuditLog([]);
        setTab('overview');
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

  if (!setupChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-temple-parchment text-muted">
        Loading...
      </div>
    );
  }

  if (needsSetup) {
    return (
      <CompleteSetup
        email={session.user.email ?? ''}
        onDone={() => {
          setNeedsSetup(false);
          if (session) void loadWorkspace(session);
        }}
      />
    );
  }

  const memberName = profile?.display_name || session.user.email?.split('@')[0] || 'Team member';

  const tabs: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
    { id: 'users', label: 'Members', icon: Users },
  ];

  return (
    <div className="relative min-h-screen text-primary">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={TEMPLE_BG} alt="" className="page-temple-bg" />
        <div className="page-vignette" />
        <img src={GANPATI_CENTER} alt="" className="page-ganesha-center" />
        <div className="page-diyas" aria-hidden="true" />
      </div>

      <div className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
        <header className="floating-header mx-auto max-w-5xl px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex items-center justify-between gap-3 lg:justify-start">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <img
                  src={SHIVAJI_IMG}
                  alt="Chhatrapati Shivaji Maharaj"
                  className="logo-portrait"
                />
                <div className="min-w-0">
                  <h1 className="brand-title truncate text-sm font-bold text-temple-brown sm:text-base">
                    Shivaji Youth
                  </h1>
                  <p className="truncate text-[11px] text-temple-muted sm:text-xs">
                    Team cash movement ledger
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <div className="profile-avatar">{getInitials(memberName)}</div>
                <button
                  type="button"
                  onClick={() => void supabase.auth.signOut()}
                  aria-label="Sign out"
                  className="btn-ghost"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <nav className="tab-bar flex-1 lg:justify-center">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={tab === id ? 'tab-pill-active' : 'tab-pill-inactive'}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{id === 'overview' ? 'Overview' : id === 'transactions' ? 'Txns' : id === 'audit' ? 'Audit' : 'Team'}</span>
                </button>
              ))}
            </nav>

            <div className="hidden items-center gap-2.5 lg:flex">
              <div className="text-right">
                <p className="max-w-[120px] truncate text-sm font-semibold text-temple-brown">
                  {memberName}
                </p>
                <p className="admin-badge justify-end">
                  {isAdmin && <Crown className="h-3 w-3 text-brand-gold-500" />}
                  {isAdmin ? 'Admin' : 'Member'}
                </p>
              </div>
              <div className="profile-avatar">{getInitials(memberName)}</div>
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                aria-label="Sign out"
                className="btn-ghost"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* === OVERVIEW TAB === */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <p className="section-eyebrow">Overview</p>
                <h2 className="brand-title mt-2 text-2xl font-bold text-temple-brown sm:text-3xl">Team finances</h2>
                <div className="ornament-line mt-3 max-w-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-saffron-500/80">
                    जय शिवराय
                  </span>
                </div>
              </div>
              <div className="member-count-pill shrink-0">
                <span aria-hidden="true">👥</span>
                {profiles.length || 1} member{profiles.length === 1 ? '' : 's'}
              </div>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-stat glass-stat-in">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="glass-stat-label">Total In</p>
                    <p className="glass-stat-value-in">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="stat-icon-in">
                    <ArrowDownToLine className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="glass-stat glass-stat-out">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="glass-stat-label">Total Out</p>
                    <p className="glass-stat-value-out">{formatCurrency(totalExpense)}</p>
                  </div>
                  <div className="stat-icon-out">
                    <ArrowUpFromLine className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="glass-stat glass-stat-balance">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="glass-stat-label">Net Balance</p>
                    <p className="glass-stat-value-balance">{formatCurrency(balance)}</p>
                  </div>
                  <div className="stat-icon-balance">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                </div>
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

            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/50 px-5 py-4">
                <div>
                  <h3 className="font-bold text-temple-brown">Recent Transactions</h3>
                  <p className="mt-0.5 text-xs text-muted">Latest 5 entries</p>
                </div>
                {transactions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setTab('transactions')}
                    className="text-sm font-semibold text-brand-saffron-700 transition hover:text-brand-saffron-800"
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
              <p className="section-eyebrow">Transactions</p>
              <h2 className="brand-title mt-2 text-2xl font-bold text-temple-brown sm:text-3xl">All team activity</h2>
              <p className="mt-1 text-sm text-secondary">Every entry recorded by the team, newest first.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description or member name..."
                className="input-field mt-0 flex-1"
              />
              <div className="flex gap-2">
                {(['all', 'income', 'expense'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={filter === f ? 'filter-pill-active' : 'filter-pill-inactive'}
                  >
                    {f === 'all' ? 'All' : f === 'income' ? 'Received' : 'Spent'}
                  </button>
                ))}
              </div>
            </div>

            <section className="card overflow-hidden">
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
              <p className="section-eyebrow">Audit Trail</p>
              <h2 className="brand-title mt-2 text-2xl font-bold text-temple-brown sm:text-3xl">Deletion log</h2>
              <p className="mt-1 text-sm text-secondary">
                Every deleted entry is recorded here with who removed it and when. This log cannot be edited or erased by team members.
              </p>
            </div>

            <section className="card overflow-hidden">
              <div className="border-b border-white/50 px-5 py-4">
                <h3 className="font-bold text-temple-brown">Deleted Entries</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {auditLog.length} deletion{auditLog.length === 1 ? '' : 's'} recorded
                </p>
              </div>

              {auditLoading ? (
                <div className="py-12 text-center text-sm text-muted">Loading audit trail...</div>
              ) : auditError ? (
                <p className="py-12 text-center text-sm text-temple-outflow">{auditError}</p>
              ) : auditLog.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted">
                  No deletions recorded. When someone removes an entry, it will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-shell w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr>
                        <th>Deleted At</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Originally By</th>
                        <th>Deleted By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry) => (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap text-muted">{formatDateTime(entry.deleted_at)}</td>
                          <td className="max-w-[220px] font-semibold text-temple-brown">{entry.transaction_details}</td>
                          <td
                            className={`font-bold tabular-nums ${
                              entry.transaction_type === 'income' ? 'text-temple-inflow' : 'text-temple-outflow'
                            }`}
                          >
                            {formatCurrency(Number(entry.transaction_amount))}
                          </td>
                          <td>
                            <span className="member-chip">
                              {entry.original_created_by
                                ? profileNames.get(entry.original_created_by) || 'Team member'
                                : 'Earlier entry'}
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex items-center rounded-full bg-temple-outflow/10 px-2.5 py-1 text-xs font-semibold text-temple-outflow ring-1 ring-temple-outflow/20">
                              {entry.deleted_by
                                ? profileNames.get(entry.deleted_by) || 'Team member'
                                : 'Unknown'}
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

        <p className="mt-8 text-center text-xs text-muted">
          Shared with the Shivaji Youth team · Entries are saved automatically
        </p>
      </main>
    </div>
  );
}
