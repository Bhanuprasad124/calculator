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
        <p className="section-eyebrow">Team</p>
        <h2 className="brand-title mt-2 text-2xl font-bold text-white sm:text-3xl">Members &amp; Access</h2>
        <p className="mt-1 text-sm text-secondary">
          Manage who can join and what they can do. Admins can add, edit, and delete entries; members have read-only access.
        </p>
      </div>

      {error && <p className="alert-error">{error}</p>}

      {isAdmin && (
        <section className="form-panel">
          <div className="mb-4 flex items-center gap-3">
            <div className="stat-icon-in">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white">Invite a Team Member</h3>
              <p className="text-xs text-muted">They'll receive an email with a link to set up their account</p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-secondary">
              Email address
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="input-field text-sm font-normal"
              />
            </label>
            <button type="submit" disabled={inviteBusy} className="btn-primary h-[42px]">
              <MailPlus className="h-4 w-4" />
              {inviteBusy ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {inviteError && <p className="mt-3 text-sm text-maratha-outflow">{inviteError}</p>}
          {inviteSuccess && <p className="mt-3 alert-success">{inviteSuccess}</p>}

          {invites.length > 0 && (
            <div className="mt-5 border-t border-brand-gold-400/20 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                Pending Invites ({invites.length})
              </p>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-lg border border-brand-gold-400/20 bg-black/20 px-4 py-2.5"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-brand-gold-400" />
                    <span className="flex-1 truncate text-sm font-medium text-secondary">{inv.email}</span>
                    <span className="rounded-full bg-brand-gold-400/15 px-2.5 py-0.5 text-xs font-semibold text-brand-gold-400 ring-1 ring-brand-gold-400/30">
                      Pending
                    </span>
                    <button
                      type="button"
                      disabled={busyId === inv.id}
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="btn-ghost p-1.5 disabled:opacity-50"
                      aria-label="Revoke invite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-brand-gold-400/20 bg-black/15 px-5 py-4">
          <h3 className="font-bold text-white">All Members</h3>
          <p className="mt-0.5 text-xs text-muted">
            {profiles.length} member{profiles.length === 1 ? '' : 's'}
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No members found.</div>
        ) : (
          <div className="divide-y divide-brand-gold-400/10">
            {profiles.map((member) => {
              const isCurrentUser = member.id === currentUserId;
              const isMemberAdmin = member.role === 'admin';
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/5"
                >
                  <div className="avatar-badge shrink-0">{getInitials(member.display_name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {member.display_name}
                      {isCurrentUser && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">Joined {formatDate(member.created_at)}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      isMemberAdmin
                        ? 'bg-brand-gold-400/15 text-brand-gold-400 ring-1 ring-brand-gold-400/30'
                        : 'bg-white/5 text-muted ring-1 ring-white/10'
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
                          ? 'border-brand-gold-400/25 text-secondary hover:border-brand-gold-400/45 hover:bg-white/5'
                          : 'border-brand-gold-400/40 text-brand-gold-400 hover:bg-brand-gold-400/10'
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
        <div className="card flex items-start gap-3 p-5">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold-400" />
          <div>
            <p className="text-sm font-semibold text-white">Read-only access</p>
            <p className="mt-1 text-sm text-secondary">
              You can view all transactions and the audit trail, but only admins can add, edit, or delete entries. Ask an existing admin to promote you if you need write access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
