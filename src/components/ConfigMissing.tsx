export function ConfigMissing() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 text-primary">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-temple-parchment">
        <div className="page-vignette" />
      </div>

      <div className="card w-full max-w-lg p-8 shadow-lift">
        <h1 className="brand-title text-2xl font-bold text-temple-brown">Shivaji Youth</h1>
        <p className="mt-2 text-sm font-semibold text-brand-saffron-700">Local setup required</p>
        <p className="mt-4 text-sm leading-relaxed text-temple-muted">
          The app needs your Supabase credentials to load. Create a{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs text-temple-brown">.env</code> file in the{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs text-temple-brown">calculator</code> folder:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/60 bg-white/50 p-4 text-xs leading-relaxed text-temple-brown">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here`}
        </pre>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-temple-muted">
          <li>Open your Supabase project → Settings → API</li>
          <li>Copy <strong className="text-temple-brown">Project URL</strong> and <strong className="text-temple-brown">anon public</strong> key</li>
          <li>Paste them into <code className="text-xs text-brand-saffron-700">.env</code></li>
          <li>Restart the dev server: <code className="text-xs text-brand-saffron-700">npm run dev</code></li>
        </ol>
        <p className="mt-4 text-xs text-muted">
          On Bolt/hosted deploy, these are already set in project environment variables.
        </p>
      </div>
    </main>
  );
}
