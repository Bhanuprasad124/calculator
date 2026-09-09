import { supabase } from '@/lib/supabase';

const PROJECT_STORAGE_KEY = 'shivaji-youth-supabase-project';

function getProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] ?? url;
  } catch {
    return url;
  }
}

function clearSupabaseAuthStorage(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('sb-') && key.includes('auth')) {
      localStorage.removeItem(key);
    }
  }
}

/** Sign out and wipe cached auth when the Supabase project URL changes. */
export async function reconcileSupabaseProject(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  if (!url || typeof localStorage === 'undefined') return;

  const currentRef = getProjectRef(url);
  const previousRef = localStorage.getItem(PROJECT_STORAGE_KEY);

  if (previousRef && previousRef !== currentRef) {
    clearSupabaseAuthStorage();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Best-effort cleanup when switching projects.
    }
  }

  localStorage.setItem(PROJECT_STORAGE_KEY, currentRef);
}
