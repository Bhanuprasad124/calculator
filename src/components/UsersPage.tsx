import { useState, type FormEvent } from 'react';
import { Crown, Mail, MailPlus, Shield, Trash2, User as UserIcon, UserPlus } from 'lucide-react';
import { supabase, type Invite, type Profile, type UserRole } from '@/lib/supabase';
import { formatDate, getInitials } from '@/lib/utils';

interface UsersPageProps {
  profiles: Profile[];
  invites: Invite[];
  currentUserId: string;
  isAdmin: boolean;
  onRoleChanged: () => void;
  onInvitesChanged: () => void;
}

export function UsersPage({ profiles, invites, currentUserId, isAdmin, onRoleChanged, onInvitesChanged }: UsersPageProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const handleRoleChange = async (targetId: string, newRole: UserRole) => {
    setError(null);
    setBusyId(targetId);
    const { error: rpcError } = await supabase.rpc('set_member_role', {
      p_target: targetId,
      p_role: newRole,
    });
    setBusyId(null);
    if (rpcError) {
      setError('Could not update that member\'s role. Please try again.');
      return;
    }
    onRoleChanged();
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    if (invites.some((inv) => inv.email === trimmed)) {
      setInviteError('This email has already been invited.');
      return;
    }
    setInviteBusy(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ email: trimmed }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setInviteError(result.error || 'Could not send the invite. Please try again.');
        setInviteBusy(false);
        return;
      }
      setInviteEmail('');
      setInviteSuccess(
        result.warning
          ? `${trimmed} has been invited, but the email could not be sent automatically. Share the site link with them so they can sign up.`
          : `Invitation email sent to ${trimmed}. They can follow the link in the email to set up their account.`,
      );
      onInvitesChanged();
    } catch {
      setInviteError('Could not reach the invite service. Please try again.');
    }
    setInviteBusy(false);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setBusyId(inviteId);
    const { error: deleteError } = await supabase.from('invites').delete().eq('id', inviteId);
    setBusyId(null);
    if (deleteError) {
      setError('Could not revoke that invite. Please try again.');
      return;
    }
    onInvitesChanged();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#4f00f5]">Team</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Members &amp; Access</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage who can join and what they can do. Admins can add, edit, and delete entries; members have read-only access.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      {/* === INVITE SECTION (admin only) === */}
      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Invite a Team Member</h3>
              <p className="text-xs text-slate-500">They'll receive an email with a link to set up their account</p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-700">
              Email address
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4f00f5] focus:ring-2 focus:ring-[#4f00f5]/15"
              />
            </label>
            <button
              type="submit"
              disabled={inviteBusy}
              className="flex h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <MailPlus className="h-4 w-4" />
              {inviteBusy ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {inviteError && <p className="mt-3 text-sm text-rose-600">{inviteError}</p>}
          {inviteSuccess && <p className="mt-3 text-sm text-emerald-600">{inviteSuccess}</p>}

          {invites.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Pending Invites ({invites.length})
              </p>
              <div className="space-y-2">
                {invites.map((inv) => {
                  return (
                    <div key={inv.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-sm font-medium text-slate-700">{inv.email}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                        Pending
                      </span>
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Revoke invite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* === MEMBERS LIST === */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-bold text-slate-900">All Members</h3>
          <p className="mt-0.5 text-xs text-slate-500">{profiles.length} member{profiles.length === 1 ? '' : 's'}</p>
        </div>

        {profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No members found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {profiles.map((member) => {
              const isCurrentUser = member.id === currentUserId;
              const isMemberAdmin = member.role === 'admin';
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-[#4f00f5]">
                    {getInitials(member.display_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">
                      {member.display_name}
                      {isCurrentUser && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-400">Joined {formatDate(member.created_at)}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      isMemberAdmin ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isMemberAdmin ? <Crown className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                    {isMemberAdmin ? 'Admin' : 'Member'}
                  </span>

                  {isAdmin && !isCurrentUser && (
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => handleRoleChange(member.id, isMemberAdmin ? 'member' : 'admin')}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        isMemberAdmin
                          ? 'border-slate-300 text-slate-600 hover:border-slate-400'
                          : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      {busyId === member.id
                        ? 'Updating...'
                        : isMemberAdmin
                          ? 'Make Member'
                          : 'Make Admin'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Read-only access</p>
            <p className="mt-1 text-sm text-slate-500">
              You can view all transactions and the audit trail, but only admins can add, edit, or delete entries. Ask an existing admin to promote you if you need write access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
