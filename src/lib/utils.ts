import type { User } from '@supabase/supabase-js';
import type { Profile, TransactionType } from '@/lib/supabase';

/** True when an email-invited user still needs to set their name and password. */
export function invitedUserNeedsSetup(user: User, profile: Profile | null): boolean {
  const meta = user.user_metadata ?? {};
  if (meta.setup_complete === true) return false;
  if (!meta.inviter_name && meta.name?.trim()) return false;
  if (!profile?.display_name?.trim()) return true;

  const emailPrefix = user.email?.split('@')[0]?.toLowerCase() ?? '';
  return profile.display_name.trim().toLowerCase() === emailPrefix;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function friendlySetupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('password should be at least') || lower.includes('at least 6')) {
    return 'Your password must be at least 6 characters.';
  }
  if (lower.includes('same_password') || lower.includes('different from the old')) {
    return 'Please choose a different password than your current one.';
  }
  if (lower.includes('not authenticated') || lower.includes('jwt')) {
    return 'Your session expired. Open the invite link from your email again.';
  }
  if (lower.includes('name is required')) {
    return 'Please enter your name so the team can identify your entries.';
  }
  if (lower.includes('function') && lower.includes('does not exist')) {
    return 'Account setup is not configured yet. Ask your admin to run the latest database migration.';
  }
  return 'Could not set up your account. Please try again.';
}

export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'The email or password is incorrect.';
  if (lower.includes('already registered')) return 'That email is already registered. Try signing in.';
  if (lower.includes('password should be at least')) return 'Your password must be at least 6 characters.';
  return 'We could not complete that request. Please check your details and try again.';
}

export function typeLabel(type: TransactionType): string {
  return type === 'income' ? 'Received' : 'Spent';
}
