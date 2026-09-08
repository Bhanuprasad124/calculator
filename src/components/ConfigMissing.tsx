export function ConfigMissing() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 text-primary">
      <div className="fixed inset-0 -z-10">
        <div className="page-backdrop" />
        <div className="page-pattern" />
      </div>

      <div className="card card-fancy w-full max-w-lg p-8 shadow-lift">
        <h1 className="brand-title text-2xl font-bold text-white">Shivaji Youth</h1>
        <p className="mt-2 text-sm font-semibold text-brand-gold-400">Local setup required</p>
        <p className="mt-4 text-sm leading-relaxed text-secondary">
          The app needs your Supabase credentials to load. Create a{' '}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-white">.env</code> file in the{' '}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-white">calculator</code> folder:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-brand-gold-400/20 bg-black/40 p-4 text-xs leading-relaxed text-maratha-parchment">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here`}
        </pre>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-secondary">
          <li>Open your Supabase project → Settings → API</li>
          <li>Copy <strong className="text-white">Project URL</strong> and <strong className="text-white">anon public</strong> key</li>
          <li>Paste them into <code className="text-xs text-brand-gold-400">.env</code></li>
          <li>Restart the dev server: <code className="text-xs text-brand-gold-400">npm run dev</code></li>
        </ol>
        <p className="mt-4 text-xs text-muted">
          On Bolt/hosted deploy, these are already set in project environment variables.
        </p>
      </div>
    </main>
  );
}
