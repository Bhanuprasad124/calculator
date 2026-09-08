export function ConfigMissing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffbf5] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-orange-200 bg-white p-8 shadow-lg">
        <h1 className="brand-title text-2xl font-bold text-brand-maroon-900">Shivaji Youth</h1>
        <p className="mt-2 text-sm font-semibold text-brand-saffron-700">Local setup required</p>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          The app needs your Supabase credentials to load. Create a{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">.env</code> file in the{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">calculator</code> folder:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs leading-relaxed text-stone-100">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here`}
        </pre>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone-600">
          <li>Open your Supabase project → Settings → API</li>
          <li>Copy <strong>Project URL</strong> and <strong>anon public</strong> key</li>
          <li>Paste them into <code className="text-xs">.env</code></li>
          <li>Restart the dev server: <code className="text-xs">npm run dev</code></li>
        </ol>
        <p className="mt-4 text-xs text-stone-400">
          On Bolt/hosted deploy, these are already set in project environment variables.
        </p>
      </div>
    </main>
  );
}
