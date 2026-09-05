import { useState } from 'react';
import { Crown, Shield, User as UserIcon } from 'lucide-react';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';
import { formatDate, getInitials } from '@/lib/utils';

interface UsersPageProps {
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
  onRoleChanged: () => void;
}

export function UsersPage({ profiles, currentUserId, isAdmin, onRoleChanged }: UsersPageProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#4f00f5]">Team</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Members &amp; Access</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everyone who has signed up appears here. Admins can add, edit, and delete entries; members have read-only access.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

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
